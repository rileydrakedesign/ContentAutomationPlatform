# ContentAutomationPlatform (Agent for X) — Implementation Notes

> This doc is meant to keep future agents/devs grounded in what the product **actually does today**.
> If you change the product surface, update this file.

## What this product is (current)
A creator operating system for X that is **extension-first**:
- save inspiration / posts from the X timeline into your dataset
- generate high-quality **replies** (primary) and drafts (secondary)
- analyze your performance (CSV upload + captured posts)
- extract patterns + suggestions grounded in your own metrics
- publish now + schedule posts via a queue/worker

## What we intentionally de‑emphasized / legacy
- **Voice memo → transcript → drafts** is legacy / not the primary workflow.
  The code paths still exist, but product direction is: **Chrome extension + reply agent + voice editing**.
- “News ingestion” is not a first-class workflow right now.

## Core data model (mental model)
There are four main buckets of data:

1) `captured_posts` — the canonical stream of posts the system can learn from.
   - includes: saved inspiration, your own posts (via sync, analytics sync, and publish backfill)

2) `user_analytics` — your uploaded X analytics CSV (used for dashboard/top posts and pattern extraction CSV-first).

3) `drafts` — generated content awaiting review/approval and optionally publish/schedule.

4) `scheduled_posts` — the publish queue source of truth (BullMQ job id stored on row).

## Publishing (critical wiring)
- `POST /api/publish/now` publishes immediately and **backfills `captured_posts`** with the posted tweet(s).
- `POST /api/publish/schedule` inserts into `scheduled_posts` and enqueues a BullMQ job.
- `scripts/publish-worker.mjs` processes jobs and **backfills `captured_posts`** on success.

## Analytics + patterns
- CSV upload: `POST /api/analytics/csv` stores a normalized `user_analytics.posts` array.
- Best-times and Insights mostly use `captured_posts` (your own posts).
- Pattern extraction: `POST /api/patterns/extract`
  - CSV-first (preferred)
  - fallback to `captured_posts` (own posts)
  - non-destructive: disables previous patterns and inserts a new batch (see `extraction_batch`).

## Inspiration (single source)
- Canonical “saved inspiration” is `inspiration_posts` (analyzed, pinnable).
- Dashboard and Create flow should read from `/api/inspiration` and `/api/inspiration/[id]`.
- Captured posts can still be used as an intake/inbox, but the *saved inspiration surface* is inspiration_posts.

## Auth model
- Web app uses Supabase cookie session.
- Extension endpoints may use Bearer tokens.

## Migrations / RLS
See `supabase/MIGRATIONS_TO_APPLY.md`.

## Local commands
```bash
npm install
npm run dev
npm run build
npm start

# worker (needs REDIS_URL + SUPABASE_SERVICE_ROLE_KEY)
npm run worker:publish
```
