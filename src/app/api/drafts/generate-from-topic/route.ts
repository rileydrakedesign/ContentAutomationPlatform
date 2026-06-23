import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 60;
import { createAuthClient } from "@/lib/supabase/server";
import { createChatCompletion, AIProvider } from "@/lib/ai";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireAiGeneration } from "@/lib/stripe/gate";
import { isGenerationApplicablePattern } from "@/lib/analysis/pattern-applicability";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

type DraftType = "X_POST" | "X_THREAD";

interface Pattern {
  id: string;
  pattern_type: string;
  pattern_name: string;
  pattern_value: string;
  multiplier: number;
  applies_to_generation?: boolean | null;
}

// POST /api/drafts/generate-from-topic - Generate draft from topic with patterns
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Check AI generation limit (free tier: 5/day)
    const gateError = await requireAiGeneration(user.id, "generate-from-topic");
    if (gateError) return gateError;

    const body = await request.json();
    const {
      topic,
      draftType = "X_POST",
      patternIds = [],
      generateCount: rawGenerateCount = 1,
      inspirationPost,
      instructions,
      previousVariations,
    } = body as {
      topic: string;
      draftType?: DraftType;
      patternIds?: string[];
      generateCount?: number;
      inspirationPost?: {
        text: string;
        author: string;
      };
      // One-off steering for a single regeneration ("make it punchier", "add a
      // stat"). Subordinate to the tuned voice — applied for this request only.
      instructions?: string;
      // Texts of variations already shown this session, so a regenerate
      // produces something genuinely different rather than a near-duplicate.
      previousVariations?: string[];
    };

    // Default to a single full-view option (regenerate for more). Still allow
    // a larger batch when a caller explicitly asks for it.
    const generateCount = Math.min(Math.max(1, Number(rawGenerateCount) || 1), 10);

    if (!topic || topic.trim().length < 3) {
      return NextResponse.json(
        { error: "Topic must be at least 3 characters" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch selected patterns. Both the explicit selection and the default
    // top-3 are filtered to generation-applicable patterns only — timing,
    // post-type (single/thread), and visual/media patterns are insights but
    // not things the text model controls (see pattern-applicability.ts).
    const wasExplicitSelection = patternIds.length > 0;
    let patterns: Pattern[] = [];
    if (wasExplicitSelection) {
      const { data: patternData, error: patternError } = await supabase
        .from("extracted_patterns")
        .select("id, pattern_type, pattern_name, pattern_value, multiplier, applies_to_generation")
        .in("id", patternIds)
        .eq("user_id", user.id);

      if (patternError) throw patternError;
      patterns = (patternData || []).filter(isGenerationApplicablePattern);
    } else {
      // Get top enabled, generation-applicable patterns by default. Over-fetch
      // then filter so non-applicable rows don't crowd out the top 3.
      const { data: defaultPatterns, error: defaultError } = await supabase
        .from("extracted_patterns")
        .select("id, pattern_type, pattern_name, pattern_value, multiplier, applies_to_generation")
        .eq("user_id", user.id)
        .eq("is_enabled", true)
        .order("multiplier", { ascending: false })
        .limit(10);

      if (defaultError) throw defaultError;
      patterns = (defaultPatterns || []).filter(isGenerationApplicablePattern).slice(0, 3);
    }

    // Fetch user's voice settings including AI model preference
    const { data: voiceSettings } = await supabase
      .from("user_voice_settings")
      .select("optimization_authenticity, tone_formal_casual, energy_calm_punchy, stance_neutral_opinionated, guardrails, ai_model")
      .eq("user_id", user.id)
      .eq("voice_type", "post")
      .single();

    const aiProvider: AIProvider = (voiceSettings?.ai_model as AIProvider) || "openai";

    // Voice dials, guardrails, examples, and default patterns all come from
    // the assembled system prompt (one canonical tuned context). The user
    // prompt only carries explicit per-request steering: user-selected
    // pattern IDs.
    const patternInstructions = wasExplicitSelection && patterns.length > 0
      ? `The user explicitly selected these proven patterns for this post — prioritize applying them (while staying in their authentic voice; never force one if it breaks the voice):\n${patterns.map(p => `- ${p.pattern_name}: ${p.pattern_value}`).join('\n')}`
      : "";

    const formatInstructions = draftType === "X_THREAD"
      ? "Generate a thread of 3-5 connected tweets. Each tweet should be under 280 characters. Start with a hook that grabs attention. Use line breaks within individual tweets for readability where appropriate."
      : `Generate a single post for X. Make it punchy and engaging.
Use formatting to improve readability when appropriate:
- Use line breaks (\\n) to separate ideas and create visual breathing room
- Use bullet points (•) or dashes (-) for lists
- Use short paragraphs instead of walls of text
- Preserve the natural structure of the content
Keep the post concise but don't artificially limit to 280 characters — longer formatted posts are fine when the content warrants it.`;

    const inspirationInstructions = inspirationPost
      ? `Use this post as style and format inspiration (adapt the approach, don't copy):
---
@${inspirationPost.author}: "${inspirationPost.text}"
---
Study the structure, tone, and hooks used. Create original content on the topic that captures similar energy and format.`
      : "";

    // One-off per-request steering, subordinate to the tuned voice (mirrors how
    // generate-reply frames `tone`): applies to THIS generation only and never
    // overrides how the user actually writes.
    const instructionLine = instructions && instructions.trim()
      ? `One-off adjustment for this request only (the user's voice still applies; do not let this override it): ${instructions.trim()}`
      : "";

    // On regenerate, steer away from variations already shown so the new one is
    // genuinely different.
    const priorVariationsBlock = Array.isArray(previousVariations) && previousVariations.length > 0
      ? `You already produced these variations — make this one meaningfully different in angle, hook, or structure (do not repeat them):\n${previousVariations
          .slice(0, 4)
          .map((v, i) => `[${i + 1}] ${String(v).slice(0, 280)}`)
          .join("\n")}`
      : "";

    const prompt = `Generate ${generateCount} ${draftType === "X_THREAD" ? "thread" : "tweet"} option${generateCount === 1 ? "" : "s"} about: "${topic}"

${formatInstructions}

${inspirationInstructions}

${patternInstructions}

${instructionLine}

${priorVariationsBlock}

Return a JSON array with ${generateCount} option${generateCount === 1 ? "" : "s"}. Each option should have:
- "content": The tweet text (or array of tweets for threads)
- "hook_type": What type of hook you used
- "patterns_applied": Array of pattern names you applied

Return ONLY the JSON array, no other text.`;

    // Use the same voice prompt assembler used across the app
    const { getAssembledPromptForUser } = await import("@/lib/openai/prompts/prompt-assembler");
    const systemPrompt = await getAssembledPromptForUser(supabase, user.id, "post");

    const result = await createChatCompletion({
      provider: aiProvider,
      modelTier: "fast",
      messages: [
        {
          role: "system",
          content: `${systemPrompt}\n\nReturn valid JSON only.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      // Single-option generation leans on first-gen voice fidelity, so run a
      // touch cooler for tighter adherence to the user's voice; batch
      // generation stays warmer to keep the options varied. A regenerate with
      // explicit instructions stays warm enough to actually shift.
      temperature: generateCount === 1 && !instructions ? 0.7 : 0.85,
      maxTokens: 2000,
      jsonResponse: false, // We parse JSON manually from the response
    });

    const responseText = result.content || "[]";

    let generatedOptions = [];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        generatedOptions = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse generation response:", parseError);
      return NextResponse.json(
        { error: "Failed to parse generated content" },
        { status: 500, headers: corsHeaders }
      );
    }

    // Return options in memory — nothing saved to DB yet
    const options = generatedOptions.map((option: { content: unknown; hook_type?: string; patterns_applied?: string[] }) => ({
      type: draftType,
      content: draftType === "X_THREAD"
        ? { tweets: Array.isArray(option.content) ? option.content : [option.content] }
        : { text: option.content },
      topic,
      applied_patterns: patterns.map(p => p.id),
      metadata: {
        hook_type: option.hook_type,
        patterns_applied: option.patterns_applied,
        generation_type: inspirationPost ? "inspiration_based" : "topic_based",
        inspiration_author: inspirationPost?.author,
      },
    }));

    return NextResponse.json(
      {
        options,
        patterns_used: patterns,
        topic,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to generate from topic:", error);
    Sentry.captureException(error, {
      tags: { route: "drafts/generate-from-topic" },
    });
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500, headers: corsHeaders }
    );
  }
}

