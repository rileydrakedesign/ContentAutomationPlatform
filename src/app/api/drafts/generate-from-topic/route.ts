import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { createAuthClient } from "@/lib/supabase/server";
import { createChatCompletion, AIProvider } from "@/lib/ai";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireAiGeneration } from "@/lib/stripe/gate";

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
}

interface VoiceSettings {
  optimization_authenticity: number;
  tone_formal_casual: number;
  energy_calm_punchy: number;
  stance_neutral_opinionated: number;
  guardrails: {
    avoid_words: string[];
    avoid_topics: string[];
    custom_rules: string[];
  };
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
      generateCount: rawGenerateCount = 3,
      inspirationPost,
    } = body as {
      topic: string;
      draftType?: DraftType;
      patternIds?: string[];
      generateCount?: number;
      inspirationPost?: {
        text: string;
        author: string;
      };
    };

    const generateCount = Math.min(Math.max(1, Number(rawGenerateCount) || 3), 10);

    if (!topic || topic.trim().length < 3) {
      return NextResponse.json(
        { error: "Topic must be at least 3 characters" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Fetch selected patterns
    let patterns: Pattern[] = [];
    if (patternIds.length > 0) {
      const { data: patternData, error: patternError } = await supabase
        .from("extracted_patterns")
        .select("id, pattern_type, pattern_name, pattern_value, multiplier")
        .in("id", patternIds)
        .eq("user_id", user.id);

      if (patternError) throw patternError;
      patterns = patternData || [];
    } else {
      // Get top 3 enabled patterns by default
      const { data: defaultPatterns, error: defaultError } = await supabase
        .from("extracted_patterns")
        .select("id, pattern_type, pattern_name, pattern_value, multiplier")
        .eq("user_id", user.id)
        .eq("is_enabled", true)
        .order("multiplier", { ascending: false })
        .limit(3);

      if (defaultError) throw defaultError;
      patterns = defaultPatterns || [];
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
    const patternInstructions = patternIds.length > 0 && patterns.length > 0
      ? `Apply these patterns the user selected:\n${patterns.map(p => `- ${p.pattern_name}: ${p.pattern_value}`).join('\n')}`
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

    const prompt = `Generate ${generateCount} ${draftType === "X_THREAD" ? "thread" : "tweet"} options about: "${topic}"

${formatInstructions}

${inspirationInstructions}

${patternInstructions}

Return a JSON array with ${generateCount} options. Each option should have:
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
      temperature: 0.8,
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
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500, headers: corsHeaders }
    );
  }
}

