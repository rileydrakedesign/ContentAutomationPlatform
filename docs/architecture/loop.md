# The voice loop & cross-surface parity

Agents For X is built around one compounding loop. Every surface — the **web
app**, the **v1 REST API**, and the **MCP server** — lets the user travel the
whole loop, and each lap makes the next one smarter.

```
   ┌──────────────────────────────────────────────────────────────────────┐
   │  INSIGHT            CREATE            CHECK           SHIP             │
   │  what works   →   write/generate  →  score vs    →  publish / reply   │
   │  for YOU          in your voice      what works      (post or reply)  │
   │     ▲                (patterns)        (tuner)             │           │
   │     │                                                      ▼           │
   │  RE-TUNE   ◀──────  ANALYTICS  ◀──────────────────  YOUR POSTS' PERF   │
   │  (auto/nudged)      (auto-ingested, fast)                              │
   └──────────────────────────────────────────────────────────────────────┘
```

Two compounding assets power it:

1. **Voice + pattern intelligence** — the tuned voice context and the
   engagement-ranked patterns/niche derived from the user's own history.
2. **The reply engine** — finding high-momentum posts the account can actually
   reply to (eligibility + traction), then replying in the reply-voice.

Both rank everything by the one [weighted-engagement currency](../guides/analytics.md#weighted-engagement)
through the canonical [analyzable pool](../../src/lib/analysis/posts-pool.ts).

## How a lap compounds (the flywheel)

A post published through **any** surface is backfilled into `captured_posts`
immediately. The daily **loop-upkeep** step of the `daily-ops` cron then refreshes
its engagement metrics from X (ungated, newest-first), syncs paid users'
timelines, and re-ranks voice examples — so a just-published post influences the
tuning pool within **~1 day with no manual CSV upload**. See
[publishing.md](publishing.md#closing-the-loop-publish--analytics--re-tune) and
[analytics.md](../guides/analytics.md#the-flywheel-published-posts-feed-your-voice-automatically).

When analytics move ahead of the tuned context, `context_freshness.retune_recommended`
flips true. That signal is surfaced identically on every surface (a persistent
dashboard banner + next-best-action, `context_freshness` on `whoami` /
`get_writing_context` / `/me` / `/voice/context`) and one tap / one tool call
(`run_tuneup`) re-tunes.

## Parity matrix

Each loop stage is reachable on all three surfaces, or is a deliberate,
documented N/A. The core libraries are shared — the dashboard, the API, and MCP
call the *same* `runVoiceCheck`, `findReplyTargets`, `posts-pool`, and
`prompt-assembler`; nothing is forked per surface.

| Loop stage | Web app (dashboard) | v1 REST API | MCP (agents) |
| --- | --- | --- | --- |
| **Insight** — what works for you | `/insights` Voice Report, Voice Health, dashboard cards | `GET /me`, `/voice/context`, `/niche`, `/patterns`, `/analytics` | `whoami`, `get_writing_context`, `get_niche`, `list_patterns`, `get_analytics` |
| **Create in voice** — patterns at the moment of writing | `/create` composer (pattern content + lift shown; applied patterns per option) | `POST /drafts/generate` with the assembled voice context | `get_writing_context` (write it yourself) / `generate_post`, `create_draft` |
| **Check** — score vs. your voice (optional) | optional voice-check on the composer **and** the draft editor; **publish is never blocked** (Post / Voice-check first) | `POST /voice/check` (optional) | `check_draft` (separate, optional tool) |
| **Find reply targets** — repliable + high-traction | `/reply` finder **and** the Chrome extension (audited server eligibility, never a non-repliable post; graceful publish-time 403) | `GET /search/reply-targets` | `find_reply_posts` |
| **Reply in voice** — reply-voice + optional check | `/reply` (write/seed → [optional voice-check] → **handoff**: extension → X web intent → copy) + extension (generate → optional voice-check → native send) | `POST /drafts/generate` (reply), `POST /voice/check` (optional); **no reply publish** — `POST /publish/now` returns 410 for `X_REPLY` | `generate_reply`, `check_draft` (optional), then hand off via the target's `intent_url` (no `publish_reply` tool) |
| **Ship** — publish / schedule (with media) | draft editor (X-accurate counter, image/GIF/video + alt text, link preview, reply audience). Replies never ship from the app — the human sends them in X | `POST /publish/now`, `/publish/schedule` (posts/threads only); media via `POST /api/x/media/upload` | `publish_post` / `publish_thread`, `schedule_post` |
| **Ingest** — feed analytics back | automatic daily loop-upkeep + CSV upload + `POST /analytics/sync` | `POST /analytics/sync` | `sync_analytics` (+ automatic daily upkeep) |
| **Re-tune** — when fresh signal lands | persistent re-tune banner + next-best-action + one-tap Voice Tune-Up | `context_freshness` on `/me` & `/voice/context`; run the tune-up endpoint | `run_tuneup`; `context_freshness` on `whoami` / `get_writing_context` |
| **Cold start** — first-session value | first-run bootstrap on X connect (`/api/x/bootstrap`: timeline sync + first tune-up) | N/A — agents act on already-connected accounts | N/A — agents act on already-connected accounts |

The two **N/A** cells are deliberate: connecting an X account and the first-run
analysis are human onboarding actions in the web app; the API and MCP surfaces
operate on an account that is already connected and tuned.

## Same logic, three doors

- **One voice context** — [`prompt-assembler`](../../src/lib/openai/prompts/prompt-assembler.ts)
  builds it for every surface (see [voice-system.md](voice-system.md)).
- **One voice-check** — [`runVoiceCheck`](../../src/lib/analysis/voice-check.ts)
  powers the dashboard tuner, `POST /voice/check`, and `check_draft`.
- **One reply engine** — [`findReplyTargets`](../../src/lib/x-api/reply-targets.ts)
  (eligibility via [`search-mapping.ts`](../../src/lib/x-api/search-mapping.ts))
  powers `/reply`, the extension, `GET /search/reply-targets`, and `find_reply_posts`.
  The same module's `isReplyForbiddenError` makes a publish-time 403 a clean,
  refunded outcome on every surface.
- **Voice-check is optional on every surface** — never a precondition to publish.
  The web app offers Post / Voice-check-first; the agent surfaces keep
  `check_draft` a separate, optional tool from `publish_*`. See
  [voice-system.md](voice-system.md#voice-check-is-optional-everywhere).
- **One engagement currency, one credit currency, one scope model** — see
  [overview.md](overview.md).
