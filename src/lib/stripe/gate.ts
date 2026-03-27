import { NextResponse } from "next/server";
import { getUserSubscription, checkAiGenerationLimit, logAiGeneration } from "./subscription";
import { PLANS } from "@/types/subscription";

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

  const isActive =
    sub.status === "active" ||
    sub.status === "trialing" ||
    (sub.status === "past_due" &&
      sub.current_period_end &&
      new Date(sub.current_period_end) > new Date());
  const effectivePlan = isActive ? plan : PLANS.free;

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
 * Check and consume an AI generation quota. Returns an error response if limit reached.
 */
export async function requireAiGeneration(
  userId: string,
  endpoint: string
): Promise<NextResponse | null> {
  const { allowed, remaining, limit } = await checkAiGenerationLimit(userId);

  if (!allowed) {
    return NextResponse.json(
      {
        error: "Daily AI generation limit reached",
        code: "AI_LIMIT",
        remaining: 0,
        limit,
        upgrade_url: "/pricing",
      },
      { status: 429 }
    );
  }

  // Log the usage
  await logAiGeneration(userId, endpoint);

  return null; // Access granted
}
