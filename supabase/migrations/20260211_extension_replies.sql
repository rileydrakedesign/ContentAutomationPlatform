-- Store replies sent via Chrome extension for consistency tracking

create table if not exists public.extension_replies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reply_text text not null,
  replied_to_post_id text null,
  replied_to_post_url text null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists extension_replies_user_id_idx on public.extension_replies(user_id);
create index if not exists extension_replies_sent_at_idx on public.extension_replies(sent_at);

alter table public.extension_replies enable row level security;

create policy "Users can view their own extension replies" on public.extension_replies
  for select using (auth.uid() = user_id);

create policy "Users can insert their own extension replies" on public.extension_replies
  for insert with check (auth.uid() = user_id);

create policy "Users can delete their own extension replies" on public.extension_replies
  for delete using (auth.uid() = user_id);
