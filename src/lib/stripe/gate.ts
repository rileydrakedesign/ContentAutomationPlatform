import { NextResponse } from "next/server";
import { getUserSubscription, checkAiGenerationLimit, logAiGeneration } from "./subscription";
import { PLANS, isSubscriptionActive } from "@/types/subscription";

type FeatureKey = keyof typeof PLANS.pro.limits;

/**
 * Check if a user has access to a paid feature. Returns an error response if not.
 */
export async function requireFeature(
  userId: string,
  feature: FeatureKey
): Promise<NextResponse | null> {
  const sub = await getUserSubscription(userId);
  const plan = PLANS[sub.plan_id] || PLANS.free;
  const effectivePlan = isSubscriptionActive(sub) ? plan : PLANS.free;

  const hasAccess = effectivePlan.limits[feature];

  if (!hasAccess) {
    return NextResponse.json(
      {
        error: "Upgrade required",
        code: "PLAN_LIMIT",
        feature,
        current_plan: effectivePlan.id,
        upgrade_url: "/pricing",
      },
      { status: 403 }
    );
  }

  return null; // Access granted
}

/**
 * Check and consume an AI generation quota. Returns an error response if the
 * limit is reached. `weight` is how many daily slots the action costs — Quick
 * generation is 1, the Agent pipeline is 3 — and the run is blocked unless at
 * least `weight` slots remain.
 */
export async function requireAiGeneration(
  userId: string,
  endpoint: string,
  weight = 1
): Promise<NextResponse | null> {
  const { allowed, remaining, limit } = await checkAiGenerationLimit(userId);

  if (!allowed || remaining < weight) {
    return NextResponse.json(
      {
        error: "Daily AI generation limit reached",
        code: "AI_LIMIT",
        remaining: Math.max(0, remaining),
        limit,
        upgrade_url: "/pricing",
      },
      { status: 429 }
    );
  }

  // Log the usage (weight rows so heavier actions consume more of the quota)
  await logAiGeneration(userId, endpoint, weight);

  return null; // Access granted
}
