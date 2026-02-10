-- Add manual include toggles for inspiration injection into voice prompts

alter table if exists public.inspiration_posts
  add column if not exists include_in_post_voice boolean not null default false,
  add column if not exists include_in_reply_voice boolean not null default false;

create index if not exists inspiration_posts_user_include_post_idx
  on public.inspiration_posts(user_id, include_in_post_voice);

create index if not exists inspiration_posts_user_include_reply_idx
  on public.inspiration_posts(user_id, include_in_reply_voice);
