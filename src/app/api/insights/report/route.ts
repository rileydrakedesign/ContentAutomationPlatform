import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 30;
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import {
  assembleVoiceReportFromStoredState,
  deriveReportSteps,
  hasStoredVoiceReport,
} from "@/lib/analysis/tuneup";

export async function OPTIONS() {
  return handleCors();
}

// GET /api/insights/report — the latest Voice Report WITHOUT re-running the
// 5-credit tune-up. Free + read-only: it rebuilds the report from already-stored
// state (niche profile, enabled patterns, top posts, cadence, feedback,
// freshness) using the exact same assembler the tune-up calls after it writes,
// so what you see here matches the last analyzed state. Returns 404 when no
// analysis has run yet, so the client can show the "run your first tune-up" CTA.
export async function GET() {
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

    const exists = await hasStoredVoiceReport(supabase, user.id);
    if (!exists) {
      return NextResponse.json(
        { error: "No Voice Report yet. Run a Voice Tune-Up to generate one." },
        { status: 404, headers: corsHeaders }
      );
    }

    const steps = await deriveReportSteps(supabase, user.id);
    const report = await assembleVoiceReportFromStoredState(supabase, user.id, steps);

    return NextResponse.json(
      { report },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to load Voice Report:", error);
    Sentry.captureException(error, { tags: { route: "insights/report" } });
    return NextResponse.json(
      { error: "Failed to load Voice Report" },
      { status: 500, headers: corsHeaders }
    );
  }
}
