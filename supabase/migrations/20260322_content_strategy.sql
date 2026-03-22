-- Content strategy: weekly posting targets by format and content pillar
create table public.content_strategy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,

  -- Weekly targets by format
  posts_per_week integer not null default 5,
  threads_per_week integer not null default 1,
  replies_per_week integer not null default 10,

  -- Weekly targets by content pillar
  -- e.g. [{"pillar": "Product Strategy", "posts_per_week": 2}]
  pillar_targets jsonb not null default '[]'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  unique(user_id)
);

alter table public.content_strategy enable row level security;

create policy "Users can manage own strategy"
  on public.content_strategy
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
