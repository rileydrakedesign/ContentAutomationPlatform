import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import {
  generateFromVoiceMemo,
  analyzeOnly,
  FragmentContentError,
  type FrameworkType,
} from "@/lib/openai";

type RequestMode = "generate" | "analyze";

interface GenerateFromMemoRequest {
  /** The voice memo transcript text */
  transcript: string;
  /** Mode: "analyze" to just analyze, "generate" to analyze + generate */
  mode?: RequestMode;
  /** Optional: override the auto-detected framework */
  overrideFramework?: FrameworkType;
  /** Optional: override the auto-detected format */
  overrideFormat?: "X_POST" | "X_THREAD";
  /** Optional: source ID if this transcript is already saved as a source */
  sourceId?: string;
}

/**
 * POST /api/drafts/generate-from-memo
 *
 * Enhanced voice memo generation endpoint.
 * Analyzes the transcript and generates content using the appropriate framework.
 *
 * Modes:
 * - "analyze": Returns only the analysis (preview what would be generated)
 * - "generate": Analyzes and generates content, saves as draft
 */
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

    const body = (await request.json()) as GenerateFromMemoRequest;
    const {
      transcript,
      mode = "generate",
      overrideFramework,
      overrideFormat,
      sourceId,
    } = body;

    if (!transcript || transcript.trim().length === 0) {
      return NextResponse.json(
        { error: "Transcript is required" },
        { status: 400 }
      );
    }

    // Analyze-only mode - just return the analysis
    if (mode === "analyze") {
      const analysis = await analyzeOnly(transcript);
      return NextResponse.json({
        mode: "analyze",
        analysis,
        suggestedAction:
          analysis.suggestedFormat === "FRAGMENT"
            ? "save_as_note"
            : "ready_to_generate",
      });
    }

    // Generate mode - analyze + generate + save
    try {
      const result = await generateFromVoiceMemo(transcript, {
        overrideFramework,
        overrideFormat,
      });

      // If no sourceId provided, create a source entry for the transcript
      let effectiveSourceId = sourceId;
      if (!effectiveSourceId) {
        const { data: source, error: sourceError } = await supabase
          .from("sources")
          .insert({
            user_id: user.id,
            type: "VOICE_MEMO",
            raw_content: transcript,
            metadata: {
              analyzedAt: new Date().toISOString(),
              contentDensity: result.analysis.contentDensity,
              intentType: result.analysis.intentType,
            },
          })
          .select()
          .single();

        if (sourceError) throw sourceError;
        effectiveSourceId = source.id;
      }

      // Save the draft
      const { data: draft, error: insertError } = await supabase
        .from("drafts")
        .insert({
          user_id: user.id,
          type: result.format,
          status: "GENERATED",
          content: result.content,
          source_ids: [effectiveSourceId],
          metadata: {
            frameworkUsed: result.frameworkUsed,
            analysis: {
              coreIdea: result.analysis.coreIdea,
              supportingPoints: result.analysis.supportingPoints,
              contentDensity: result.analysis.contentDensity,
              intentType: result.analysis.intentType,
              confidence: result.analysis.confidence,
            },
          },
        })
        .select()
        .single();

      if (insertError) throw insertError;

      return NextResponse.json(
        {
          mode: "generate",
          draft,
          analysis: result.analysis,
          frameworkUsed: result.frameworkUsed,
        },
        { status: 201 }
      );
    } catch (error) {
      // Handle fragment content (not ready for posting)
      if (error instanceof FragmentContentError) {
        return NextResponse.json(
          {
            error: "Content is a fragment - not ready for posting",
            analysis: error.analysis,
            suggestedAction: "save_as_note",
            hint: "Use overrideFormat to force generation, or save this as a note for later",
          },
          { status: 422 }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Failed to process voice memo:", error);
    return NextResponse.json(
      {
        error: "Failed to process voice memo",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
