-- Reply pool sourcing: a reply is only analyzable as a PAIR (what was said →
-- how the user answered). extension_replies already carries the parent post
-- id; this adds the parent post TEXT so the reply pool can ground reply-voice
-- analysis in context without paying an X read per row. Populated at write
-- time by every reply surface (handoff, extension send-log, timeline-sync
-- mirror via the Radar candidate pool).
alter table public.extension_replies
  add column if not exists replied_to_text text;
