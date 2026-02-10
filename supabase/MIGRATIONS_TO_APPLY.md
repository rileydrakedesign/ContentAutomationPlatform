# Supabase migrations to apply (ContentAutomationPlatform)

These migrations are required for **BYO X credentials**, **scheduled publishing**, and the **Queue** UI.

> I can’t execute the Supabase MCP from inside this chat environment directly (no MCP tool hook exposed here), so this file documents exactly what to run in the Supabase SQL editor and what RLS policies to add.

---

## 1) Apply SQL migrations (in order)

Open your Supabase project:
- Project ref: `hfoypwvlazficzvxwakb`
- Dashboard → **SQL Editor** → run each file’s SQL.

### A) `supabase/migrations/20260206_publish_queue_and_byo_x.sql`
Creates:
- `public.x_byo_apps`
- `public.scheduled_posts`

SQL:

```sql
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
```

### B) `supabase/migrations/20260206_publish_queue_and_byo_x_v2_job_id.sql`
Adds:
- `public.scheduled_posts.job_id`

SQL:

```sql
-- 20260206_publish_queue_and_byo_x_v2_job_id.sql
-- Add BullMQ job id tracking to support cancel/retry.

alter table if exists public.scheduled_posts
  add column if not exists job_id text null;

create index if not exists scheduled_posts_job_id_idx on public.scheduled_posts(job_id);
```

### C) `supabase/migrations/20260209_rls_x_byo_apps_and_scheduled_posts.sql`
Enables RLS + creates ownership policies for:
- `public.x_byo_apps`
- `public.scheduled_posts`

SQL: *(see file contents)*

### D) `supabase/migrations/20260210_extracted_patterns_extraction_batch.sql`
Adds:
- `public.extracted_patterns.extraction_batch`

### E) `supabase/migrations/20260210_user_analytics_update_with_check.sql`
Tightens RLS policy:
- Adds `WITH CHECK` to `user_analytics` UPDATE policy (prevents changing `user_id`)

### F) `supabase/migrations/20260210_inspiration_posts_voice_includes.sql`
Adds manual toggles for prompt injection:
- `inspiration_posts.include_in_post_voice`
- `inspiration_posts.include_in_reply_voice`

SQL:

```sql
-- 20260210_extracted_patterns_extraction_batch.sql
-- Add extraction_batch to extracted_patterns for non-destructive extraction runs

alter table if exists public.extracted_patterns
  add column if not exists extraction_batch timestamptz null;

create index if not exists extracted_patterns_user_batch_idx
  on public.extracted_patterns(user_id, extraction_batch);
```

SQL:

```sql
-- 20260210_user_analytics_update_with_check.sql
-- Tighten user_analytics UPDATE policy: add WITH CHECK to prevent changing user_id

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='user_analytics'
      AND policyname='Users can update their own analytics'
  ) THEN
    DROP POLICY "Users can update their own analytics" ON public.user_analytics;
  END IF;
END$$;

CREATE POLICY "Users can update their own analytics" ON public.user_analytics
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

---

## 2) RLS policies (required)

If you apply `20260209_rls_x_byo_apps_and_scheduled_posts.sql`, you can skip the manual policy creation below (it creates the same policies).

### A) `public.x_byo_apps`
1) Table Editor → `x_byo_apps` → **RLS: Enable**
2) Add policies:

```sql
-- x_byo_apps: select own
create policy "x_byo_apps_select_own"
on public.x_byo_apps
for select
to authenticated
using (user_id = auth.uid());

-- x_byo_apps: insert own
create policy "x_byo_apps_insert_own"
on public.x_byo_apps
for insert
to authenticated
with check (user_id = auth.uid());

-- x_byo_apps: update own
create policy "x_byo_apps_update_own"
on public.x_byo_apps
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- x_byo_apps: delete own
create policy "x_byo_apps_delete_own"
on public.x_byo_apps
for delete
to authenticated
using (user_id = auth.uid());
```

### B) `public.scheduled_posts`
1) Table Editor → `scheduled_posts` → **RLS: Enable**
2) Add policies:

```sql
-- scheduled_posts: select own
create policy "scheduled_posts_select_own"
on public.scheduled_posts
for select
to authenticated
using (user_id = auth.uid());

-- scheduled_posts: insert own
create policy "scheduled_posts_insert_own"
on public.scheduled_posts
for insert
to authenticated
with check (user_id = auth.uid());

-- scheduled_posts: update own
create policy "scheduled_posts_update_own"
on public.scheduled_posts
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- scheduled_posts: delete own
create policy "scheduled_posts_delete_own"
on public.scheduled_posts
for delete
to authenticated
using (user_id = auth.uid());
```

> Note: the BullMQ worker uses the **Service Role key**, so it bypasses RLS (expected). The app UI uses the anon/authenticated client, so it needs these RLS policies.

---

## 3) Quick verification checklist

After applying migrations + RLS:

1) In Supabase → Table Editor, confirm tables exist:
- `x_byo_apps`
- `scheduled_posts`

2) In the app:
- `/settings` → save BYO keys (should succeed)
- `/queue` should load (no more `PGRST205`)

3) Start worker (deployment):
- `npm run worker:publish`
- ensure env vars set: `REDIS_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

---

## 4) If you want this fully automated later
We can add a `supabase/seed.sql` + a tiny internal script that applies migrations via Supabase Management API, but that’s intentionally out of scope right now (avoids overengineering + secrets handling).
