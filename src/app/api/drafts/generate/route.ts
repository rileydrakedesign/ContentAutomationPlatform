import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import {
  generateContent,
  generateFromVoiceMemo,
  FragmentContentError,
  buildStylePrompt,
  type FrameworkType,
  type TranscriptSegment,
} from "@/lib/openai";
import type { StyleReference, InspirationPost } from "@/types/inspiration";
import type { AIProvider } from "@/lib/ai";

type DraftType = "X_POST" | "X_THREAD" | "REEL_SCRIPT";
type SourceType = "VOICE_MEMO" | "INSPIRATION" | "NEWS";

interface SourceMaterial {
  id: string;
  type: SourceType;
  raw_content: string | null;
  metadata: Record<string, unknown> | null;
}

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
    const { sourceIds, draftType, overrideFramework, styleReference, segment } = body as {
      sourceIds: string[];
      draftType: DraftType;
      overrideFramework?: FrameworkType;
      styleReference?: StyleReference;
      segment?: TranscriptSegment; // Optional: generate from a specific segment
    };

    if (!sourceIds || sourceIds.length === 0) {
      return NextResponse.json(
        { error: "At least one sourceId is required" },
        { status: 400 }
      );
    }

    if (!draftType || !["X_POST", "X_THREAD", "REEL_SCRIPT"].includes(draftType)) {
      return NextResponse.json(
        { error: "Valid draftType is required (X_POST, X_THREAD, REEL_SCRIPT)" },
        { status: 400 }
      );
    }

    // Fetch the source materials
    const { data: sourceMaterials, error: fetchError } = await supabase
      .from("sources")
      .select("*")
      .eq("user_id", user.id)
      .in("id", sourceIds);

    if (fetchError) throw fetchError;

    if (!sourceMaterials || sourceMaterials.length === 0) {
      return NextResponse.json(
        { error: "No sources found with provided IDs" },
        { status: 404 }
      );
    }

    const sources = sourceMaterials as SourceMaterial[];

    // Fetch user's AI model preference
    let aiProvider: AIProvider = "openai";
    const { data: voiceSettings } = await supabase
      .from("user_voice_settings")
      .select("ai_model")
      .eq("user_id", user.id)
      .eq("voice_type", "post")
      .single();

    if (voiceSettings?.ai_model) {
      aiProvider = voiceSettings.ai_model as AIProvider;
    }

    // Fetch inspiration posts for style reference if provided
    let stylePrompt: string | undefined;
    let inspirationPosts: InspirationPost[] = [];

    if (styleReference?.inspirationIds?.length) {
      const { data: inspirations, error: inspirationError } = await supabase
        .from("inspiration_posts")
        .select("*")
        .eq("user_id", user.id)
        .in("id", styleReference.inspirationIds);

      if (inspirationError) throw inspirationError;

      if (inspirations && inspirations.length > 0) {
        inspirationPosts = inspirations as InspirationPost[];
        stylePrompt = buildStylePrompt(inspirationPosts, styleReference.applyAs);
      }
    }

    // Determine if we should use the enhanced voice memo pipeline
    // Use it when: single voice memo source + X post or thread type
    const isSingleVoiceMemo =
      sources.length === 1 && sources[0].type === "VOICE_MEMO";
    const isXContent = draftType === "X_POST" || draftType === "X_THREAD";

    let generatedContent;
    let metadata: Record<string, unknown> = {};

    if (isSingleVoiceMemo && isXContent) {
      // Use enhanced voice memo pipeline
      // If a segment is provided, use the segment content instead of full transcript
      const transcript = segment?.content || sources[0].raw_content || "";

      if (!transcript.trim()) {
        return NextResponse.json(
          { error: "Voice memo has no transcript content" },
          { status: 400 }
        );
      }

      try {
        // Always respect the user's format choice
        const result = await generateFromVoiceMemo(transcript, {
          overrideFramework,
          overrideFormat: draftType as "X_POST" | "X_THREAD",
          stylePrompt,
          aiProvider,
        });

        generatedContent = result.content;
        metadata = {
          frameworkUsed: result.frameworkUsed,
          analysis: {
            coreIdea: result.analysis.coreIdea,
            supportingPoints: result.analysis.supportingPoints,
            contentDensity: result.analysis.contentDensity,
            intentType: result.analysis.intentType,
            confidence: result.analysis.confidence,
            extractedDetails: result.analysis.extractedDetails,
          },
          generationPipeline: "enhanced_voice_memo",
          // Track segment info if used
          segment: segment
            ? {
                id: segment.id,
                title: segment.title,
                keyTopics: segment.keyTopics,
              }
            : undefined,
          styleReference: styleReference
            ? {
                inspirationIds: styleReference.inspirationIds,
                applyAs: styleReference.applyAs,
              }
            : undefined,
        };
      } catch (error) {
        if (error instanceof FragmentContentError) {
          // Content is a fragment - still generate but with lower confidence
          // Fall back to legacy generation with a note
          const preparedSources = sources.map((s) => ({
            type: s.type,
            content: s.raw_content || "",
            metadata: s.metadata ?? undefined,
          }));

          generatedContent = await generateContent({
            sources: preparedSources,
            draftType,
            aiProvider,
          });

          metadata = {
            warning: "Content was classified as a fragment - may need more development",
            analysis: error.analysis,
            generationPipeline: "legacy_fallback",
          };
        } else {
          throw error;
        }
      }
    } else {
      // Use legacy pipeline for:
      // - Multiple sources
      // - Non-voice-memo sources
      // - Reel scripts
      const preparedSources = sources.map((s) => ({
        type: s.type,
        content: s.raw_content || "",
        metadata: s.metadata ?? undefined,
      }));

      generatedContent = await generateContent({
        sources: preparedSources,
        draftType,
        aiProvider,
      });

      metadata = {
        generationPipeline: "legacy",
        styleReference: styleReference
          ? {
              inspirationIds: styleReference.inspirationIds,
              applyAs: styleReference.applyAs,
            }
          : undefined,
      };
    }

    // Save the draft
    const { data: draft, error: insertError } = await supabase
      .from("drafts")
      .insert({
        user_id: user.id,
        type: draftType,
        status: "GENERATED",
        content: generatedContent,
        source_ids: sourceIds,
        metadata,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    console.error("Failed to generate draft:", error);
    return NextResponse.json(
      { error: "Failed to generate draft" },
      { status: 500 }
    );
  }
}
