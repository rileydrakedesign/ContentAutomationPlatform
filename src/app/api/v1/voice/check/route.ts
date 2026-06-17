import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import {
  CREDIT_COSTS,
  requireCredits,
  refundCredits,
  withCreditHeaders,
} from "@/lib/billing/credits";
import { runVoiceCheck } from "@/lib/analysis/voice-check";

export const maxDuration = 60;

export const OPTIONS = apiOptions;

// POST /api/v1/voice/check — Score a draft against the user's tuned voice.
// The agent surface of the tuner (check_draft MCP tool). Costs 3 credits.
export const POST = withApiAuth(["voice:read"], async ({ auth, request }) => {
  let body: { text?: string; voice_type?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const text = String(body.text || "").trim();
  if (text.length < 5) {
    return apiError("Draft text must be at least 5 characters", "validation_error", 400);
  }
  const voiceType = body.voice_type === "reply" ? "reply" : "post";

  // Debit after validation (a 400 shouldn't cost credits); refunded if the
  // model call fails.
  const charge = await requireCredits(
    auth.userId,
    CREDIT_COSTS["voice.check"],
    "voice.check"
  );
  if (charge instanceof NextResponse) return charge;

  const supabase = createAdminClient();

  try {
    const result = await runVoiceCheck(supabase, auth.userId, text, voiceType);
    return withCreditHeaders(
      apiSuccess({ voice_type: voiceType, ...result }),
      charge
    );
  } catch (e) {
    await refundCredits(auth.userId, charge.charged, "refund.voice_check_failed");
    return apiError(
      `Voice check failed: ${e instanceof Error ? e.message : "unknown error"}`,
      "voice_check_failed",
      502
    );
  }
});
