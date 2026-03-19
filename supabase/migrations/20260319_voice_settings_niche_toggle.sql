-- Add use_niche_context toggle to user_voice_settings.
-- When true, the niche profile summary is injected into the system prompt.
ALTER TABLE public.user_voice_settings
  ADD COLUMN IF NOT EXISTS use_niche_context BOOLEAN NOT NULL DEFAULT true;
