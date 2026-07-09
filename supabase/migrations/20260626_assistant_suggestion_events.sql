-- Writing-assistant suggestion telemetry.
--
-- We tune the live-read trigger by *value*, not fire-rate (GitHub's "accepted and
-- retained characters" lesson). This table logs when a suggestion is accepted,
-- dismissed, or — 15s after an accept — still retained (not undone), along with the
-- finding's class/source/signal and the L2 voice score at the time. Fully
-- best-effort: the client fires these and never blocks on them.
create table if not exists public.assistant_suggestion_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,            -- 'accept' | 'dismiss' | 'retain'
  finding_class text,              -- correctness | clarity | voice | reach
  source text,                     -- tier0 | live
  signal text,                     -- e.g. external_link, voice_drift, markdown
  voice_score integer,             -- L2 voice score at the moment (for value tuning)
  created_at timestamptz not null default now()
);

alter table public.assistant_suggestion_events enable row level security;

create policy "Users can view their own suggestion events" on public.assistant_suggestion_events
  for select using (auth.uid() = user_id);

create policy "Users can insert their own suggestion events" on public.assistant_suggestion_events
  for insert with check (auth.uid() = user_id);

create index if not exists assistant_suggestion_events_user_created_idx
  on public.assistant_suggestion_events (user_id, created_at desc);
