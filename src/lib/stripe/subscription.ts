import { createAdminClient } from "@/lib/supabase/server";
import type { PlanId, UserSubscription } from "@/types/subscription";
import { PLANS, isSubscriptionActive } from "@/types/subscription";

const DEFAULT_SUBSCRIPTION: UserSubscription = {
  plan_id: "free",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  status: "active",
  current_period_end: null,
  cancel_at_period_end: false,
};

/**
 * Get the current user's subscription. Returns free plan if no subscription exists.
 */
export async function getUserSubscription(
  userId: string
): Promise<UserSubscription> {
  const supabase = await createAdminClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select(
      "plan_id, stripe_customer_id, stripe_subscription_id, status, current_period_end, cancel_at_period_end"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return DEFAULT_SUBSCRIPTION;
  }

  return data as UserSubscription;
}

/**
 * Check if a user has access to a specific feature based on their plan.
 */
export async function checkFeatureAccess(
  userId: string,
  feature: keyof UserSubscription["plan_id"] extends never
    ? keyof (typeof PLANS)["pro"]["limits"]
    : never
): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  const plan = PLANS[sub.plan_id] || PLANS.free;
  const effectivePlan = isSubscriptionActive(sub) ? plan : PLANS.free;

  return effectivePlan.limits[feature as keyof typeof plan.limits] as boolean;
}

/**
 * Check if a user can make more AI generations today.
 */
export async function checkAiGenerationLimit(userId: string): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
}> {
  const sub = await getUserSubscription(userId);
  const plan = PLANS[sub.plan_id] || PLANS.free;
  const effectivePlan = isSubscriptionActive(sub) ? plan : PLANS.free;

  if (effectivePlan.limits.aiGenerationsPerDay === Infinity) {
    return { allowed: true, remaining: Infinity, limit: Infinity };
  }

  const supabase = await createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { count } = await supabase
    .from("ai_usage_log")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", `${today}T00:00:00Z`);

  const used = count ?? 0;
  const remaining = Math.max(0, effectivePlan.limits.aiGenerationsPerDay - used);

  return {
    allowed: remaining > 0,
    remaining,
    limit: effectivePlan.limits.aiGenerationsPerDay,
  };
}

/**
 * Log an AI generation for rate limiting. `weight` lets a heavier action
 * consume multiple daily-quota slots (e.g. the Agent pipeline counts as 3) by
 * writing that many usage rows in one insert.
 */
export async function logAiGeneration(
  userId: string,
  endpoint: string,
  weight = 1
): Promise<void> {
  const supabase = await createAdminClient();
  const now = new Date().toISOString();
  const rows = Array.from({ length: Math.max(1, weight) }, () => ({
    user_id: userId,
    endpoint,
    created_at: now,
  }));

  await supabase.from("ai_usage_log").insert(rows);
}

/**
 * Upsert a subscription record after Stripe webhook events.
 *
 * Pass eventCreated (Stripe event.created, epoch seconds) for handlers that
 * write data taken from the event payload: a delayed/out-of-order older event
 * must not overwrite a newer one. Handlers that re-fetch the subscription from
 * the Stripe API should omit it (their data is current by construction).
 */
export async function upsertSubscription(
  userId: string,
  data: {
    plan_id: PlanId;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    status: string;
    current_period_end: string;
    cancel_at_period_end?: boolean;
  },
  eventCreated?: number
): Promise<void> {
  const supabase = await createAdminClient();

  const row = {
    user_id: userId,
    ...data,
    cancel_at_period_end: data.cancel_at_period_end ?? false,
    updated_at: new Date().toISOString(),
    stripe_event_created: eventCreated
      ? new Date(eventCreated * 1000).toISOString()
      : null,
  };

  if (row.stripe_event_created) {
    // Guarded update: only touch rows whose last-applied event is not newer.
    const { data: updated, error } = await supabase
      .from("subscriptions")
      .update(row)
      .eq("user_id", userId)
      .or(
        `stripe_event_created.is.null,stripe_event_created.lte.${row.stripe_event_created}`
      )
      .select("user_id");

    if (error) {
      console.error("Failed to update subscription:", error);
      throw error;
    }
    if (updated && updated.length > 0) {
      await syncApiKeyRateLimits(userId);
      return;
    }

    const { data: existing } = await supabase
      .from("subscriptions")
      .select("stripe_event_created")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      console.warn(
        `Skipping out-of-order Stripe event for user ${userId}: row already at ${existing.stripe_event_created}, event at ${row.stripe_event_created}`
      );
      return;
    }
    // No row yet — fall through to insert via upsert below.
  }

  const { error } = await supabase
    .from("subscriptions")
    .upsert(row, { onConflict: "user_id" });

  if (error) {
    console.error("Failed to upsert subscription:", error);
    throw error;
  }

  await syncApiKeyRateLimits(userId);
}

/**
 * Keep per-key rate limits in step with the user's effective plan. Called on
 * every subscription change; best-effort (credits + daily caps are the
 * economic backstop, the per-minute limit is just throttling).
 */
export async function syncApiKeyRateLimits(userId: string): Promise<void> {
  try {
    const supabase = await createAdminClient();
    const sub = await getUserSubscription(userId);
    const plan = PLANS[sub.plan_id] || PLANS.free;
    const effective = isSubscriptionActive(sub) ? plan : PLANS.free;

    await supabase
      .from("api_keys")
      .update({ rate_limit: effective.limits.apiRateLimit })
      .eq("user_id", userId)
      .is("revoked_at", null);
  } catch (e) {
    console.error("Failed to sync API key rate limits:", e);
  }
}
