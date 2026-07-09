-- Radar Phase-1 schema (REPLY_RADAR_SCOPE §4.2 / PRD_CORE §6), pool-shaped
-- from day one: `sweep_units.owner_user_id` null means POOLED (shared, app-
-- level) — the scale architecture. The beta runs every unit per-user on user
-- tokens (owner set), which sidesteps the pooled-read ToS question and needs
-- no reshape when pooling lands: flipping to pooled is a sweep-runner change.

-- ── watches — the one discovery primitive (topic / account / custom) ────────
create table if not exists public.watches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('topic', 'account', 'custom')),
  label text not null,
  query text not null,
  keywords jsonb not null default '[]'::jsonb,
  enabled boolean not null default true,
  alert_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists watches_user_idx on public.watches (user_id);

alter table public.watches enable row level security;

create policy "Users manage their own watches" on public.watches
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── sweep_units — the billable read unit, budgeted per day ──────────────────
create table if not exists public.sweep_units (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references auth.users(id) on delete cascade, -- null = pooled
  watch_id uuid references public.watches(id) on delete cascade,
  type text not null check (type in ('topic', 'account', 'custom')),
  query text not null,
  since_id text,
  daily_read_budget integer not null default 25,
  reads_today integer not null default 0,
  reads_date date,
  reads_total bigint not null default 0,
  status text not null default 'active'
    check (status in ('active', 'paused_budget', 'disabled')),
  last_swept_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists sweep_units_owner_idx on public.sweep_units (owner_user_id, status);

-- Server-only (service role): budgets and cursors are infrastructure, not user data.
alter table public.sweep_units enable row level security;

-- ── candidate_posts — the shared pool (no user_id by design) ────────────────
-- Two metric snapshots per post give the velocity factor ("12 min old and
-- accelerating"). TTL ~7 days enforced by the sweep cron cleanup.
create table if not exists public.candidate_posts (
  post_id text primary key,
  text text not null,
  author_username text,
  author_name text,
  author_followers integer,
  posted_at timestamptz,
  reply_settings text,
  metrics jsonb not null default '{}'::jsonb,
  prev_metrics jsonb,
  prev_swept_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_swept_at timestamptz not null default now(),
  source_unit_ids uuid[] not null default '{}'
);

create index if not exists candidate_posts_last_swept_idx on public.candidate_posts (last_swept_at);

-- Server-only (service role): the pool is shared infrastructure.
alter table public.candidate_posts enable row level security;

-- ── user_target_queue — per-user ranked queue with states ───────────────────
create table if not exists public.user_target_queue (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  candidate_post_id text not null references public.candidate_posts(post_id) on delete cascade,
  watch_id uuid references public.watches(id) on delete set null,
  score numeric not null default 0,
  reasons jsonb not null default '[]'::jsonb,
  state text not null default 'new'
    check (state in ('new', 'snoozed', 'replied', 'skipped')),
  skip_reason text,
  delivered_via text not null default 'queue',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, candidate_post_id)
);

create index if not exists user_target_queue_user_state_idx
  on public.user_target_queue (user_id, state, score desc);

alter table public.user_target_queue enable row level security;

create policy "Users can view their own queue" on public.user_target_queue
  for select using (auth.uid() = user_id);

create policy "Users can update their own queue state" on public.user_target_queue
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
