-- Voice-check results persist so the tuner closes its loop: recurring
-- deviations across checks feed concrete dial/guardrail suggestions in the
-- Voice Tune-Up report.
create table if not exists public.voice_check_results (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_hash text not null,
  voice_type text not null check (voice_type in ('post', 'reply')),
  score integer not null,
  matches jsonb not null default '[]'::jsonb,
  deviations jsonb not null default '[]'::jsonb,
  suggested_edit text,
  created_at timestamptz not null default now()
);

create index if not exists voice_check_results_user_created_idx
  on public.voice_check_results (user_id, created_at desc);

alter table public.voice_check_results enable row level security;

create policy "Users can view their own voice check results" on public.voice_check_results
  for select using (auth.uid() = user_id);

create policy "Users can insert their own voice check results" on public.voice_check_results
  for insert with check (auth.uid() = user_id);
