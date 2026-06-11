-- OAuth 2.1 authorization server for the hosted MCP connector (claude.ai).
-- Public clients only (PKCE mandatory, token_endpoint_auth_method=none).
-- All tables are service-role only: RLS on, no policies.

create table public.oauth_clients (
  client_id text primary key,
  client_name text,
  client_uri text,
  logo_uri text,
  redirect_uris text[] not null,
  token_endpoint_auth_method text not null default 'none',
  grant_types text[] not null default array['authorization_code','refresh_token'],
  created_at timestamptz not null default now()
);

alter table public.oauth_clients enable row level security;

create table public.oauth_codes (
  code_hash text primary key,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scopes text[] not null,
  redirect_uri text not null,
  code_challenge text not null,
  code_challenge_method text not null default 'S256',
  resource text,
  expires_at timestamptz not null,
  used_at timestamptz
);

alter table public.oauth_codes enable row level security;

create table public.oauth_tokens (
  id uuid primary key default gen_random_uuid(),
  access_token_hash text not null unique,
  refresh_token_hash text unique,
  client_id text not null references public.oauth_clients(client_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  scopes text[] not null,
  access_expires_at timestamptz not null,
  refresh_expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index oauth_tokens_user_idx on public.oauth_tokens (user_id);

alter table public.oauth_tokens enable row level security;
