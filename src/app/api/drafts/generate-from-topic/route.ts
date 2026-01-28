import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { openai } from "@/lib/openai/client";
import { corsHeaders, handleCors } from "@/lib/cors";

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

    const body = await request.json();
    const {
      topic,
      draftType = "X_POST",
      patternIds = [],
      generateCount = 3,
    } = body as {
      topic: string;
      draftType?: DraftType;
      patternIds?: string[];
      generateCount?: number;
    };

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

    // Fetch user's voice settings
    const { data: voiceSettings } = await supabase
      .from("user_voice_settings")
      .select("optimization_authenticity, tone_formal_casual, energy_calm_punchy, stance_neutral_opinionated, guardrails")
      .eq("user_id", user.id)
      .single();

    // Fetch user's voice examples for style reference
    const { data: voiceExamples } = await supabase
      .from("user_voice_examples")
      .select("content_text")
      .eq("user_id", user.id)
      .eq("is_excluded", false)
      .order("engagement_score", { ascending: false })
      .limit(5);

    // Build the generation prompt
    const patternInstructions = patterns.length > 0
      ? `Apply these patterns:\n${patterns.map(p => `- ${p.pattern_name}: ${p.pattern_value}`).join('\n')}`
      : "";

    const voiceDialInstructions = voiceSettings
      ? buildVoiceDialInstructions(voiceSettings as VoiceSettings)
      : "";

    const guardrailInstructions = voiceSettings?.guardrails
      ? buildGuardrailInstructions(voiceSettings.guardrails as VoiceSettings["guardrails"])
      : "";

    const examplePosts = voiceExamples?.length
      ? `Here are examples of the user's writing style:\n${voiceExamples.map((e, i) => `Example ${i + 1}: ${e.content_text}`).join('\n\n')}`
      : "";

    const formatInstructions = draftType === "X_THREAD"
      ? "Generate a thread of 3-5 connected tweets. Each tweet should be under 280 characters. Start with a hook that grabs attention."
      : "Generate a single tweet under 280 characters. Make it punchy and engaging.";

    const prompt = `Generate ${generateCount} ${draftType === "X_THREAD" ? "thread" : "tweet"} options about: "${topic}"

${formatInstructions}

${patternInstructions}

${voiceDialInstructions}

${guardrailInstructions}

${examplePosts}

Return a JSON array with ${generateCount} options. Each option should have:
- "content": The tweet text (or array of tweets for threads)
- "hook_type": What type of hook you used
- "patterns_applied": Array of pattern names you applied

Return ONLY the JSON array, no other text.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert X/Twitter content creator. Generate engaging, authentic posts that match the user's voice and apply the specified patterns. Return valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.8,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || "[]";

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

    // Save drafts
    const draftsToInsert = generatedOptions.map((option: { content: unknown; hook_type?: string; patterns_applied?: string[] }) => ({
      user_id: user.id,
      type: draftType,
      status: "GENERATED",
      content: draftType === "X_THREAD"
        ? { posts: Array.isArray(option.content) ? option.content : [option.content] }
        : { text: option.content },
      topic,
      applied_patterns: patterns.map(p => p.id),
      metadata: {
        hook_type: option.hook_type,
        patterns_applied: option.patterns_applied,
        generation_type: "topic_based",
      },
    }));

    const { data: insertedDrafts, error: insertError } = await supabase
      .from("drafts")
      .insert(draftsToInsert)
      .select();

    if (insertError) throw insertError;

    return NextResponse.json(
      {
        drafts: insertedDrafts,
        patterns_used: patterns,
        topic,
      },
      { status: 201, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to generate from topic:", error);
    return NextResponse.json(
      { error: "Failed to generate content" },
      { status: 500, headers: corsHeaders }
    );
  }
}

function buildVoiceDialInstructions(settings: VoiceSettings): string {
  const instructions: string[] = [];

  // Optimization vs Authenticity (0 = authentic, 100 = optimized)
  if (settings.optimization_authenticity < 30) {
    instructions.push("Prioritize authenticity over optimization. Write naturally, avoid common engagement tricks.");
  } else if (settings.optimization_authenticity > 70) {
    instructions.push("Optimize for engagement. Use proven hooks, clear CTAs, and engagement-driving formats.");
  }

  // Tone: Formal vs Casual (0 = formal, 100 = casual)
  if (settings.tone_formal_casual < 30) {
    instructions.push("Use a professional, formal tone. Avoid slang and casual language.");
  } else if (settings.tone_formal_casual > 70) {
    instructions.push("Use a casual, conversational tone. Be friendly and approachable.");
  }

  // Energy: Calm vs Punchy (0 = calm, 100 = punchy)
  if (settings.energy_calm_punchy < 30) {
    instructions.push("Keep the energy calm and measured. Use longer sentences, thoughtful pacing.");
  } else if (settings.energy_calm_punchy > 70) {
    instructions.push("Be punchy and energetic. Use short sentences. Create urgency and excitement.");
  }

  // Stance: Neutral vs Opinionated (0 = neutral, 100 = opinionated)
  if (settings.stance_neutral_opinionated < 30) {
    instructions.push("Stay neutral and balanced. Present multiple perspectives without strong opinions.");
  } else if (settings.stance_neutral_opinionated > 70) {
    instructions.push("Take strong stances. Be opinionated and bold. Don't hedge or qualify excessively.");
  }

  return instructions.length > 0
    ? `Voice guidelines:\n${instructions.map(i => `- ${i}`).join('\n')}`
    : "";
}

function buildGuardrailInstructions(guardrails: VoiceSettings["guardrails"]): string {
  const instructions: string[] = [];

  if (guardrails.avoid_words?.length > 0) {
    instructions.push(`Never use these words: ${guardrails.avoid_words.join(", ")}`);
  }

  if (guardrails.avoid_topics?.length > 0) {
    instructions.push(`Avoid mentioning: ${guardrails.avoid_topics.join(", ")}`);
  }

  if (guardrails.custom_rules?.length > 0) {
    guardrails.custom_rules.forEach(rule => {
      instructions.push(rule);
    });
  }

  return instructions.length > 0
    ? `Guardrails:\n${instructions.map(i => `- ${i}`).join('\n')}`
    : "";
}
