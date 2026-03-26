import { createAdminClient } from "@/lib/supabase/server";
import type { PlanId, UserSubscription } from "@/types/subscription";
import { PLANS } from "@/types/subscription";

const DEFAULT_SUBSCRIPTION: UserSubscription = {
  plan_id: "free",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  status: "active",
  current_period_end: null,
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
    .select("plan_id, stripe_customer_id, stripe_subscription_id, status, current_period_end")
    .eq("user_id", userId)
    .single();

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

  if (sub.status !== "active" && sub.status !== "trialing") {
    // Canceled/past_due users fall back to free
    return PLANS.free.limits[feature as keyof typeof PLANS.free.limits] as boolean;
  }

  const plan = PLANS[sub.plan_id];
  if (!plan) return false;

  return plan.limits[feature as keyof typeof plan.limits] as boolean;
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

  if (plan.limits.aiGenerationsPerDay === Infinity) {
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
  const remaining = Math.max(0, plan.limits.aiGenerationsPerDay - used);

  return {
    allowed: remaining > 0,
    remaining,
    limit: plan.limits.aiGenerationsPerDay,
  };
}

/**
 * Log an AI generation for rate limiting.
 */
export async function logAiGeneration(
  userId: string,
  endpoint: string
): Promise<void> {
  const supabase = await createAdminClient();

  await supabase.from("ai_usage_log").insert({
    user_id: userId,
    endpoint,
    created_at: new Date().toISOString(),
  });
}

/**
 * Upsert a subscription record after Stripe webhook events.
 */
export async function upsertSubscription(
  userId: string,
  data: {
    plan_id: PlanId;
    stripe_customer_id: string;
    stripe_subscription_id: string;
    status: string;
    current_period_end: string;
  }
): Promise<void> {
  const supabase = await createAdminClient();

  const { error } = await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      ...data,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to upsert subscription:", error);
    throw error;
  }
}
