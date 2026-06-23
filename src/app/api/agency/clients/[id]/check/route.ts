import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireClient } from "@/lib/agency/guard";
import { runVoiceCheck } from "@/lib/analysis/voice-check";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function OPTIONS() {
  return handleCors();
}

// POST /api/agency/clients/[id]/check — voice-check a draft against THIS
// client's tuned voice (isolated). Same runVoiceCheck core as everywhere else.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireClient(id);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const body = await request.json().catch(() => ({}));
    const text = String(body.text || "").trim();
    if (text.length < 5) {
      return NextResponse.json({ error: "Draft text must be at least 5 characters" }, { status: 400, headers: corsHeaders });
    }
    const voiceType = body.voice_type === "reply" ? "reply" : "post";
    const result = await runVoiceCheck(ctx.admin, id, text, voiceType);
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "agency/clients/check" } });
    return NextResponse.json({ error: "Voice check failed" }, { status: 500, headers: corsHeaders });
  }
}
