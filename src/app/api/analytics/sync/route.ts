import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { requireFeature } from "@/lib/stripe/gate";
import { syncUserTimeline } from "@/lib/analysis/timeline-sync";
import {
  CREDIT_COSTS,
  requireCredits,
  refundCredits,
} from "@/lib/billing/credits";

// POST /api/analytics/sync - User-triggered API analytics sync
export async function POST() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gateError = await requireFeature(user.id, "xApiSync");
    if (gateError) return gateError;

    // Hits the paid X API. Charge before syncing and refund on failure so the
    // dashboard can't run up unbounded X spend — same metering as
    // /api/v1/analytics/sync.
    const charge = await requireCredits(
      user.id,
      CREDIT_COSTS["analytics.sync"],
      "analytics.sync"
    );
    if (charge instanceof NextResponse) return charge;

    let result: Awaited<ReturnType<typeof syncUserTimeline>>;
    try {
      result = await syncUserTimeline(supabase, user.id);
    } catch (error) {
      await refundCredits(user.id, charge.charged, "refund.sync_failed");
      throw error;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to sync analytics:", error);
    Sentry.captureException(error, { tags: { route: "analytics/sync" } });
    return NextResponse.json(
      { error: "Failed to sync analytics. Please try again." },
      { status: 500 }
    );
  }
}
