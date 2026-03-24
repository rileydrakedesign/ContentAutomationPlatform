import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";
import { DEFAULT_VOICE_SETTINGS, VoiceType } from "@/types/voice";

export const OPTIONS = apiOptions;

// GET /api/v1/voice — Get voice settings
export const GET = withApiAuth(["voice:read"], async ({ auth, request }) => {
  const supabase = createAdminClient();
  const url = new URL(request.url);
  const voiceType = (url.searchParams.get("type") as VoiceType) || "post";

  if (!["post", "reply"].includes(voiceType)) {
    return apiError("type must be 'post' or 'reply'", "validation_error", 400);
  }

  let { data: settings, error } = await supabase
    .from("user_voice_settings")
    .select("*")
    .eq("user_id", auth.userId)
    .eq("voice_type", voiceType)
    .single();

  if (error && error.code === "PGRST116") {
    // No settings — return defaults
    return apiSuccess({
      ...DEFAULT_VOICE_SETTINGS,
      voice_type: voiceType,
      user_id: auth.userId,
    });
  }
  if (error) {
    return apiError("Failed to fetch voice settings", "fetch_failed", 500);
  }

  // Also fetch voice examples
  const { data: examples } = await supabase
    .from("user_voice_examples")
    .select("id, content_text, content_type, source, is_excluded, pinned_rank, engagement_score")
    .eq("user_id", auth.userId)
    .eq("content_type", voiceType)
    .eq("is_excluded", false)
    .order("pinned_rank", { ascending: true, nullsFirst: false })
    .order("engagement_score", { ascending: false })
    .limit(20);

  return apiSuccess({ settings, examples: examples || [] });
});

// PATCH /api/v1/voice — Update voice settings
export const PATCH = withApiAuth(["voice:write"], async ({ auth, request }) => {
  const supabase = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const voiceType = (body.voice_type as VoiceType) || "post";
  if (!["post", "reply"].includes(voiceType)) {
    return apiError("voice_type must be 'post' or 'reply'", "validation_error", 400);
  }

  // Validate dial values (0-100)
  const dialFields = ["optimization_authenticity", "tone_formal_casual", "energy_calm_punchy", "stance_neutral_opinionated"];
  for (const field of dialFields) {
    if (body[field] !== undefined) {
      const val = Number(body[field]);
      if (isNaN(val) || val < 0 || val > 100) {
        return apiError(`${field} must be 0-100`, "validation_error", 400);
      }
    }
  }

  // Allowlisted fields for update
  const allowedFields = [
    "length_mode", "directness_mode", "humor_mode", "emoji_mode",
    "question_rate", "disagreement_mode", "max_example_tokens",
    "max_inspiration_tokens", "auto_refresh_enabled", "refresh_day_of_week",
    "optimization_authenticity", "tone_formal_casual", "energy_calm_punchy",
    "stance_neutral_opinionated", "guardrails", "special_notes",
    "use_niche_context", "ai_model",
  ];

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      updateData[field] = body[field];
    }
  }

  // Upsert
  const { data: existing } = await supabase
    .from("user_voice_settings")
    .select("*")
    .eq("user_id", auth.userId)
    .eq("voice_type", voiceType)
    .single();

  const base = existing || { ...DEFAULT_VOICE_SETTINGS, user_id: auth.userId, voice_type: voiceType };

  const payload = { ...base, ...updateData, user_id: auth.userId, voice_type: voiceType };

  const { data: result, error } = await supabase
    .from("user_voice_settings")
    .upsert(payload, { onConflict: "user_id,voice_type" })
    .select()
    .single();

  if (error) {
    return apiError("Failed to update voice settings", "update_failed", 500);
  }

  return apiSuccess(result);
});
