import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe/client";
import { upsertSubscription } from "@/lib/stripe/subscription";
import { createAdminClient } from "@/lib/supabase/server";
import { getPlanByPriceId, type PlanId } from "@/types/subscription";

/** Extract current_period_end from subscription items (moved from top-level in newer Stripe API) */
function getPeriodEnd(subscription: Stripe.Subscription): string {
  const item = subscription.items.data[0];
  const timestamp = item?.current_period_end ?? Math.floor(Date.now() / 1000);
  return new Date(timestamp * 1000).toISOString();
}

/** Resolve a Supabase user id from a Stripe subscription. Falls back to a lookup
 *  by stripe_customer_id when metadata is missing (subs created via the
 *  Stripe Portal or Dashboard don't carry our metadata). */
async function resolveUserId(
  subscription: Stripe.Subscription
): Promise<string | null> {
  const metaUserId = subscription.metadata?.supabase_user_id;
  if (metaUserId) return metaUserId;

  const customerId = subscription.customer as string;
  if (!customerId) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .maybeSingle();

  return data?.user_id ?? null;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Idempotency: claim this event.id before processing. A duplicate (Stripe
  // retry, or our own retry of a 5xx response) is a no-op.
  const admin = createAdminClient();
  const { error: claimError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, event_type: event.type });

  if (claimError) {
    if (claimError.code === "23505") {
      // Already processed
      return NextResponse.json({ received: true, duplicate: true });
    }
    // Unknown DB error — let Stripe retry so we eventually claim the event.
    console.error("Failed to record Stripe event for idempotency:", claimError);
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 500 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const planId = session.metadata?.plan_id as PlanId;

        if (!userId || !planId) {
          console.error("Missing metadata in checkout session:", session.id);
          break;
        }

        if (session.subscription && session.customer) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          await upsertSubscription(userId, {
            plan_id: planId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            status: subscription.status as string,
            current_period_end: getPeriodEnd(subscription),
            cancel_at_period_end: subscription.cancel_at_period_end,
          });
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(subscription);

        if (!userId) {
          console.error(
            `Cannot resolve user for subscription ${subscription.id} (event ${event.type})`
          );
          break;
        }

        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceId ? getPlanByPriceId(priceId) : null;
        const planId = (plan?.id || subscription.metadata?.plan_id || "pro") as PlanId;

        await upsertSubscription(userId, {
          plan_id: planId,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          status: subscription.status as string,
          current_period_end: getPeriodEnd(subscription),
          cancel_at_period_end: subscription.cancel_at_period_end,
        });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = await resolveUserId(subscription);

        if (!userId) {
          console.error("Cannot resolve user for deleted subscription:", subscription.id);
          break;
        }

        // Honor any remaining paid period: keep the previous plan_id while
        // current_period_end is still in the future. isSubscriptionActive()
        // will grace status="canceled" with future period_end.
        const periodEnd = getPeriodEnd(subscription);
        const isInGracePeriod = new Date(periodEnd) > new Date();

        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceId ? getPlanByPriceId(priceId) : null;
        const planId: PlanId = isInGracePeriod
          ? ((plan?.id || subscription.metadata?.plan_id || "pro") as PlanId)
          : "free";

        await upsertSubscription(userId, {
          plan_id: planId,
          stripe_customer_id: subscription.customer as string,
          stripe_subscription_id: subscription.id,
          status: "canceled",
          current_period_end: periodEnd,
          cancel_at_period_end: false,
        });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof sub === "string" ? sub : sub?.id;

        if (subscriptionId) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = await resolveUserId(subscription);

          if (userId) {
            const priceId = subscription.items.data[0]?.price?.id;
            const plan = priceId ? getPlanByPriceId(priceId) : null;

            await upsertSubscription(userId, {
              plan_id: (plan?.id || "pro") as PlanId,
              stripe_customer_id: subscription.customer as string,
              stripe_subscription_id: subscription.id,
              status: subscription.status as string,
              current_period_end: getPeriodEnd(subscription),
              cancel_at_period_end: subscription.cancel_at_period_end,
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const sub = invoice.parent?.subscription_details?.subscription;
        const subscriptionId = typeof sub === "string" ? sub : sub?.id;

        if (subscriptionId) {
          const stripe = getStripe();
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          const userId = await resolveUserId(subscription);

          if (userId) {
            const priceId = subscription.items.data[0]?.price?.id;
            const plan = priceId ? getPlanByPriceId(priceId) : null;

            await upsertSubscription(userId, {
              plan_id: (plan?.id || "pro") as PlanId,
              stripe_customer_id: subscription.customer as string,
              stripe_subscription_id: subscription.id,
              status: "past_due",
              current_period_end: getPeriodEnd(subscription),
              cancel_at_period_end: subscription.cancel_at_period_end,
            });
          }
        }
        break;
      }

      default:
        break;
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(
      `Webhook processing error for event ${event.id} (${event.type}):`,
      error
    );
    Sentry.captureException(error, {
      tags: { stripe_event_id: event.id, stripe_event_type: event.type },
    });
    // Release the idempotency claim and return 500 so Stripe retries —
    // otherwise the claimed-but-unprocessed event would be lost forever.
    const { error: releaseError } = await admin
      .from("stripe_events")
      .delete()
      .eq("id", event.id);
    if (releaseError) {
      console.error(
        `Failed to release stripe_events claim for ${event.id}:`,
        releaseError
      );
    }
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
