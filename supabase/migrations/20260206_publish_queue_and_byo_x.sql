-- 20260206_publish_queue_and_byo_x.sql
-- Adds BYO X app credentials + scheduled publishing tables.

-- BYO X app credentials (per-user)
create table if not exists public.x_byo_apps (
  user_id uuid primary key references auth.users(id) on delete cascade,
  consumer_key text not null,
  consumer_secret text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Scheduled posts
create table if not exists public.scheduled_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_id uuid null,
  content_type text not null check (content_type in ('X_POST', 'X_THREAD')),
  payload jsonb not null,
  scheduled_for timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'publishing', 'posted', 'failed', 'cancelled')),
  posted_post_ids jsonb null,
  error text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scheduled_posts_user_id_idx on public.scheduled_posts(user_id);
create index if not exists scheduled_posts_scheduled_for_idx on public.scheduled_posts(scheduled_for);

-- NOTE: RLS policies should be applied in Supabase dashboard.
-- Recommended:
-- - users can select/insert/update/delete only their own rows.
