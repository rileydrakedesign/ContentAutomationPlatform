import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/stripe/subscription";
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

    return NextResponse.json({
      plan_id: sub.plan_id,
      plan_name: plan.name,
      status: sub.status,
      current_period_end: sub.current_period_end,
      has_billing: !!sub.stripe_customer_id,
      limits: plan.limits,
    });
  } catch (error) {
    console.error("Failed to fetch subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}
