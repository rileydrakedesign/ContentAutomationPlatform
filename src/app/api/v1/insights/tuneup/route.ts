import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  CREDIT_COSTS,
  requireCredits,
  refundCredits,
  withCreditHeaders,
} from "@/lib/billing/credits";
import { requireFeature } from "@/lib/stripe/gate";
import { runVoiceTuneup } from "@/lib/analysis/tuneup";

export const maxDuration = 60;

export const OPTIONS = apiOptions;

// POST /api/v1/insights/tuneup — Run the full Voice Tune-Up (refresh →
// pattern extract → niche analyze) and return the Voice Report. The agent
// surface of the analyze half of the loop (run_tuneup MCP tool).
// Costs 5 credits (multiple model calls).
export const POST = withApiAuth(["voice:write"], async ({ auth }) => {
  const charge = await requireCredits(
    auth.userId,
    CREDIT_COSTS["insights.tuneup"],
    "insights.tuneup"
  );
  if (charge instanceof NextResponse) return charge;

  const supabase = createAdminClient();

  try {
    // Pattern extraction is a Pro feature — skipped gracefully, not fatal
    const patternGate = await requireFeature(auth.userId, "patternExtraction");

    const result = await runVoiceTuneup(supabase, auth.userId, {
      allowPatternExtraction: !patternGate,
    });

    if (!result.ok) {
      // The tune-up couldn't run (e.g. not enough posts) — don't charge.
      await refundCredits(auth.userId, charge.charged, "refund.tuneup_failed");
      return apiError(result.error, "tuneup_failed", result.status);
    }

    return withCreditHeaders(apiSuccess({ report: result.report }), charge);
  } catch (e) {
    await refundCredits(auth.userId, charge.charged, "refund.tuneup_failed");
    return apiError(
      `Voice tune-up failed: ${e instanceof Error ? e.message : "unknown error"}`,
      "tuneup_failed",
      502
    );
  }
});
