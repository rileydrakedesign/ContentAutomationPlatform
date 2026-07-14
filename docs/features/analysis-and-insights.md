# Analytics & Insights — Source of Truth

> How own-data flows in (X API sync + CSV), how it is scored and attributed, and how the X-algorithm model grounds every "will this perform?" surface. **Status (2026-06-26):** live in production; prepublish-read persistence and the green-flag validation loop are best-effort/aspirational.

---

## 1. Role: collapsing algorithm opacity; grounding the wedge

The product thesis is "make growth legible" — collapse the opacity of the X
ranker into something a user can see and act on. Two mechanisms do that work and
both live here:

1. **Own-data grounding (the wedge).** Every analysis and generation surface
   reads the user's *own* posting history through one pool and ranks it by one
   engagement currency, so niche, patterns, examples, timing, and the
   prepublish read all describe the same set of posts
   (`src/lib/analysis/posts-pool.ts:1`).
2. **Algorithm transparency.** A documented model of X's ranker
   (`src/lib/analysis/x-algorithm.ts`) powers the prepublish read's
   algorithm-fit flags and the "how X treats your actions" panel — explainable,
   not a black-box score.

Outcome attribution ("your AFX-assisted posts vs. your baseline",
`src/lib/analysis/attribution.ts:1`) is the retention/advocacy proof: it
demonstrates results instead of claiming them.

---

## 2. Data ingestion → `user_analytics`

There are **three ingestion paths**, plus a refresh seam. All original-post
analytics land in the `user_analytics` row's `posts` JSONB array
(`PostAnalytics[]`), keyed by `user_id`, latest-by-`uploaded_at`.

### 2a. X API timeline sync (paid)
`syncUserTimeline` (`src/lib/analysis/timeline-sync.ts:33`) pages the X API
(default 2 pages × 100 tweets, `timeline-sync.ts:38,51`), maps each tweet via
`mapV2ToPostAnalytics`, and **merges** live metrics into the existing
`user_analytics.posts` keyed by `post_id` — API metrics overwrite, CSV-only
fields are preserved, `data_source` becomes `"both"`
(`timeline-sync.ts:86-103`). It caps the blob (`capPostsByRecency`,
`timeline-sync.ts:105`), recomputes `total_posts`/`total_replies`/`date_range`,
upserts, and stamps `x_connections.last_api_sync_at` (`timeline-sync.ts:135`).

- **User-triggered:** `POST /api/analytics/sync` — gated by `xApiSync` feature
  (`src/app/api/analytics/sync/route.ts:26`) and metered via credits
  (`requireCredits("analytics.sync")`, refunded on failure,
  `analytics/sync/route.ts:32-45`) because it hits the paid X API.
- **Automatic:** `GET /api/cron/analytics-sync` iterates all `x_connections`,
  re-checks the `xApiSync` plan gate per user, and syncs sequentially to respect
  rate limits (`src/app/api/cron/analytics-sync/route.ts:53-72`). The daily-ops
  cron drives this; the route remains for manual triggering.

### 2b. CSV upload
`POST /api/analytics/csv` accepts an X-analytics CSV (≤10 MB, `.csv` mime/ext
checks, `src/app/api/analytics/csv/route.ts:66-83`) and calls
`importAnalyticsCsv` (`src/lib/analysis/csv-import.ts:242`).
`parseXAnalyticsCsv` (`csv-import.ts:79`) does header-fuzzy column mapping,
quote-aware line parsing, and date parsing (ISO or `M/D/YYYY h:mm AM/PM`,
`csv-import.ts:58-77`); replies are detected by leading `@` (`csv-import.ts:30`).
`storeAnalyticsCsv` (`csv-import.ts:179`) merge-stores by `post_id` (new rows
overwrite — fresher metrics), caps by recency, and returns a summary
(`newly_added`/`updated_metrics`). `GET /api/analytics/csv` returns the latest
stored row.

### 2c. Browser-scrape sync → `captured_posts`
`POST /api/x/analytics-sync` (`src/app/api/x/analytics-sync/route.ts:37`) takes
top posts + replies scraped by the browser/extension and writes them to
**`captured_posts`** (not `user_analytics`) as `is_own_post: true`,
`triaged_as: "my_post"` (`x/analytics-sync/route.ts:77-118`). Dedups by
`x_post_id`; for posts already present it **merges** impression data into the
existing `metrics` JSON rather than overwriting (`x/analytics-sync/route.ts:140-163`).

### 2d. Own-post metrics refresh (the flywheel seam, ungated)
`refreshOwnPostMetrics` (`src/lib/analysis/own-posts-refresh.ts`) pulls fresh X
metrics for the user's own `captured_posts` — including everything published
through app/API/MCP, which is backfilled with `metrics: {}`. This is **not**
plan-gated; it is the only thing keeping the loop fresh for free users
(`own-posts-refresh.ts:1-16`). Driven by `GET /api/cron/metrics-refresh`
(`src/app/api/cron/metrics-refresh/route.ts:48-56`).

### Retention cap
`capPostsByRecency` keeps the most-recent `MAX_ANALYTICS_POSTS = 2000` by date,
so the JSONB blob can't grow unbounded
(`src/lib/utils/analytics-retention.ts:5-17`). Used by both the CSV and API
merge paths.

---

## 3. The analyzable-posts pool & `weightedEngagement` (canonical)

### `getAnalyzablePosts` — one pool everywhere
`src/lib/analysis/posts-pool.ts:43` merges three sources, deduped by tweet id,
into a single ranked `AnalyzablePost[]`:

| Source | Table | Role |
|---|---|---|
| `analytics` | `user_analytics.posts` | Primary (latest CSV/API row) |
| `captured` | `captured_posts` (`is_own_post=true`, ≤500) | Supplement; skips ids already seen |
| `extension_reply` | `extension_replies` (≤500, only if `includeReplies`) | Reply pool, no metrics yet |

Each post carries normalized `metrics` and `engagement_score =
weightedEngagement(metrics)` (`posts-pool.ts:107,140`). The whole pool is sorted
**best-first by `engagement_score`** (`posts-pool.ts:175`) — "one ranking
everywhere." Original posts only by default (`includeReplies=false`,
`minTextLength=10`, `posts-pool.ts:48`). This is the pool the niche analyzer,
pattern extractor, voice refresh, best-times, and the prepublish read all read —
see the voice-engine doc.

### `weightedEngagement` — the one currency
`src/lib/utils/engagement.ts:24`. Accepts both `captured_posts` and CSV field
names (`retweets|reposts`, `views|impressions`). Weights:

```
replies ×10 · retweets/reposts ×3 · bookmarks ×3 · likes ×1 · impressions ×0.001
```

Anchored to X's documented 2023 heavy-ranker ordering (reply ≫ retweet ≈
bookmark > like) but **compressed** from X's literal ~27× reply weight; bookmarks
kept elevated as a high-intent "save" signal (`engagement.ts:1-16`). Per the git
log this was a deliberate **recalibration** (commit `5d982bb1`, "recalibrate
engagement weights"). Changing these re-ranks the pool and therefore re-derives
extracted-pattern multipliers on the next extraction (`engagement.ts:14-15`). An
ordering-consistency test pins this ordering equal to the x-algorithm model
(`x-algorithm.ts:18-20`).

---

## 4. The X-algorithm model

`src/lib/analysis/x-algorithm.ts` is the single source of truth for "how the
algorithm treats your actions."

### Weights
`X_ALGORITHM_WEIGHTS` (`x-algorithm.ts:50`) is the documented heavy-ranker table,
most-positive → most-negative, with `like` as the unit reference (weight 0.5):

| Signal | Weight | Effect | ~× a like |
|---|---|---|---|
| `reply_engaged_by_author` | 75 | + | ~150× |
| `reply` | 13.5 | + | ~27× |
| `good_profile_click` | 12 | + | ~24× |
| `good_click` | 11 | + | ~22× |
| `video_dwell` | 10 | + | ~20× |
| `retweet` | 1 | + | ~2× |
| `like` | 0.5 | + | 1× |
| `external_link` | `null` (heuristic) | − | demoted 30–50%+ |
| `negative_feedback` | −74 | − | block/mute/"show less" |
| `report` | −369 | − | most damaging |

`buildAlgorithmNotes()` (`x-algorithm.ts:181`) projects this into the
transparency payload for the "How X treats your actions" panel — static, shown
even with zero user data.

### The 2023 → 2025 ranker caveat
The header (`x-algorithm.ts:11-17`) and `X_ALGORITHM_CAVEAT`
(`x-algorithm.ts:166`) are explicit: these are an **April 2023 snapshot** of a
system X is actively changing — external-link demotion tightened through 2025,
and X announced (Oct 2025) a migration to a **Grok-based recommender**. The rule:
treat the *ordering* (replies ≫ retweets > likes; conversation + dwell win;
negative feedback brutal; links demoted) as durable, the exact numbers as
directional. The caveat must be surfaced wherever weights are shown.

### Shared phrase lists (parity-tested)
- `REPLY_DRIVING` (`x-algorithm.ts:131`) — phrasing that invites a reply (the
  top positive lever).
- `ENGAGEMENT_BAIT` (`x-algorithm.ts:151`) — "RT if / follow for / tag someone"
  asks that risk block/mute (−74 each).

Both are imported by **both** the writing assistant's Tier-0 engine (`tier0.ts`)
and the prepublish read, with a parity test pinning them equal
(`x-algorithm.ts:127-129,150`) — the deterministic layers never drift.

---

## 5. Prepublish read

`runPrepublishRead` (`src/lib/analysis/prepublish-read.ts:184`) is the honest
answer to "predict engagement before I post." Deliberately **not** a trained
per-user classifier (overfits power-law tweet data, discards audience size,
`prepublish-read.ts:4-7`). Output is **resemblance + algorithm-fit, never a
fabricated like count** (`prepublish-read.ts:20-22`). Three layers, ordered by
trust:

1. **Algorithm-fit flags (deterministic, zero-data).**
   `computeAlgorithmFlags(draftText, {hasMedia, isThread})`
   (`prepublish-read.ts:100`) is pure and unit-testable. It emits flags for:
   reply hook present/absent via `REPLY_DRIVING` (`prepublish-read.ts:108-122`),
   external link penalty via `containsUrl` (`prepublish-read.ts:125-132`), native
   media dwell (`:135`), dwell-worthy length/thread (≥180 chars, `:145`), and
   engagement-bait caution via `ENGAGEMENT_BAIT` (`:155`). Plus
   `buildAlgorithmNotes()` for transparency (`prepublish-read.ts:195`).
2. **Pattern read.** Fetches the user's enabled, generation-applicable
   `extracted_patterns` (`fetchEnabledPatterns`, `prepublish-read.ts:348`;
   filtered by `isGenerationApplicablePattern`, `:211`) — which proven patterns
   the draft hits, and which high-lift (`multiplier > 1`) ones it misses
   (`prepublish-read.ts:290-313`).
3. **Resemblance (retrieval, not training).** One `fast`-tier LLM call
   (`prepublish-read.ts:267`, temp 0.1, JSON) judges the draft against the
   pool's top 8 winners vs. a median sample, returning a 0–100
   `resemblance_score`, matched/missing pattern ids, and a one-line summary
   (`prepublish-read.ts:230-263`). Score clamped 0–100 (`:284`).

**Cold-start:** if the pool is empty, returns the algorithm layer only with a
neutral `resemblance_score: 50`, `confidence: "low"`, and a nudge to run a
tune-up (`prepublish-read.ts:217-228`).

**Confidence:** `pickConfidence(poolSize, patternCount)` —
`high` if pool ≥50 **and** patterns ≥3; `medium` if pool ≥15; else `low`
(`prepublish-read.ts:167-171`).

**Persistence (best-effort).** Inserts into `prepublish_reads` (draft hash,
type, score, confidence, flags, matched ids) to feed a **future** "did
green-flag drafts actually outperform baseline?" validation loop; failure
(e.g. table not migrated) is logged, never fatal
(`prepublish-read.ts:330-343`).

**Route.** `POST /api/prepublish-read` (`src/app/api/prepublish-read/route.ts:20`)
— dual-auth (dashboard cookie + extension Bearer, `:22`), `requireAiGeneration`
gate (`:28`), min 5 chars (`:39`), `maxDuration = 60` (`:4`). It survives the
2026-07 slim: the retired agentic pipeline used to run the same read inline, but
`prepublish-read.ts` itself is unchanged and still serves the app.

---

## 6. Insights layer

### Voice Report — `GET /api/insights/report`
Rebuilds the latest Voice Report from already-stored state **without** re-running
the 5-credit tune-up — free and read-only, using the same assembler the tune-up
calls (`assembleVoiceReportFromStoredState`,
`src/app/api/insights/report/route.ts:46-47`). Returns 404 when no analysis has
run so the client shows a "run your first tune-up" CTA
(`insights/report/route.ts:38-44`). See voice-engine doc for the tune-up.

### Outcome attribution — `GET /api/insights/attribution`
`getOutcomeAttribution` (`src/lib/analysis/attribution.ts:36`) compares the
`weightedEngagement` of `afx_assisted` posts vs. baseline (own posts synced from
X that weren't written here), over `captured_posts` where `is_own_post=true`.
**Only posts with refreshed metrics count** (`hasMetrics`,
`attribution.ts:32,51`) — a just-published post is skipped until the flywheel
fills it. Requires `MIN_PER_GROUP = 3` per side before reporting `lift_pct`
(`attribution.ts:30,70-74`); the home card renders nothing until
`has_enough_data` so it never lies
(`src/components/home/OutcomeAttributionCard.tsx:34-37`).

### Voice health — `GET /api/insights/voice-health`
The one place the tuner-loop state is visible: `getContextFreshness` plus counts
for voice examples, enabled patterns, niche/positioning, and strategy
(`src/app/api/insights/voice-health/route.ts:29-67`). Backs the dashboard Voice
Health block and re-tune banner.

### Share — `POST/DELETE /api/insights/share`
Opt into a public, shareable Voice Report; mints a stable `share_token` on
`user_niche_profile` → `/share/{token}` ("demonstrate, don't claim").
Requires a tuned profile first; DELETE revokes
(`src/app/api/insights/share/route.ts:16-82`).

### Insights chat — `POST /api/insights-chat`
Retrieval-grounded Q&A over the user's *own* data only — no web
(`src/app/api/insights-chat/route.ts:23`). Pulls `user_analytics`, enabled
`extracted_patterns`, `inspiration_posts`, `user_niche_profile`,
`content_strategy` and assembles a compact markdown knowledge bundle
(`insights-chat/route.ts:55-204`). Pro-gated (`requireFeature("insightsChat")`,
`:40`), AI-gated, LLM-guarded (`guardLlmRoute`, `:36`). Answers via Claude
`standard` tier through the governed gateway, JSON `{answer, sources_used}`
(`insights-chat/route.ts:220-247`). Gracefully reports missing tables and
instructs the user to apply migrations (`:101-108`).

### Best times — `GET /api/analytics/best-times`
Groups non-reply `user_analytics.posts` by **day-of-week only** (hours are
unreliable from CSV, `src/app/api/analytics/best-times/route.ts:46`), averages
engagement per day, and returns a `bestDay` plus per-day confidence. Requires
`MINIMUM_POSTS = 5` (`best-times/route.ts:7,36`); confidence is `high`≥10 /
`medium`≥5 / `low` (`:9-13`).

### Boost opportunities — `GET /api/analytics/boost-opportunities`
Surfaces recent posts worth amplifying. Pulls candidates from **both**
`user_analytics` (CSV) and `captured_posts` in parallel, dedups by `post_url`
preferring richer CSV data (`src/app/api/analytics/boost-opportunities/route.ts:261-276`).
Scores each on min-max-normalized inputs:
`engagementRate 0.6 + impressions 0.25 + recency 0.15`
(`boost-opportunities/route.ts:7-11,287-291`), within a `days` window (default
7, max 30) above `minImpressions` (default 200), and attaches human-readable
`reasons` (`:84-104`). Backs `BoostOpportunitiesCard` / `BoostOpportunitiesPanel`.

### Consistency — `GET /api/activity/consistency`
Daily post/reply counts over the last 90 days from `user_analytics.posts` +
`extension_replies` (`src/app/api/activity/consistency/route.ts:46-88`).
Tolerates a missing `extension_replies` table (`:80`).

---

## 7. Dashboard surfaces (home cards)

| Card | Source endpoint | Notes |
|---|---|---|
| `OutcomeAttributionCard.tsx` | `/api/insights/attribution` | Hidden until `has_enough_data` (`:34`) |
| `BoostOpportunitiesCard.tsx` | `/api/analytics/boost-opportunities` | Amplify candidates |
| `ConsistencyTracker.tsx` | `/api/activity/consistency` (prefers `activityDays`; legacy CSV `posts` prop) | Weekly grid (`:9-17`) |
| `VoiceHealthCard.tsx` | `/api/insights/voice-health` | Freshness + counts |
| `TopPostsCard.tsx`, `PatternInsightsSection.tsx`, `InsightsHub.tsx` | mixed | Voice surfaces (the dashboard `StrategyProgress` widget and `GET /api/strategy/progress` were removed in 2026-07; strategy is edited in Settings → Strategy) |

Insights-page components live in `src/components/insights/*` (`PerformanceTab`,
`BestTimesSection`, `BoostOpportunitiesPanel`, `TopPostsSection`,
`PatternsSection`, `VoiceReport`, `AssistantTab` = insights chat).

---

## 8. Cron / background refresh

| Cron route | Drives | Gated? | Purpose |
|---|---|---|---|
| `GET /api/cron/analytics-sync` | `syncUserTimeline` per connection | yes (`xApiSync` per user, `:60`) | Pull live X metrics into `user_analytics` |
| `GET /api/cron/metrics-refresh` | `refreshOwnPostMetrics` per connection | **no** | Refresh own `captured_posts` — keeps the flywheel fresh for free users (`:9-15`) |
| `GET /api/cron/usage-rollup` | `computeDailyUsage`/`storeDailyUsage` | n/a | Roll up agent-surface COGS into `usage_daily`; alerts >$25/day or >$5/user (`:10-12,35-44`) |

All three require `Authorization: Bearer ${CRON_SECRET}` and refuse if the
secret is unset (e.g. `analytics-sync/route.ts:17-26`). The daily-ops cron
orchestrates analytics-sync + metrics-refresh on a daily cadence; the individual
routes remain for manual triggering.

---

## 9. Key files & tables

**Code**

| Path | Role |
|---|---|
| `src/lib/utils/engagement.ts` | `weightedEngagement` — the one currency |
| `src/lib/analysis/posts-pool.ts` | `getAnalyzablePosts` — the one pool |
| `src/lib/analysis/x-algorithm.ts` | weights, caveat, `REPLY_DRIVING`/`ENGAGEMENT_BAIT` |
| `src/lib/analysis/prepublish-read.ts` | `runPrepublishRead`, `computeAlgorithmFlags` |
| `src/lib/analysis/attribution.ts` | `getOutcomeAttribution` |
| `src/lib/analysis/timeline-sync.ts` | `syncUserTimeline` (X API merge) |
| `src/lib/analysis/csv-import.ts` | `parseXAnalyticsCsv`, `storeAnalyticsCsv` |
| `src/lib/analysis/own-posts-refresh.ts` | `refreshOwnPostMetrics` (flywheel) |
| `src/lib/utils/analytics-retention.ts` | `capPostsByRecency` (2000 cap) |

**Tables**

| Table | Holds |
|---|---|
| `user_analytics` | `posts` JSONB (`PostAnalytics[]`) + totals/date_range; one latest row per user — primary pool source |
| `captured_posts` | own posts (`is_own_post`, `afx_assisted`, `metrics` JSON) — supplement, attribution source |
| `extension_replies` | replies sent via extension — reply pool + consistency |
| `extracted_patterns` | content-shaping patterns + `multiplier` — pattern read |
| `prepublish_reads` | best-effort log of reads (validation loop; may be unmigrated) |
| `user_niche_profile` | niche/positioning + `share_token` |
| `content_strategy` | cadence/pillar targets |
| `usage_daily` | agent-surface COGS rollup |

---

## 10. Current state & gaps

- **Two stores for "my posts."** `user_analytics.posts` (JSONB) is the analytics
  blob; `captured_posts` is the row-per-post store used for attribution and as a
  pool supplement. The pool dedups across them by id, but field names differ
  (`views` vs `impressions`, `retweets` vs `reposts`) and are normalized in
  several places (`posts-pool.ts:125-132`, `attribution.ts:53-59`,
  `boost-opportunities/route.ts:215-233`).
- **Hour-of-day is unreliable** from CSV, so best-times is day-of-week only
  (`best-times/route.ts:46`).
- **Prepublish-read persistence is best-effort** and the green-flag → outcome
  validation loop is aspirational, not yet closed (`prepublish-read.ts:330-343`).
- **Attribution needs the flywheel.** `lift_pct` only appears once ≥3 refreshed
  posts exist per group; freshly published posts are invisible until
  `metrics-refresh` runs (`attribution.ts:30,51,70`).
- **The X-algorithm weights are a 2023 snapshot.** Ordering is durable; numbers
  are directional pending the Grok-ranker migration. Always surface
  `X_ALGORITHM_CAVEAT` (`x-algorithm.ts:166`).
- **Engagement weights were recently recalibrated** (commit `5d982bb1`); any
  future change re-ranks the pool and re-derives pattern multipliers — treat as
  a load-bearing constant.

---

## 11. Related docs

- **Voice engine** — niche analysis, pattern extraction, the tune-up that
  consumes this pool: `docs/architecture/voice-system.md`,
  `docs/guides/voice-tuneup.md`.
- **Writing assistant** — Tier-0 engine sharing `REPLY_DRIVING`/`ENGAGEMENT_BAIT`
  and the prepublish read inline (see `tier0.ts`, the Performance/Reach scores).
- **Publishing & scheduling** — where `afx_assisted` posts originate and how
  `captured_posts` is backfilled: `docs/architecture/publishing.md`.
- **Loop architecture** — the analytics flywheel end-to-end:
  `docs/architecture/loop.md`.
- **Analytics guide** (user-facing): `docs/guides/analytics.md`.
