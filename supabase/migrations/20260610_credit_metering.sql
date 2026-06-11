-- Credit metering for the agent surface (v1 API + MCP).
-- Two buckets: `balance` (monthly allowance, resets non-additively) and
-- `pack_balance` (purchased packs, never expire while subscribed).
-- Debits draw allowance first, then packs. Refunds go to allowance only —
-- refunding into packs would let schedule+cancel launder expiring credits
-- into non-expiring ones.
-- Applied to live via Supabase MCP apply_migration: credit_ledger_and_metering

create table public.user_credits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance integer not null default 0 check (balance >= 0),
  pack_balance integer not null default 0 check (pack_balance >= 0),
  monthly_allowance integer not null default 0,
  allowance_resets_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.user_credits enable row level security;

create policy "Users can read own credits"
  on public.user_credits for select
  using (auth.uid() = user_id);

create table public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  delta integer not null,
  balance_after integer not null,
  action text not null,
  reference_id text,
  pack_id text,
  created_at timestamptz not null default now()
);

create index credit_ledger_user_created_idx
  on public.credit_ledger (user_id, created_at desc);

alter table public.credit_ledger enable row level security;

create policy "Users can read own ledger"
  on public.credit_ledger for select
  using (auth.uid() = user_id);

-- Initialize (or re-sync plan allowance for) a user's credits row, applying a
-- due monthly reset if one is pending. Safe to call on every metered request.
create or replace function public.ensure_user_credits(
  p_user_id uuid,
  p_allowance integer
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into user_credits (user_id, balance, monthly_allowance, allowance_resets_at)
  values (p_user_id, p_allowance, p_allowance, now() + interval '1 month')
  on conflict (user_id) do nothing;

  -- Keep allowance in sync with plan; upgrades/downgrades apply at next reset
  -- (balance is left alone mid-cycle).
  update user_credits
  set monthly_allowance = p_allowance,
      updated_at = now()
  where user_id = p_user_id
    and monthly_allowance is distinct from p_allowance;

  update user_credits
  set balance = monthly_allowance,
      allowance_resets_at = now() + interval '1 month',
      updated_at = now()
  where user_id = p_user_id
    and allowance_resets_at is not null
    and allowance_resets_at <= now();
end;
$$;

-- Atomically debit credits (allowance bucket first, then packs).
-- Returns {ok, total, required?}.
create or replace function public.debit_credits(
  p_user_id uuid,
  p_amount integer,
  p_action text,
  p_reference text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row user_credits%rowtype;
  v_from_balance integer;
  v_total integer;
begin
  if p_amount < 0 then
    raise exception 'debit amount must be >= 0';
  end if;

  select * into v_row from user_credits where user_id = p_user_id for update;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_credits_row', 'total', 0);
  end if;

  v_total := v_row.balance + v_row.pack_balance;

  if v_total < p_amount then
    return jsonb_build_object(
      'ok', false, 'error', 'insufficient_credits',
      'total', v_total, 'required', p_amount
    );
  end if;

  v_from_balance := least(v_row.balance, p_amount);

  update user_credits
  set balance = balance - v_from_balance,
      pack_balance = pack_balance - (p_amount - v_from_balance),
      updated_at = now()
  where user_id = p_user_id;

  v_total := v_total - p_amount;

  if p_amount > 0 then
    insert into credit_ledger (user_id, delta, balance_after, action, reference_id)
    values (p_user_id, -p_amount, v_total, p_action, p_reference);
  end if;

  return jsonb_build_object('ok', true, 'total', v_total);
end;
$$;

-- Grant credits: pack purchases go to the pack bucket, refunds to allowance.
create or replace function public.grant_credits(
  p_user_id uuid,
  p_amount integer,
  p_action text,
  p_to_pack boolean default false,
  p_pack_id text default null,
  p_reference text default null
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
begin
  if p_amount <= 0 then
    raise exception 'grant amount must be > 0';
  end if;

  insert into user_credits (user_id, balance, pack_balance, monthly_allowance, allowance_resets_at)
  values (
    p_user_id,
    case when p_to_pack then 0 else p_amount end,
    case when p_to_pack then p_amount else 0 end,
    0,
    now() + interval '1 month'
  )
  on conflict (user_id) do update
  set balance = user_credits.balance + (case when p_to_pack then 0 else excluded.balance end),
      pack_balance = user_credits.pack_balance + (case when p_to_pack then excluded.pack_balance else 0 end),
      updated_at = now();

  select balance + pack_balance into v_total
  from user_credits where user_id = p_user_id;

  insert into credit_ledger (user_id, delta, balance_after, action, pack_id, reference_id)
  values (p_user_id, p_amount, v_total, p_action, p_pack_id, p_reference);

  return jsonb_build_object('ok', true, 'total', v_total);
end;
$$;

-- Cron entrypoint: reset every due allowance. Returns number of users reset.
create or replace function public.reset_due_allowances()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with due as (
    update user_credits
    set balance = monthly_allowance,
        allowance_resets_at = now() + interval '1 month',
        updated_at = now()
    where allowance_resets_at is not null
      and allowance_resets_at <= now()
    returning user_id, monthly_allowance, balance + pack_balance as total
  ),
  logged as (
    insert into credit_ledger (user_id, delta, balance_after, action)
    select user_id, monthly_allowance, total, 'allowance.reset'
    from due
    returning 1
  )
  select count(*) into v_count from logged;

  return coalesce(v_count, 0);
end;
$$;

-- Service-role only: these run via the admin client; never from browsers.
revoke execute on function public.ensure_user_credits(uuid, integer) from public, anon, authenticated;
revoke execute on function public.debit_credits(uuid, integer, text, text) from public, anon, authenticated;
revoke execute on function public.grant_credits(uuid, integer, text, boolean, text, text) from public, anon, authenticated;
revoke execute on function public.reset_due_allowances() from public, anon, authenticated;
