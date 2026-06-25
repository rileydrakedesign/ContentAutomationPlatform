import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 30;
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireFeature } from "@/lib/stripe/gate";
import { scoreDraft, refreshVoiceVectors } from "@/lib/analysis/assistant/vectors";
import { getDualAuthUser } from "@/lib/api/dual-auth";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/assistant/score — the writing assistant's L2 pass: embed the draft and
// cosine it against the user's cached voice + winners centroids → a live 0-100
// Voice Match and a 0-100 resemblance (→ Performance grade). This is the call that
// fires on every typing pause, so it must be cheap: one small embedding, no LLM.
//
// SUBSCRIPTION-GATED (requireFeature), NOT metered — table-stakes always-on
// scoring can't tick a credit on every pause. On cold start (no centroid yet) it
// returns neutral scores and kicks a background refresh so the next call is real.
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getDualAuthUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const gateError = await requireFeature(user.id, "writingAssistant");
    if (gateError) return gateError;

    let body: { text?: string; draft_type?: string };
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

    const result = await scoreDraft(supabase, user.id, text);

    // Cold start: no centroid yet. Fire a refresh without blocking the response so
    // the next pause gets a real score. Best-effort — a failed refresh just means
    // the next call also returns neutral and retries.
    if (result.cold_start) {
      refreshVoiceVectors(supabase, user.id).catch((e) =>
        console.error("assistant/score cold-start refresh:", e)
      );
    }

    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Assistant score failed:", error);
    Sentry.captureException(error, { tags: { route: "assistant-score" } });
    return NextResponse.json({ error: "Score failed" }, { status: 500, headers: corsHeaders });
  }
}
