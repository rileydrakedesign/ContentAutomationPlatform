-- Daily rollup of agent-surface spend, written by /api/cron/usage-rollup.
-- est_cogs_usd is an estimate derived from credit_ledger actions (see
-- src/lib/billing/telemetry.ts for the per-action factors).
create table public.usage_daily (
  day date primary key,
  debit_count integer not null default 0,
  credits_debited integer not null default 0,
  credits_refunded integer not null default 0,
  est_cogs_usd numeric(10, 2) not null default 0,
  top_user_id uuid,
  top_user_cogs_usd numeric(10, 2),
  created_at timestamptz not null default now()
);

-- Ops-only table: RLS on with no policies = service role only.
alter table public.usage_daily enable row level security;
