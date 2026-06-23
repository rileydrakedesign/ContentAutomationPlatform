import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 60;
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireAiGeneration, requireFeature } from "@/lib/stripe/gate";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { runVoiceTuneup } from "@/lib/analysis/tuneup";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/insights/tuneup — One-click Voice Tune-Up: refresh voice examples
// → extract patterns → analyze niche (sequentially, so each step feeds the
// next), then return the full Voice Report.
export async function POST() {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const gateError = await requireAiGeneration(user.id, "voice-tuneup");
    if (gateError) return gateError;

    // Burst guard — a tune-up runs a multi-model pipeline; back-to-back runs
    // are never legitimate and Pro daily generations are unlimited.
    const rl = await checkRateLimit(`voice-tuneup:${user.id}`, 3);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "A tune-up just ran — please wait a moment." },
        { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } }
      );
    }

    // Pattern extraction is a Pro feature — skipped gracefully, not fatal
    const patternGate = await requireFeature(user.id, "patternExtraction");

    const result = await runVoiceTuneup(supabase, user.id, {
      allowPatternExtraction: !patternGate,
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { report: result.report },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Voice tune-up failed:", error);
    Sentry.captureException(error, { tags: { route: "insights/tuneup" } });
    return NextResponse.json(
      { error: "Voice tune-up failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
