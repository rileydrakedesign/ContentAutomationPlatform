# Background Jobs (Cron & Queues) — Source of Truth

> How scheduled and async work runs. **Updated:** 2026-06-26.
> Code: `src/app/api/cron/*`, `src/app/api/qstash/*`, schedule config in `vercel.json`.

---

## 1. Scheduled jobs (Vercel Cron)

Vercel only schedules **two** entrypoints (`vercel.json` → `crons`); everything else is
orchestrated by `daily-ops` or invoked on demand.

| Schedule (UTC) | Path | What it does |
|---|---|---|
| `30 0 * * *` (00:30 daily) | `/api/cron/daily-ops` | The maintenance orchestrator — see below |
| `0 5 * * *` (05:00 daily) | `/api/cron/publish-scheduled` | Sweeps due scheduled posts → publishes via the X client (see [publishing](../features/publishing-and-scheduling.md)) |

All cron routes are **secret-gated** (`CRON_SECRET` — missing locally, which is why the dev
server warns; harmless for non-cron work).

### `daily-ops` — the orchestrator (`src/app/api/cron/daily-ops/route.ts`)

Runs in sequence:
1. **Allowance reset** — `resetDueAllowances()` (monthly credit allowances past due).
2. **Usage rollup** — `computeDailyUsage(yesterday)` → `storeDailyUsage()`.
3. **Per-user loop upkeep** (`runLoopUpkeep`, for each connected account):
   - `refreshOwnPostMetrics()` — pull fresh engagement on the user's own posts.
   - `syncUserTimeline()` — gated by subscription.
   - `refreshVoiceExamples()` — when due (`src/lib/analysis/voice-refresh.ts`).
   - `refreshVoiceVectors()` — rebuild the assistant's L2 centroids (`.catch` best-effort).

### Standalone cron routes (callable, not on the Vercel schedule)

These exist as individually-invocable endpoints (manual/ad-hoc, or future schedules);
`daily-ops` covers the same maintenance on the live schedule:

`analytics-sync` · `voice-refresh` · `credits-reset` · `assistant-vectors` ·
`usage-rollup` · `metrics-refresh` — all under `src/app/api/cron/`.

> When adding a *new* scheduled job: either fold it into `daily-ops` (preferred for daily
> maintenance) or add a `crons` entry in `vercel.json`. A route directory alone does **not**
> schedule anything.

## 2. Async queues (QStash)

Long/retryable work is offloaded to **Upstash QStash** (`@upstash/qstash`) so request paths
stay fast and survive cold starts.

| Route | Purpose |
|---|---|
| `/api/qstash/publish` | Process a queued publish |
| `/api/qstash/failure` | QStash failure callback (dead-letter handling) |

> **Removed (2026-07):** `/api/qstash/llm-job`, the async worker for agentic generation.
> The agentic pipeline and its `generate-agentic` / `generation-jobs` routes are retired
> ([generation](../features/generation.md)); generation is now a single synchronous call.
> Publishing is the only QStash workload.

## 3. Rate limiting / burst guards

LLM routes are wrapped with per-user/global guards (`withLlmGuard` / `guardLlmRoute`) backed
by `@upstash/ratelimit` + Redis, so a runaway loop can't fan out unbounded calls. See
[billing-plans-and-credits](../features/billing-plans-and-credits.md) for the quota/credit
gates that sit alongside these.

## 4. Related docs

- [publishing-and-scheduling.md](../features/publishing-and-scheduling.md) — the publish queue lifecycle.
- [analysis-and-insights.md](../features/analysis-and-insights.md) — what the sync/rollup jobs feed.
- [deployment.md](deployment.md) — where these run.
