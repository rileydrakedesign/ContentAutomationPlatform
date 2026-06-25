import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 60;
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireAiGeneration } from "@/lib/stripe/gate";
import { runPrepublishRead } from "@/lib/analysis/prepublish-read";
import { getDualAuthUser } from "@/lib/api/dual-auth";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/prepublish-read — Read a draft before publishing: how much it
// resembles the user's top performers + how X's algorithm will treat it
// (reply-driving? link-penalized? dwell-worthy?). The honest answer to "predict
// engagement before I post" — a resemblance + algorithm-fit read, not a like
// forecast. Dashboard (cookie) and Chrome extension (Bearer); the agentic
// pipeline runs the same read inline.
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getDualAuthUser(request);

    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const gateError = await requireAiGeneration(user.id, "prepublish-read");
    if (gateError) return gateError;

    let body: { text?: string; draft_type?: string; has_media?: boolean };
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
    const draftType = body.draft_type === "X_THREAD" ? "X_THREAD" : "X_POST";

    const result = await runPrepublishRead(supabase, user.id, text, {
      draftType,
      hasMedia: Boolean(body.has_media),
    });

    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Pre-publish read failed:", error);
    Sentry.captureException(error, { tags: { route: "prepublish-read" } });
    return NextResponse.json({ error: "Pre-publish read failed" }, { status: 500, headers: corsHeaders });
  }
}
