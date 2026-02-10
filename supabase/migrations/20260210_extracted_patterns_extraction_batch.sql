-- Add extraction_batch to extracted_patterns for non-destructive extraction runs

alter table if exists public.extracted_patterns
  add column if not exists extraction_batch timestamptz null;

create index if not exists extracted_patterns_user_batch_idx
  on public.extracted_patterns(user_id, extraction_batch);
