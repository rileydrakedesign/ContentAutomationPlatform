# Guide: Voice Tune-Up

The Voice Tune-Up is the "analyze" half of the loop: it re-derives everything the
[voice system](../architecture/voice-system.md) uses from your latest posts, then
hands back a report you (or an agent) can act on.

## Running it

- **API:** `POST /insights/tuneup` (scope `voice:write`, **5 credits**).
- **MCP:** `run_tuneup`.

It runs over your complete post pool and performs:

1. **Refresh voice examples** — re-selects your top posts/replies as examples.
2. **Extract proven patterns** — re-mines high-performing patterns (Pro; skipped
   gracefully otherwise).
3. **Analyze niche & positioning** — recomputes the niche profile.

If there aren't enough posts to analyze, it returns `422` and the credits are
refunded.

## The Voice Report

The response (`{ report }`) summarizes:

- niche & positioning,
- top patterns and top posts,
- cadence vs. your [strategy](strategy.md),
- top patterns **with provenance** — each shows the user's own top posts it was
  mined from and the engagement multiplier ("this hook came from these posts,
  ×2.4"), so the voice depth is *demonstrated*, not claimed,
- recurring **voice-check deviations** with concrete settings suggestions,
- feedback themes (from `send_feedback`),
- inspiration alignment,
- context freshness.

The Voice Report is **shareable**: `POST /api/insights/share` returns a public,
opt-in link (`/share/{token}`) that renders a branded, screenshot-ready card —
the proof artifact for evaluation and word-of-mouth. Revoke with `DELETE`.

## Viewing the latest report without re-running (free)

The Voice Report is the product's core "demonstrate, don't claim" artifact, so it
must be openable any time — not only in the session a tune-up ran.
`GET /api/insights/report` (free, read-only) rebuilds the latest report from
already-stored state (niche profile, enabled patterns with provenance, top posts,
cadence, feedback, freshness) using the **same** assembler the tune-up calls after
it writes (`assembleVoiceReportFromStoredState` in
[`src/lib/analysis/tuneup.ts`](../../src/lib/analysis/tuneup.ts)) — so the view
never drifts from the live tables. It returns `404` when no analysis has run yet.

On `/insights` the report is loaded on mount and shown by default when one
exists; the button reads **"Run Voice Tune-Up"** for the first run and
**"Refresh Voice Tune-Up"** (5 credits) thereafter. Navigating away and back keeps
the report visible with **no new credit charge**.

## When to re-tune (freshness signals)

`whoami` and `get_writing_context` include `context_freshness`. When
`retune_recommended` is `true`, your analytics are newer than your tuned context
(new posts since the last analysis) — a good moment to run the tune-up so
generation and voice-checks reflect what's working now.

Good triggers:

- `retune_recommended: true`,
- after importing a CSV or running `sync_analytics`,
- after a noticeable change in what performs.

## Automatic & nudged re-tuning

You rarely have to think about this. The loop keeps itself fresh:

- **First session (cold start).** When you connect X, the dashboard runs a
  one-time bootstrap (`POST /api/x/bootstrap`) — it syncs your timeline and runs a
  full tune-up — so your very first session shows real niche, patterns, and top
  posts with **no manual CSV upload**.
- **Daily upkeep.** The `daily-ops` cron refreshes your published posts' metrics,
  syncs paid timelines, and re-ranks voice examples each day, so the pool behind a
  tune-up is never more than ~a day stale. See
  [analytics.md](analytics.md#the-flywheel-published-posts-feed-your-voice-automatically).
- **Persistent nudge.** While `retune_recommended` is true, the dashboard shows a
  persistent (non-dismissible, self-clearing) re-tune banner and surfaces "re-tune"
  as the next best action. It disappears the moment you tune up.

## After a tune-up

The refreshed examples, patterns, and niche immediately flow into the assembled
prompt, so the next `get_writing_context` / `generate_*` and `check_draft` use
them. Review the report's settings suggestions and apply them with
`update_voice_settings` if they fit. See [patterns.md](patterns.md) to curate
which patterns stay enabled.
