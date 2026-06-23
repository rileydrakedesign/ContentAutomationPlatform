import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { getCredits, effectivePlan } from "@/lib/billing/credits";
import { CREDIT_PACKS } from "@/types/subscription";

// GET /api/settings/credits — Credits balance + purchasable packs (dashboard).
export async function GET() {
  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const [credits, plan] = await Promise.all([
      getCredits(user.id),
      effectivePlan(user.id),
    ]);

    return NextResponse.json({
      plan: plan.id,
      balance: credits.total,
      allowance_remaining: credits.balance,
      pack_balance: credits.packBalance,
      monthly_allowance: credits.monthlyAllowance,
      resets_at: credits.resetsAt,
      packs: Object.values(CREDIT_PACKS).map((p) => ({
        id: p.id,
        credits: p.credits,
        price: p.price,
        available: !!p.stripePriceId,
      })),
    });
  } catch (e) {
    console.error("Failed to load credits:", e);
    Sentry.captureException(e, { tags: { route: "settings/credits" } });
    return NextResponse.json({ error: "Failed to load credits" }, { status: 500 });
  }
}
