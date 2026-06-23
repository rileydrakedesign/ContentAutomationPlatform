import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 60;
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireAiGeneration, requireFeature } from "@/lib/stripe/gate";
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
