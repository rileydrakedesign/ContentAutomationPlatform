import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

// Simple endpoint for iOS Shortcut to POST transcripts
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Support both JSON and plain text
    const contentType = request.headers.get("content-type") || "";

    let transcript: string;
    let title: string | null = null;

    if (contentType.includes("application/json")) {
      const body = await request.json();
      transcript = body.transcript || body.text || "";
      title = body.title || null;
    } else {
      // Plain text body
      transcript = await request.text();
    }

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: "No transcript provided" },
        { status: 400 }
      );
    }

    const { data: source, error } = await supabase
      .from("sources")
      .insert({
        user_id: user.id,
        type: "VOICE_MEMO",
        raw_content: transcript.trim(),
        metadata: {
          title: title,
          source: "ios_shortcut",
          capturedAt: new Date().toISOString(),
        },
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({
      success: true,
      id: source.id,
      message: "Transcript saved"
    }, { status: 201 });

  } catch (error) {
    console.error("Failed to save transcript:", error);
    return NextResponse.json(
      { error: "Failed to save transcript" },
      { status: 500 }
    );
  }
}
