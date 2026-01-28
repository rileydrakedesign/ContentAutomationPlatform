import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { openai } from "@/lib/openai/client";
import { UserVoiceSettings, VoiceType, DEFAULT_VOICE_SETTINGS } from "@/types/voice";

function buildPreviewPrompt(settings: UserVoiceSettings, voiceType: VoiceType): string {
  const toneDesc =
    settings.tone_formal_casual < 30
      ? "formal and professional"
      : settings.tone_formal_casual > 70
      ? "casual and conversational"
      : "balanced";

  const energyDesc =
    settings.energy_calm_punchy < 30
      ? "calm and thoughtful"
      : settings.energy_calm_punchy > 70
      ? "punchy and high-energy"
      : "moderate energy";

  const stanceDesc =
    settings.stance_neutral_opinionated < 30
      ? "neutral and balanced"
      : settings.stance_neutral_opinionated > 70
      ? "bold and opinionated"
      : "somewhat opinionated";

  const optimizationDesc =
    settings.optimization_authenticity < 30
      ? "authentic and natural"
      : settings.optimization_authenticity > 70
      ? "optimized for engagement"
      : "balanced between authentic and optimized";

  const lengthDesc = settings.length_mode === "short" ? "short and punchy" : "medium length";
  const humorDesc = settings.humor_mode === "light" ? "with light humor when appropriate" : "without humor";
  const emojiDesc = settings.emoji_mode === "on" ? "can use one emoji if it adds meaning" : "no emojis";

  const specialNotes = settings.special_notes
    ? `\n\nAdditional instructions: ${settings.special_notes}`
    : "";

  return `Generate a sample ${voiceType === "reply" ? "reply to a tweet" : "original post"} that demonstrates this voice style:

Voice characteristics:
- Tone: ${toneDesc}
- Energy: ${energyDesc}
- Stance: ${stanceDesc}
- Optimization: ${optimizationDesc}
- Length: ${lengthDesc}
- Humor: ${humorDesc}
- Emojis: ${emojiDesc}
${specialNotes}

${voiceType === "reply"
  ? "Imagine you're replying to a tweet about technology or business. Write a short, engaging reply."
  : "Write a short post about productivity or tech. Make it sound natural."
}

Return ONLY the ${voiceType === "reply" ? "reply" : "post"} text, nothing else.`;
}

// POST /api/voice/preview - Generate sample content using current voice settings
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

    const { voice_type, topic, context } = await request.json();
    const voiceType = (voice_type as VoiceType) || "reply";

    if (!["post", "reply"].includes(voiceType)) {
      return NextResponse.json({ error: "Invalid voice_type" }, { status: 400 });
    }

    // Get current voice settings
    let { data: settings } = await supabase
      .from("user_voice_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("voice_type", voiceType)
      .single();

    if (!settings) {
      settings = {
        ...DEFAULT_VOICE_SETTINGS,
        voice_type: voiceType,
        id: "",
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as UserVoiceSettings;
    }

    let prompt = buildPreviewPrompt(settings as UserVoiceSettings, voiceType);

    // Add custom topic/context if provided
    if (topic) {
      prompt = prompt.replace(
        voiceType === "reply"
          ? "Imagine you're replying to a tweet about technology or business."
          : "Write a short post about productivity or tech.",
        voiceType === "reply"
          ? `Imagine you're replying to a tweet about: ${topic}`
          : `Write a short post about: ${topic}`
      );
    }

    if (context) {
      prompt += `\n\nContext for the ${voiceType === "reply" ? "original tweet" : "post"}: ${context}`;
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.8,
      max_tokens: 200,
    });

    const preview = completion.choices[0]?.message?.content?.trim() || "";

    return NextResponse.json({
      preview,
      voice_type: voiceType,
      settings_used: {
        optimization_authenticity: settings.optimization_authenticity,
        tone_formal_casual: settings.tone_formal_casual,
        energy_calm_punchy: settings.energy_calm_punchy,
        stance_neutral_opinionated: settings.stance_neutral_opinionated,
        length_mode: settings.length_mode,
        humor_mode: settings.humor_mode,
        emoji_mode: settings.emoji_mode,
      },
    });
  } catch (error) {
    console.error("Failed to generate preview:", error);
    return NextResponse.json(
      { error: "Failed to generate preview" },
      { status: 500 }
    );
  }
}
