# Guide: Strategy

Content strategy is your **weekly cadence** target — how many posts, threads, and
replies per week, plus optional per-pillar post targets. It feeds the assembled
voice prompt (so everything the platform writes or checks knows what you're aiming
at), and the [Voice Tune-Up](voice-tuneup.md) compares your actual cadence against
it in the Voice Report.

## Where you set it

**Settings → Strategy** (`/settings`, the Strategy tab). Strategy is no longer a
top-level page and has no dashboard progress widget — it's a setting you tune
occasionally, not a surface you visit.

## Reading strategy (API)

`GET /strategy` (scope `strategy:read`, free) → `{ strategy }`. If you've never set
one, it returns defaults (`posts_per_week: 5`, `threads_per_week: 1`,
`replies_per_week: 10`, empty `pillar_targets`).

## Setting strategy (API)

`PUT /strategy` (scope `strategy:write`, free) **upserts** — it replaces the stored
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

> **No MCP tools.** `get_strategy` / `update_strategy` were removed from the MCP
> catalog in the 2026-07 slim — strategy is a human setting, not an agent action.
> The v1 REST route and both scopes remain for integrations that need them.

## Pillars

`pillar` names should match your [niche](../architecture/voice-system.md) content
pillars (from `get_niche`) so the cadence comparison and pillar targets line up.
The Voice Report flags pillars you're under- or over-indexing on.

## Where it shows up

Your `pillar_targets` are injected into the assembled system prompt
(`prompt-assembler.ts`), so they shape the live assistant, voice-check, all
generation, `get_writing_context`, the tune-up, and insights chat — whether or not
you ever look at the Strategy tab again.
