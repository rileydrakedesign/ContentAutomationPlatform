-- Writing-assistant L2 voice/performance vectors.
--
-- The always-on live loop scores "does this sound like me / like my winners?" by
-- cosine similarity of the draft's embedding against two cached centroids, instead
-- of an LLM call on every pause. This table holds those per-user centroids plus a
-- per-user calibration that maps raw cosine → a 0-100 score tracking the (rarer)
-- L3 LLM judgment.
--
-- Centroids are stored as jsonb float arrays (pgvector not assumed); cosine is
-- computed in JS at this scale. `calibration` accumulates an online least-squares
-- fit of cosine → LLM voice score (see src/lib/analysis/assistant/vectors.ts).
create table if not exists public.user_assistant_vectors (
  user_id uuid primary key references auth.users(id) on delete cascade,
  voice_centroid jsonb not null default '[]'::jsonb,   -- L2-normalized average of voice-corpus embeddings
  winners_centroid jsonb not null default '[]'::jsonb, -- L2-normalized average of top-performer embeddings
  dims integer not null default 0,
  model text,
  sample_count integer not null default 0,             -- voice-corpus texts behind voice_centroid
  winners_count integer not null default 0,            -- winner texts behind winners_centroid
  calibration jsonb,                                    -- { n, sx, sy, sxx, sxy } online-regression accumulators
  updated_at timestamptz not null default now()
);

alter table public.user_assistant_vectors enable row level security;

-- The score/refresh routes run with the user's own client, so they need to read
-- and upsert their own row. The cron uses the service role and bypasses RLS.
create policy "Users can view their own assistant vectors" on public.user_assistant_vectors
  for select using (auth.uid() = user_id);

create policy "Users can insert their own assistant vectors" on public.user_assistant_vectors
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own assistant vectors" on public.user_assistant_vectors
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- L3 read cache. The L3 LLM read (anchored voice-drift findings + missing-pattern
-- chips + rewrites) is rare and unmetered, but identical drafts shouldn't re-hit
-- the model across sessions/devices. Keyed by (user, draft_hash, voice_type); the
-- full findings payload (with verbatim quotes) is stored so it can be re-anchored
-- against the live text on return. This is the durable read-first cache that
-- replaces the old write-only persistence.
create table if not exists public.assistant_live_reads (
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_hash text not null,
  voice_type text not null default 'post',
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, draft_hash, voice_type)
);

alter table public.assistant_live_reads enable row level security;

create policy "Users can view their own assistant live reads" on public.assistant_live_reads
  for select using (auth.uid() = user_id);

create policy "Users can insert their own assistant live reads" on public.assistant_live_reads
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own assistant live reads" on public.assistant_live_reads
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
