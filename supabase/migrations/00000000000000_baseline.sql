-- Baseline schema snapshot (2026-06-09) of the ~11 tables created ad-hoc on the
-- live project before migration files were tracked in-repo:
--   x_connections, x_oauth_requests, api_keys, user_voice_settings,
--   user_voice_examples, inspiration_posts, extracted_patterns, captured_posts,
--   drafts, user_settings, generation_feedback
-- Generated from the live database catalogs (pg_attribute/pg_constraint/
-- pg_indexes/pg_policies). Idempotent (IF NOT EXISTS / drop-and-recreate
-- policies) so it is a no-op on the live DB and reproduces the schema on a
-- fresh one. Tables created by later dated migrations are NOT included here.

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE draft_type AS ENUM ('X_POST', 'X_THREAD', 'REEL_SCRIPT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE draft_status AS ENUM ('PENDING', 'GENERATED', 'APPROVED', 'REJECTED', 'DRAFT', 'POSTED', 'SCHEDULED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.x_connections (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  x_user_id text NOT NULL,
  x_username text NOT NULL,
  access_token text NOT NULL,
  last_sync_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  access_token_secret text,
  last_api_sync_at timestamp with time zone,
  refresh_token text,
  access_token_expires_at timestamp with time zone,
  CONSTRAINT x_connections_pkey PRIMARY KEY (id),
  CONSTRAINT x_connections_user_id_key UNIQUE (user_id),
  CONSTRAINT x_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.x_oauth_requests (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  oauth_token text,
  oauth_token_secret text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  expires_at timestamp with time zone DEFAULT (now() + '00:10:00'::interval) NOT NULL,
  code_verifier text,
  state text,
  CONSTRAINT x_oauth_requests_pkey PRIMARY KEY (id),
  CONSTRAINT x_oauth_requests_user_id_key UNIQUE (user_id),
  CONSTRAINT x_oauth_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL,
  name text NOT NULL,
  scopes text[] DEFAULT '{}'::text[] NOT NULL,
  rate_limit integer DEFAULT 60 NOT NULL,
  last_used_at timestamp with time zone,
  expires_at timestamp with time zone,
  revoked_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT api_keys_pkey PRIMARY KEY (id),
  CONSTRAINT api_keys_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_voice_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  length_mode text DEFAULT 'medium'::text NOT NULL,
  directness_mode text DEFAULT 'neutral'::text NOT NULL,
  humor_mode text DEFAULT 'off'::text NOT NULL,
  emoji_mode text DEFAULT 'off'::text NOT NULL,
  question_rate text DEFAULT 'low'::text NOT NULL,
  disagreement_mode text DEFAULT 'avoid'::text NOT NULL,
  max_example_tokens integer DEFAULT 1500 NOT NULL,
  max_inspiration_tokens integer DEFAULT 500 NOT NULL,
  auto_refresh_enabled boolean DEFAULT true NOT NULL,
  last_refresh_at timestamp with time zone,
  refresh_day_of_week integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  optimization_authenticity integer DEFAULT 50,
  tone_formal_casual integer DEFAULT 50,
  energy_calm_punchy integer DEFAULT 50,
  stance_neutral_opinionated integer DEFAULT 50,
  guardrails jsonb DEFAULT '{"avoid_words": [], "avoid_topics": [], "custom_rules": []}'::jsonb,
  voice_type text DEFAULT 'reply'::text,
  special_notes text,
  ai_model text DEFAULT 'openai'::text,
  use_niche_context boolean DEFAULT true NOT NULL,
  CONSTRAINT user_voice_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_voice_settings_user_id_voice_type_key UNIQUE (user_id, voice_type),
  CONSTRAINT user_voice_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_voice_settings_ai_model_check CHECK ((ai_model = ANY (ARRAY['openai'::text, 'claude'::text, 'grok'::text]))),
  CONSTRAINT user_voice_settings_directness_mode_check CHECK ((directness_mode = ANY (ARRAY['soft'::text, 'neutral'::text, 'blunt'::text]))),
  CONSTRAINT user_voice_settings_disagreement_mode_check CHECK ((disagreement_mode = ANY (ARRAY['avoid'::text, 'allow_nuance'::text]))),
  CONSTRAINT user_voice_settings_emoji_mode_check CHECK ((emoji_mode = ANY (ARRAY['off'::text, 'on'::text]))),
  CONSTRAINT user_voice_settings_humor_mode_check CHECK ((humor_mode = ANY (ARRAY['off'::text, 'light'::text]))),
  CONSTRAINT user_voice_settings_length_mode_check CHECK ((length_mode = ANY (ARRAY['short'::text, 'medium'::text]))),
  CONSTRAINT user_voice_settings_question_rate_check CHECK ((question_rate = ANY (ARRAY['low'::text, 'medium'::text]))),
  CONSTRAINT user_voice_settings_voice_type_check CHECK ((voice_type = ANY (ARRAY['post'::text, 'reply'::text])))
);

CREATE TABLE IF NOT EXISTS public.captured_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  post_url text NOT NULL,
  author_handle text NOT NULL,
  author_name text,
  text_content text NOT NULL,
  is_own_post boolean DEFAULT false,
  metrics jsonb DEFAULT '{}'::jsonb,
  captured_at timestamp without time zone DEFAULT now() NOT NULL,
  post_timestamp timestamp without time zone,
  inbox_status text DEFAULT 'inbox'::text,
  triaged_as text,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  x_post_id text,
  CONSTRAINT captured_posts_pkey PRIMARY KEY (id),
  CONSTRAINT captured_posts_user_id_post_url_key UNIQUE (user_id, post_url),
  CONSTRAINT captured_posts_x_post_id_key UNIQUE (x_post_id),
  CONSTRAINT captured_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT captured_posts_inbox_status_check CHECK ((inbox_status = ANY (ARRAY['inbox'::text, 'triaged'::text]))),
  CONSTRAINT captured_posts_triaged_as_check CHECK ((triaged_as = ANY (ARRAY['my_post'::text, 'inspiration'::text])))
);

CREATE TABLE IF NOT EXISTS public.user_voice_examples (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  captured_post_id uuid,
  content_text text NOT NULL,
  content_type text NOT NULL,
  source text DEFAULT 'auto'::text NOT NULL,
  is_excluded boolean DEFAULT false NOT NULL,
  pinned_rank integer,
  user_note text,
  metrics_snapshot jsonb DEFAULT '{}'::jsonb NOT NULL,
  engagement_score double precision DEFAULT 0 NOT NULL,
  token_count integer DEFAULT 0 NOT NULL,
  selected_at timestamp with time zone DEFAULT now(),
  selection_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT user_voice_examples_pkey PRIMARY KEY (id),
  CONSTRAINT user_voice_examples_captured_post_id_fkey FOREIGN KEY (captured_post_id) REFERENCES captured_posts(id) ON DELETE SET NULL,
  CONSTRAINT user_voice_examples_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT user_voice_examples_content_type_check CHECK ((content_type = ANY (ARRAY['post'::text, 'reply'::text]))),
  CONSTRAINT user_voice_examples_source_check CHECK ((source = ANY (ARRAY['auto'::text, 'pinned'::text])))
);

CREATE TABLE IF NOT EXISTS public.inspiration_posts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  raw_content text NOT NULL,
  source_url text,
  author_handle text,
  platform text DEFAULT 'X'::text,
  voice_analysis jsonb,
  format_analysis jsonb,
  analysis_status text DEFAULT 'pending'::text,
  created_at timestamp without time zone DEFAULT now(),
  updated_at timestamp without time zone DEFAULT now(),
  user_id uuid,
  metrics jsonb DEFAULT '{}'::jsonb,
  post_timestamp timestamp with time zone,
  source text DEFAULT 'manual'::text NOT NULL,
  include_in_post_voice boolean DEFAULT false NOT NULL,
  include_in_reply_voice boolean DEFAULT false NOT NULL,
  CONSTRAINT inspiration_posts_pkey PRIMARY KEY (id),
  CONSTRAINT inspiration_posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT inspiration_posts_analysis_status_check CHECK ((analysis_status = ANY (ARRAY['pending'::text, 'analyzing'::text, 'completed'::text, 'failed'::text])))
);

CREATE TABLE IF NOT EXISTS public.extracted_patterns (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  pattern_type text NOT NULL,
  pattern_name text NOT NULL,
  pattern_value text NOT NULL,
  confidence_score double precision DEFAULT 0,
  sample_count integer DEFAULT 0,
  avg_engagement double precision DEFAULT 0,
  multiplier double precision DEFAULT 1.0,
  source_post_ids uuid[],
  is_enabled boolean DEFAULT true,
  discovered_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  extraction_batch timestamp with time zone,
  CONSTRAINT extracted_patterns_pkey PRIMARY KEY (id),
  CONSTRAINT extracted_patterns_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.drafts (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  type draft_type NOT NULL,
  status draft_status DEFAULT 'PENDING'::draft_status NOT NULL,
  content jsonb NOT NULL,
  edited_content jsonb,
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  metadata jsonb,
  user_id uuid,
  topic text,
  applied_patterns uuid[],
  CONSTRAINT drafts_pkey PRIMARY KEY (id),
  CONSTRAINT drafts_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.user_settings (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  x_handles text[] DEFAULT '{}'::text[],
  created_at timestamp without time zone DEFAULT now() NOT NULL,
  updated_at timestamp without time zone DEFAULT now() NOT NULL,
  CONSTRAINT user_settings_pkey PRIMARY KEY (id),
  CONSTRAINT user_settings_user_id_key UNIQUE (user_id),
  CONSTRAINT user_settings_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.generation_feedback (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  user_id uuid NOT NULL,
  feedback_type text NOT NULL,
  generation_type text NOT NULL,
  content_text text NOT NULL,
  context_prompt text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT generation_feedback_pkey PRIMARY KEY (id),
  CONSTRAINT generation_feedback_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT generation_feedback_feedback_type_check CHECK ((feedback_type = ANY (ARRAY['like'::text, 'dislike'::text]))),
  CONSTRAINT generation_feedback_generation_type_check CHECK ((generation_type = ANY (ARRAY['post'::text, 'reply'::text])))
);

-- ── Indexes ──────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_api_keys_key_hash ON public.api_keys USING btree (key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_captured_posts_author_handle ON public.captured_posts USING btree (author_handle);
CREATE INDEX IF NOT EXISTS idx_captured_posts_inbox_status ON public.captured_posts USING btree (inbox_status);
CREATE INDEX IF NOT EXISTS idx_captured_posts_triaged_as ON public.captured_posts USING btree (triaged_as);
CREATE INDEX IF NOT EXISTS idx_captured_posts_user_id ON public.captured_posts USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON public.drafts USING btree (user_id);
CREATE INDEX IF NOT EXISTS extracted_patterns_user_batch_idx ON public.extracted_patterns USING btree (user_id, extraction_batch);
CREATE INDEX IF NOT EXISTS idx_extracted_patterns_enabled ON public.extracted_patterns USING btree (user_id, is_enabled) WHERE (is_enabled = true);
CREATE INDEX IF NOT EXISTS idx_extracted_patterns_type ON public.extracted_patterns USING btree (pattern_type);
CREATE INDEX IF NOT EXISTS idx_extracted_patterns_user_id ON public.extracted_patterns USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_gf_recent ON public.generation_feedback USING btree (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gf_user_type ON public.generation_feedback USING btree (user_id, generation_type, feedback_type);
CREATE INDEX IF NOT EXISTS idx_inspiration_posts_author ON public.inspiration_posts USING btree (author_handle) WHERE (author_handle IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_inspiration_posts_created_at ON public.inspiration_posts USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_inspiration_posts_user_id ON public.inspiration_posts USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_voice_examples_engagement ON public.user_voice_examples USING btree (user_id, engagement_score DESC);
CREATE INDEX IF NOT EXISTS idx_voice_examples_pinned ON public.user_voice_examples USING btree (user_id, pinned_rank) WHERE (pinned_rank IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_voice_examples_source ON public.user_voice_examples USING btree (user_id, source, is_excluded);
CREATE INDEX IF NOT EXISTS idx_voice_examples_user_id ON public.user_voice_examples USING btree (user_id);
CREATE INDEX IF NOT EXISTS idx_voice_settings_last_refresh ON public.user_voice_settings USING btree (last_refresh_at);
CREATE INDEX IF NOT EXISTS idx_voice_settings_user_id ON public.user_voice_settings USING btree (user_id);

-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE public.x_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x_oauth_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_voice_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inspiration_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.extracted_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.captured_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generation_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create their own API keys" ON public.api_keys;
CREATE POLICY "Users can create their own API keys" ON public.api_keys FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;
CREATE POLICY "Users can delete their own API keys" ON public.api_keys FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
CREATE POLICY "Users can update their own API keys" ON public.api_keys FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
CREATE POLICY "Users can view their own API keys" ON public.api_keys FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own captured_posts" ON public.captured_posts;
CREATE POLICY "Users can delete own captured_posts" ON public.captured_posts FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own captured_posts" ON public.captured_posts;
CREATE POLICY "Users can insert own captured_posts" ON public.captured_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own captured_posts" ON public.captured_posts;
CREATE POLICY "Users can update own captured_posts" ON public.captured_posts FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own captured_posts" ON public.captured_posts;
CREATE POLICY "Users can view own captured_posts" ON public.captured_posts FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own drafts" ON public.drafts;
CREATE POLICY "Users can delete own drafts" ON public.drafts FOR DELETE USING ((auth.uid() = user_id) OR (user_id IS NULL));
DROP POLICY IF EXISTS "Users can insert own drafts" ON public.drafts;
CREATE POLICY "Users can insert own drafts" ON public.drafts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own drafts" ON public.drafts;
CREATE POLICY "Users can update own drafts" ON public.drafts FOR UPDATE USING ((auth.uid() = user_id) OR (user_id IS NULL));
DROP POLICY IF EXISTS "Users can view own drafts" ON public.drafts;
CREATE POLICY "Users can view own drafts" ON public.drafts FOR SELECT USING ((auth.uid() = user_id) OR (user_id IS NULL));

DROP POLICY IF EXISTS "Users can delete own patterns" ON public.extracted_patterns;
CREATE POLICY "Users can delete own patterns" ON public.extracted_patterns FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own patterns" ON public.extracted_patterns;
CREATE POLICY "Users can insert own patterns" ON public.extracted_patterns FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own patterns" ON public.extracted_patterns;
CREATE POLICY "Users can update own patterns" ON public.extracted_patterns FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own patterns" ON public.extracted_patterns;
CREATE POLICY "Users can view own patterns" ON public.extracted_patterns FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own feedback" ON public.generation_feedback;
CREATE POLICY "Users manage own feedback" ON public.generation_feedback FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own inspiration_posts" ON public.inspiration_posts;
CREATE POLICY "Users can delete own inspiration_posts" ON public.inspiration_posts FOR DELETE USING ((auth.uid() = user_id) OR (user_id IS NULL));
DROP POLICY IF EXISTS "Users can insert own inspiration_posts" ON public.inspiration_posts;
CREATE POLICY "Users can insert own inspiration_posts" ON public.inspiration_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own inspiration_posts" ON public.inspiration_posts;
CREATE POLICY "Users can update own inspiration_posts" ON public.inspiration_posts FOR UPDATE USING ((auth.uid() = user_id) OR (user_id IS NULL));
DROP POLICY IF EXISTS "Users can view own inspiration_posts" ON public.inspiration_posts;
CREATE POLICY "Users can view own inspiration_posts" ON public.inspiration_posts FOR SELECT USING ((auth.uid() = user_id) OR (user_id IS NULL));

DROP POLICY IF EXISTS "Users can insert own user_settings" ON public.user_settings;
CREATE POLICY "Users can insert own user_settings" ON public.user_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own user_settings" ON public.user_settings;
CREATE POLICY "Users can update own user_settings" ON public.user_settings FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own user_settings" ON public.user_settings;
CREATE POLICY "Users can view own user_settings" ON public.user_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own voice examples" ON public.user_voice_examples;
CREATE POLICY "Users can delete own voice examples" ON public.user_voice_examples FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own voice examples" ON public.user_voice_examples;
CREATE POLICY "Users can insert own voice examples" ON public.user_voice_examples FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own voice examples" ON public.user_voice_examples;
CREATE POLICY "Users can update own voice examples" ON public.user_voice_examples FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own voice examples" ON public.user_voice_examples;
CREATE POLICY "Users can view own voice examples" ON public.user_voice_examples FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own voice settings" ON public.user_voice_settings;
CREATE POLICY "Users can delete own voice settings" ON public.user_voice_settings FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert own voice settings" ON public.user_voice_settings;
CREATE POLICY "Users can insert own voice settings" ON public.user_voice_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update own voice settings" ON public.user_voice_settings;
CREATE POLICY "Users can update own voice settings" ON public.user_voice_settings FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own voice settings" ON public.user_voice_settings;
CREATE POLICY "Users can view own voice settings" ON public.user_voice_settings FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own X connection" ON public.x_connections;
CREATE POLICY "Users can delete their own X connection" ON public.x_connections FOR DELETE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can insert their own X connection" ON public.x_connections;
CREATE POLICY "Users can insert their own X connection" ON public.x_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own X connection" ON public.x_connections;
CREATE POLICY "Users can update their own X connection" ON public.x_connections FOR UPDATE USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view their own X connection" ON public.x_connections;
CREATE POLICY "Users can view their own X connection" ON public.x_connections FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage their own OAuth requests" ON public.x_oauth_requests;
CREATE POLICY "Users can manage their own OAuth requests" ON public.x_oauth_requests FOR ALL USING (auth.uid() = user_id);
