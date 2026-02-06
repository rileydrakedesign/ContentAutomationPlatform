-- 20260206_publish_queue_and_byo_x_v2_job_id.sql
-- Add BullMQ job id tracking to support cancel/retry.

alter table if exists public.scheduled_posts
  add column if not exists job_id text null;

create index if not exists scheduled_posts_job_id_idx on public.scheduled_posts(job_id);
