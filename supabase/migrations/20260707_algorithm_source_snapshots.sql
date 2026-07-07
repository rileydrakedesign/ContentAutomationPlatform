-- Algorithm source snapshots — storage for the algo-watch cron.
--
-- Each row is one observed commit of github.com/xai-org/x-algorithm with the
-- extracted structural surface our claims KB (src/lib/analysis/x-algorithm.ts)
-- makes claims about. The cron diffs consecutive snapshots and sets
-- review_required when the structure changed, so algorithm releases become a
-- reviewed diff instead of silent claim drift.

create table if not exists public.algorithm_source_snapshots (
  id uuid primary key default gen_random_uuid(),
  fetched_at timestamptz not null default now(),
  commit_sha text not null unique,
  commit_date timestamptz,
  scorer_terms jsonb not null default '[]'::jsonb,
  readme_heads jsonb not null default '[]'::jsonb,
  classifier_files jsonb not null default '[]'::jsonb,
  filter_files jsonb not null default '[]'::jsonb,
  diff_summary text,
  review_required boolean not null default false
);

create index if not exists algorithm_source_snapshots_fetched_at_idx
  on public.algorithm_source_snapshots (fetched_at desc);

-- Service-role only: written and read by the algo-watch cron. RLS is enabled
-- with no user policies, so anon/authenticated clients have no access.
alter table public.algorithm_source_snapshots enable row level security;
