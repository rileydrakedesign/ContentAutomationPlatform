import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getUserSubscription, checkAiGenerationLimit } from "@/lib/stripe/subscription";
import { PLANS } from "@/types/subscription";

export async function GET() {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const sub = await getUserSubscription(user.id);
    const plan = PLANS[sub.plan_id] || PLANS.free;

    // Check if subscription is effectively active (includes past_due grace period)
    const isActive =
      sub.status === "active" ||
      sub.status === "trialing" ||
      (sub.status === "past_due" &&
        sub.current_period_end &&
        new Date(sub.current_period_end) > new Date());
    const effectivePlan = isActive ? plan : PLANS.free;

    const { remaining, limit } = await checkAiGenerationLimit(user.id);
    const used = limit === Infinity ? 0 : limit - remaining;

    return NextResponse.json({
      plan_id: isActive ? sub.plan_id : "free",
      plan_name: effectivePlan.name,
      status: sub.status,
      current_period_end: sub.current_period_end,
      has_billing: !!sub.stripe_customer_id,
      limits: effectivePlan.limits,
      usage: {
        used,
        limit: limit === Infinity ? null : limit,
        remaining: remaining === Infinity ? null : remaining,
        unlimited: limit === Infinity,
      },
    });
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
