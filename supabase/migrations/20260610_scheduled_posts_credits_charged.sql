-- Credits debited at schedule time (v1/MCP only; in-app schedules are 0).
-- Used to refund exactly on cancel.
alter table public.scheduled_posts
  add column credits_charged integer not null default 0;
