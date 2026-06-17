import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireAiGeneration } from "@/lib/stripe/gate";
import { runVoiceCheck } from "@/lib/analysis/voice-check";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/voice/check — Score a draft against the user's tuned voice
// (assembled voice prompt + enabled patterns). The web-app side of the tuner;
// agents use POST /api/v1/voice/check.
export async function POST(request: NextRequest) {
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

    const gateError = await requireAiGeneration(user.id, "voice-check");
    if (gateError) return gateError;

    let body: { text?: string; voice_type?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400, headers: corsHeaders }
      );
    }

    const text = String(body.text || "").trim();
    if (text.length < 5) {
      return NextResponse.json(
        { error: "Draft text must be at least 5 characters" },
        { status: 400, headers: corsHeaders }
      );
    }
    const voiceType = body.voice_type === "reply" ? "reply" : "post";

    const result = await runVoiceCheck(supabase, user.id, text, voiceType);

    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Voice check failed:", error);
    return NextResponse.json(
      { error: "Voice check failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
