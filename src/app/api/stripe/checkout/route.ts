import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/server";
import { PLANS, type PlanId } from "@/types/subscription";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const planId = body?.planId as PlanId;

    if (!planId || !PLANS[planId] || !PLANS[planId].stripePriceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      console.error("NEXT_PUBLIC_APP_URL is not set");
      return NextResponse.json(
        { error: "Server misconfigured" },
        { status: 500 }
      );
    }

    const plan = PLANS[planId];
    const stripe = getStripe();
    const admin = createAdminClient();

    // Check if user already has a Stripe customer ID
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let customerId = sub?.stripe_customer_id;

    if (!customerId && user.email) {
      // Re-use any Stripe customer that already exists for this email so we
      // don't create duplicates when the local subscriptions row is missing.
      const existing = await stripe.customers.list({
        email: user.email,
        limit: 1,
      });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
      }
    }

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    // Persist the customer id so the next checkout call (if the user closes
    // the page before paying) doesn't end up creating yet another customer.
    await admin.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
        plan_id: sub ? undefined : "free",
        status: sub ? undefined : "active",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: plan.stripePriceId!, quantity: 1 }],
      success_url: `${appUrl}/settings?success=subscribed&plan=${planId}`,
      cancel_url: `${appUrl}/pricing`,
      // Stripe Tax: collect billing address + tax id, compute tax automatically.
      // Requires Stripe Tax to be activated in the dashboard. customer_update
      // is required so automatic_tax can read/update the customer's address.
      automatic_tax: { enabled: true },
      tax_id_collection: { enabled: true },
      billing_address_collection: "required",
      customer_update: { address: "auto", name: "auto" },
      subscription_data: {
        metadata: { supabase_user_id: user.id, plan_id: planId },
      },
      metadata: { supabase_user_id: user.id, plan_id: planId },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Stripe checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
