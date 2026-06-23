# Guide: Strategy

Content strategy is your **weekly cadence** target — how many posts, threads, and
replies per week, plus optional per-pillar post targets. The
[Voice Tune-Up](voice-tuneup.md) compares your actual cadence against this target
in the Voice Report, and agents use it to plan what to write.

## Reading strategy

`GET /strategy` (MCP `get_strategy`, free) → `{ strategy }`. If you've never set
one, it returns defaults (`posts_per_week: 5`, `threads_per_week: 1`,
`replies_per_week: 10`, empty `pillar_targets`).

## Setting strategy

`PUT /strategy` (MCP `update_strategy`, free) **upserts** — it replaces the stored
strategy, so pass every field you want to keep:

```json
{
  "posts_per_week": 5,
  "threads_per_week": 1,
  "replies_per_week": 10,
  "pillar_targets": [
    { "pillar": "AI/ML", "posts_per_week": 3 },
    { "pillar": "Build in public", "posts_per_week": 2 }
  ]
}
```

All numeric values are floored to integers and clamped to `>= 0`.

## Pillars

`pillar` names should match your [niche](../architecture/voice-system.md) content
pillars (from `get_niche`) so the cadence comparison and pillar targets line up.
The Voice Report flags pillars you're under- or over-indexing on.

## Putting it together

A typical planning loop for an agent:

1. `get_strategy` — the weekly target.
2. `get_best_times` — when to post (see [analytics.md](analytics.md)).
3. `get_niche` + `list_patterns` — what to post and how to frame it.
4. Write with `get_writing_context`, tune with `check_draft`, then `schedule_post`
   across the week to hit the cadence.
