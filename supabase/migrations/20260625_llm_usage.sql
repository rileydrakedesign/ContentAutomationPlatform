-- Per-call LLM token metering, written by the gateway (src/lib/ai/usage.ts) via
-- the service-role client. Powers cost analysis, per-user attribution, and the
-- provider TPM-headroom view. Live per-minute counters live in Redis; this is
-- the durable audit trail.
create table if not exists public.llm_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  provider text not null,
  model text not null,
  route text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists llm_usage_created_idx on public.llm_usage (created_at desc);
create index if not exists llm_usage_user_created_idx on public.llm_usage (user_id, created_at desc);
create index if not exists llm_usage_provider_created_idx on public.llm_usage (provider, created_at desc);

-- Ops-only table: RLS on with no policies = service role only.
alter table public.llm_usage enable row level security;
