-- user_niche_profile: persistent, accumulating model of who the user is as a creator.
-- One row per user. Updated on each analysis run (upsert), not batch-reset.
CREATE TABLE IF NOT EXISTS public.user_niche_profile (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_clusters       JSONB NOT NULL DEFAULT '[]',  -- TopicCluster[]
  content_pillars      TEXT[] NOT NULL DEFAULT '{}', -- top 3-5 pillar labels
  niche_summary        TEXT,                         -- 1-2 sentence LLM-generated description
  last_analyzed_at     TIMESTAMPTZ,
  total_posts_analyzed INTEGER NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Index for fast single-row lookups
CREATE INDEX IF NOT EXISTS idx_user_niche_profile_user_id
  ON public.user_niche_profile (user_id);

-- RLS
ALTER TABLE public.user_niche_profile ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own niche profile"
  ON public.user_niche_profile FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own niche profile"
  ON public.user_niche_profile FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own niche profile"
  ON public.user_niche_profile FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own niche profile"
  ON public.user_niche_profile FOR DELETE
  USING (auth.uid() = user_id);
