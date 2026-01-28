import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { UpdateVoiceSettingsRequest, DEFAULT_VOICE_SETTINGS, VoiceType } from "@/types/voice";

// GET /api/voice/settings - Get user voice settings (create defaults if none)
// Query params: ?type=post|reply (default: 'reply')
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const voiceType = (searchParams.get("type") as VoiceType) || "reply";

    // Validate voice type
    if (!["post", "reply"].includes(voiceType)) {
      return NextResponse.json({ error: "Invalid voice type" }, { status: 400 });
    }

    // Try to get settings with voice_type (new schema)
    let { data: settings, error } = await supabase
      .from("user_voice_settings")
      .select("*")
      .eq("user_id", user.id)
      .eq("voice_type", voiceType)
      .single();

    // If voice_type column doesn't exist, fall back to old schema
    if (error && error.message?.includes("voice_type")) {
      const { data: legacySettings, error: legacyError } = await supabase
        .from("user_voice_settings")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (legacyError && legacyError.code === "PGRST116") {
        // No settings exist, create with old schema (remove new columns)
        const { voice_type: _vt, special_notes: _sn, ...legacyDefaults } = DEFAULT_VOICE_SETTINGS;
        const { data: newSettings, error: insertError } = await supabase
          .from("user_voice_settings")
          .insert({
            user_id: user.id,
            ...legacyDefaults,
          })
          .select()
          .single();

        if (insertError) throw insertError;
        return NextResponse.json({ ...newSettings, voice_type: voiceType, special_notes: null });
      } else if (legacyError) {
        throw legacyError;
      }

      return NextResponse.json({ ...legacySettings, voice_type: voiceType, special_notes: null });
    }

    if (error && error.code === "PGRST116") {
      // Create default settings if none exist for this voice type
      const { data: newSettings, error: insertError } = await supabase
        .from("user_voice_settings")
        .insert({
          ...DEFAULT_VOICE_SETTINGS,
          user_id: user.id,
          voice_type: voiceType,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      settings = newSettings;
    } else if (error) {
      throw error;
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error("Failed to fetch voice settings:", error);
    return NextResponse.json(
      { error: "Failed to fetch voice settings" },
      { status: 500 }
    );
  }
}

// PATCH /api/voice/settings - Update voice settings
// Body must include voice_type to identify which settings to update
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateVoiceSettingsRequest = await request.json();
    const voiceType = body.voice_type || "reply";

    // Validate voice type
    if (!["post", "reply"].includes(voiceType)) {
      return NextResponse.json({ error: "Invalid voice type" }, { status: 400 });
    }

    // Validate control knob values
    const validLengthModes = ['short', 'medium'];
    const validDirectnessModes = ['soft', 'neutral', 'blunt'];
    const validHumorModes = ['off', 'light'];
    const validEmojiModes = ['off', 'on'];
    const validQuestionRates = ['low', 'medium'];
    const validDisagreementModes = ['avoid', 'allow_nuance'];

    if (body.length_mode && !validLengthModes.includes(body.length_mode)) {
      return NextResponse.json({ error: "Invalid length_mode" }, { status: 400 });
    }
    if (body.directness_mode && !validDirectnessModes.includes(body.directness_mode)) {
      return NextResponse.json({ error: "Invalid directness_mode" }, { status: 400 });
    }
    if (body.humor_mode && !validHumorModes.includes(body.humor_mode)) {
      return NextResponse.json({ error: "Invalid humor_mode" }, { status: 400 });
    }
    if (body.emoji_mode && !validEmojiModes.includes(body.emoji_mode)) {
      return NextResponse.json({ error: "Invalid emoji_mode" }, { status: 400 });
    }
    if (body.question_rate && !validQuestionRates.includes(body.question_rate)) {
      return NextResponse.json({ error: "Invalid question_rate" }, { status: 400 });
    }
    if (body.disagreement_mode && !validDisagreementModes.includes(body.disagreement_mode)) {
      return NextResponse.json({ error: "Invalid disagreement_mode" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Only include fields that were provided
    if (body.length_mode !== undefined) updateData.length_mode = body.length_mode;
    if (body.directness_mode !== undefined) updateData.directness_mode = body.directness_mode;
    if (body.humor_mode !== undefined) updateData.humor_mode = body.humor_mode;
    if (body.emoji_mode !== undefined) updateData.emoji_mode = body.emoji_mode;
    if (body.question_rate !== undefined) updateData.question_rate = body.question_rate;
    if (body.disagreement_mode !== undefined) updateData.disagreement_mode = body.disagreement_mode;
    if (body.max_example_tokens !== undefined) updateData.max_example_tokens = body.max_example_tokens;
    if (body.max_inspiration_tokens !== undefined) updateData.max_inspiration_tokens = body.max_inspiration_tokens;
    if (body.auto_refresh_enabled !== undefined) updateData.auto_refresh_enabled = body.auto_refresh_enabled;
    if (body.refresh_day_of_week !== undefined) updateData.refresh_day_of_week = body.refresh_day_of_week;

    // Voice dial settings (validate 0-100 range)
    if (body.optimization_authenticity !== undefined) {
      if (body.optimization_authenticity < 0 || body.optimization_authenticity > 100) {
        return NextResponse.json({ error: "optimization_authenticity must be 0-100" }, { status: 400 });
      }
      updateData.optimization_authenticity = body.optimization_authenticity;
    }
    if (body.tone_formal_casual !== undefined) {
      if (body.tone_formal_casual < 0 || body.tone_formal_casual > 100) {
        return NextResponse.json({ error: "tone_formal_casual must be 0-100" }, { status: 400 });
      }
      updateData.tone_formal_casual = body.tone_formal_casual;
    }
    if (body.energy_calm_punchy !== undefined) {
      if (body.energy_calm_punchy < 0 || body.energy_calm_punchy > 100) {
        return NextResponse.json({ error: "energy_calm_punchy must be 0-100" }, { status: 400 });
      }
      updateData.energy_calm_punchy = body.energy_calm_punchy;
    }
    if (body.stance_neutral_opinionated !== undefined) {
      if (body.stance_neutral_opinionated < 0 || body.stance_neutral_opinionated > 100) {
        return NextResponse.json({ error: "stance_neutral_opinionated must be 0-100" }, { status: 400 });
      }
      updateData.stance_neutral_opinionated = body.stance_neutral_opinionated;
    }
    if (body.guardrails !== undefined) {
      updateData.guardrails = body.guardrails;
    }
    if (body.special_notes !== undefined) {
      updateData.special_notes = body.special_notes;
    }

    // Try upsert with new schema (compound key: user_id + voice_type)
    let { data, error } = await supabase
      .from("user_voice_settings")
      .upsert(
        {
          ...DEFAULT_VOICE_SETTINGS,
          ...updateData,
          user_id: user.id,
          voice_type: voiceType,
        },
        { onConflict: "user_id,voice_type" }
      )
      .select()
      .single();

    // If voice_type column doesn't exist, fall back to old schema
    if (error && (error.message?.includes("voice_type") || error.message?.includes("user_id,voice_type"))) {
      // Remove new columns from defaults and updateData
      const { voice_type: _vt, special_notes: _sn, ...legacyDefaults } = DEFAULT_VOICE_SETTINGS;
      const legacyUpdateData = { ...updateData };
      delete legacyUpdateData.special_notes;

      const { data: legacyData, error: legacyError } = await supabase
        .from("user_voice_settings")
        .upsert(
          {
            ...legacyDefaults,
            ...legacyUpdateData,
            user_id: user.id,
          },
          { onConflict: "user_id" }
        )
        .select()
        .single();

      if (legacyError) throw legacyError;
      return NextResponse.json({ ...legacyData, voice_type: voiceType });
    }

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update voice settings:", error);
    return NextResponse.json(
      { error: "Failed to update voice settings" },
      { status: 500 }
    );
  }
}
