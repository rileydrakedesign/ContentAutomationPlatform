create table if not exists waitlist_signups (
  id bigint generated always as identity primary key,
  email text not null unique,
  created_at timestamptz not null default now()
);
