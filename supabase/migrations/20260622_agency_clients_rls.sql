-- agency_clients: per-agency isolated client profiles (Agency tier).
--
-- This table was created out-of-band in production and was never under version
-- control. Without a checked-in migration, a fresh provision or a preview/branch
-- environment brings the table up WITHOUT row-level security — at which point
-- getClientForAgency()'s `.eq("id", clientId)` lookup (which runs on the
-- service-role client) degrades into a cross-tenant IDOR across all agencies'
-- clients. This migration is idempotent: it is a no-op against production (which
-- already has the table + RLS + policy) and provisions them correctly elsewhere.

create table if not exists public.agency_clients (
  id uuid primary key default gen_random_uuid(),
  agency_user_id uuid not null references auth.users(id) on delete cascade,
  client_name text not null,
  client_handle text,
  approval_required boolean not null default false,
  white_label jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists agency_clients_agency_user_idx
  on public.agency_clients (agency_user_id);

alter table public.agency_clients enable row level security;

-- An agency can only see/modify its own client rows. FOR ALL with a matching
-- USING + WITH CHECK so the agency_user_id can never be reassigned to another
-- user on insert/update.
drop policy if exists "agency owns its clients" on public.agency_clients;
create policy "agency owns its clients" on public.agency_clients
  for all
  using (agency_user_id = auth.uid())
  with check (agency_user_id = auth.uid());
