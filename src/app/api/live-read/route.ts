import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 60;
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireFeature } from "@/lib/stripe/gate";
import { runLiveRead } from "@/lib/analysis/live-read";
import { getDualAuthUser } from "@/lib/api/dual-auth";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/live-read — the writing assistant's L3 pass: the on-demand LLM read
// returning anchored voice-drift findings (verbatim quotes), rewrites, and
// missing high-lift patterns. The live 0-100 voice/performance SCORES come from
// the cheap L2 embedding route (/api/assistant/score); the deterministic
// algorithm flags are computed client-side (Tier 0). This route is rare
// (panel-open / low-score-idle / explicit "why?"), never per-pause.
//
// SUBSCRIPTION-GATED (requireFeature), NOT metered — the writing loop can't have
// a credit meter ticking, and consuming an AI-generation slot here would 429 a
// user mid-sentence and block their real generation (locked decision). Read-first
// cached server-side by draft_hash; the client also caches by text.
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getDualAuthUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const gateError = await requireFeature(user.id, "writingAssistant");
    if (gateError) return gateError;

    let body: {
      text?: string;
      voice_type?: string;
      draft_type?: string;
      has_media?: boolean;
      parent_text?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400, headers: corsHeaders });
    }

    const text = String(body.text || "").trim();
    if (text.length < 5) {
      return NextResponse.json(
        { error: "Draft text must be at least 5 characters" },
        { status: 400, headers: corsHeaders }
      );
    }
    const voiceType = body.voice_type === "reply" ? "reply" : "post";
    const draftType = body.draft_type === "X_THREAD" ? "X_THREAD" : "X_POST";
    // Reply mode may carry the post being replied to (G6: the extension's
    // in-X reply composer sends it), so the judge reads the reply in context.
    // Capped — it's prompt context, not content we store.
    const parentText =
      voiceType === "reply" ? String(body.parent_text || "").trim().slice(0, 1000) : "";

    const result = await runLiveRead(supabase, user.id, text, voiceType, {
      draftType,
      parentText: parentText || undefined,
    });

    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Live read failed:", error);
    Sentry.captureException(error, { tags: { route: "live-read" } });
    return NextResponse.json({ error: "Live read failed" }, { status: 500, headers: corsHeaders });
  }
}
