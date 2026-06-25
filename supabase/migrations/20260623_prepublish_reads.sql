-- Pre-publish "engagement read" results persist so we can later validate the
-- read honestly: do drafts that read high (resembling the user's winners, with
-- green algorithm-fit flags) actually outperform their baseline once published?
-- That predicted-vs-actual loop — not a fabricated number — is how the read
-- stays trustworthy over time.
create table if not exists public.prepublish_reads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  draft_hash text not null,
  draft_type text not null default 'X_POST',
  resemblance_score integer not null,
  confidence text,
  algorithm_flags jsonb not null default '[]'::jsonb,
  matched_pattern_ids jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists prepublish_reads_user_created_idx
  on public.prepublish_reads (user_id, created_at desc);

alter table public.prepublish_reads enable row level security;

create policy "Users can view their own pre-publish reads" on public.prepublish_reads
  for select using (auth.uid() = user_id);

create policy "Users can insert their own pre-publish reads" on public.prepublish_reads
  for insert with check (auth.uid() = user_id);
