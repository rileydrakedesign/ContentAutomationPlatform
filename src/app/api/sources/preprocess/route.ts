import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { preprocessTranscript } from "@/lib/openai";

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

    const body = await request.json();
    const { sourceId } = body as { sourceId: string };

    if (!sourceId) {
      return NextResponse.json(
        { error: "sourceId is required" },
        { status: 400 }
      );
    }

    // Fetch the source
    const { data: source, error: fetchError } = await supabase
      .from("sources")
      .select("*")
      .eq("id", sourceId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !source) {
      return NextResponse.json(
        { error: "Source not found" },
        { status: 404 }
      );
    }

    // Only preprocess voice memos
    if (source.type !== "VOICE_MEMO") {
      return NextResponse.json(
        { error: "Preprocessing is only available for voice memos" },
        { status: 400 }
      );
    }

    const transcript = source.raw_content;
    if (!transcript || !transcript.trim()) {
      return NextResponse.json(
        { error: "Voice memo has no transcript content" },
        { status: 400 }
      );
    }

    // Run preprocessing
    const result = await preprocessTranscript(transcript);

    // Optionally store the preprocessing result in the source metadata
    await supabase
      .from("sources")
      .update({
        metadata: {
          ...((source.metadata as Record<string, unknown>) || {}),
          preprocessed: {
            structure: result.structure,
            segmentCount: result.segments.length,
            summary: result.summary,
            timestamp: new Date().toISOString(),
          },
        },
      })
      .eq("id", sourceId)
      .eq("user_id", user.id);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to preprocess transcript:", error);
    return NextResponse.json(
      { error: "Failed to preprocess transcript" },
      { status: 500 }
    );
  }
}
