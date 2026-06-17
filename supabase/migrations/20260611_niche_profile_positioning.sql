-- Positioning analysis on the niche profile: { target_audience, unique_angle,
-- positioning_statement } produced by /api/niche/analyze.
alter table public.user_niche_profile
  add column if not exists positioning jsonb;
