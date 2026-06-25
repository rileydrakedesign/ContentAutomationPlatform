-- Async generation jobs for the agentic pipeline. When AGENTIC_ASYNC is on, the
-- heavy research→draft→voice-check chain runs in a QStash worker instead of
-- holding a 300s serverless function, so traffic spikes queue and drain at a
-- bounded rate rather than saturating functions and the provider budget.
--
-- `progress` accumulates step-level PipelineEvents (token deltas are omitted to
-- keep the row small); the client polls the status endpoint and rebuilds the
-- chain UI from it. `result` holds the final option + voice check + sources.
create table if not exists public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null default 'agentic_post',
  status text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  input jsonb not null default '{}'::jsonb,
  progress jsonb not null default '[]'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists generation_jobs_user_created_idx
  on public.generation_jobs (user_id, created_at desc);

alter table public.generation_jobs enable row level security;

-- Users poll their own jobs. Inserts/updates happen via the service-role worker
-- (bypasses RLS), so no write policies are defined.
create policy "Users can view their own generation jobs" on public.generation_jobs
  for select using (auth.uid() = user_id);
