import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { getValidAccessToken } from "@/lib/x-api";
import { syncUserTimeline } from "@/lib/analysis/timeline-sync";
import { runVoiceTuneup } from "@/lib/analysis/tuneup";
import { voiceConfidence } from "@/lib/analysis/voice-confidence";
import { requireFeature } from "@/lib/stripe/gate";
import { checkRateLimit } from "@/lib/api/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function OPTIONS() {
  return handleCors();
}

// POST /api/x/bootstrap — First-session value for a freshly-connected account.
// Pulls the user's timeline (ungated — it's their own posts, the only way to
// have anything to learn from) and runs a full Voice Tune-Up so the very first
// session shows real niche / patterns / top posts — no manual CSV upload.
//
// Triggered by the dashboard right after X connect. Idempotent enough to re-run:
// tune-up is non-destructive (examples re-ranked, patterns versioned by batch).
export async function POST() {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Per-user throttle — bootstrap runs a full timeline pull + Voice Tune-Up
    // (up to 300s of X + LLM work); back-to-back runs are never legitimate.
    const rl = await checkRateLimit(`x-bootstrap:${user.id}`, 2);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "A tune-up is already running — please wait a moment." },
        { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } }
      );
    }

    // Must have a live X connection to have anything to analyze.
    try {
      await getValidAccessToken(user.id);
    } catch {
      return NextResponse.json(
        { error: "X account not connected" },
        { status: 400, headers: corsHeaders }
      );
    }

    // 1. Pull the timeline into the analyzable pool (best-effort — a sync
    //    failure shouldn't block tuning on whatever's already captured).
    let synced = 0;
    try {
      ({ synced } = await syncUserTimeline(supabase, user.id));
    } catch (e) {
      console.warn("x/bootstrap: timeline sync failed (continuing):", e);
    }

    // 2. Full tune-up. Pattern extraction is Pro — skipped gracefully for free.
    const patternGate = await requireFeature(user.id, "patternExtraction");
    const result = await runVoiceTuneup(supabase, user.id, {
      allowPatternExtraction: !patternGate,
    });

    if (!result.ok) {
      // No / too-few posts to analyze — the thin-history cold-start case.
      return NextResponse.json(
        { ok: false, synced, posts_analyzed: 0, confidence: "thin", error: result.error },
        { status: 200, headers: corsHeaders }
      );
    }

    // Voice confidence — honestly frame how much of the user's own data backs
    // this first tune, so a thin-history account isn't over-promised fidelity.
    const postsAnalyzed = result.report.steps.posts_analyzed;
    const confidence = voiceConfidence(postsAnalyzed).level;

    return NextResponse.json(
      { ok: true, synced, posts_analyzed: postsAnalyzed, confidence, report: result.report },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("x/bootstrap failed:", error);
    Sentry.captureException(error, { tags: { route: "x/bootstrap" } });
    return NextResponse.json(
      { error: "Bootstrap failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
