# Guide: Analytics

Analytics power everything downstream — voice examples, patterns, best-times, and
the cadence comparison in the [Voice Tune-Up](voice-tuneup.md). Data comes from
two sources: **CSV uploads** (X Analytics export) and **captured posts** (synced
from X or backfilled when you publish through the app).

## Reading analytics

`GET /analytics` (MCP `get_analytics`, **1 credit**), controlled by `include`:

- `summary` (default) — counts only (`csv_analytics` totals, `captured_posts_count`).
- `posts` — also includes recent `captured_posts`.
- `all` — also includes the uploaded `csv_posts` rows.

## Best posting days

`GET /analytics/best-times` (MCP `get_best_times`, **1 credit**) returns a
day-of-week engagement breakdown: `{ days, bestDay, totalPostsAnalyzed,
hasEnoughData }`, computed from your analytics. Use it to time posts and to set a
realistic [strategy](strategy.md).

## Syncing your timeline

`POST /analytics/sync` (MCP `sync_analytics`, **15 credits**, **Pro**) does an
on-demand **delta** sync (`since_id` — only new posts) of your own X timeline into
captured posts. Returns `{ synced, fetched, since_id }`. Run it when captured
posts look stale, then consider a `run_tuneup` so the fresh posts feed your voice
context.

## The flywheel: published posts feed your voice automatically

You don't have to upload a CSV or run a manual sync to keep your voice current.
Every post published through **any** surface (dashboard, API, or MCP) is
backfilled into `captured_posts` immediately — at first with empty metrics — and
a **daily loop-upkeep job** (the `daily-ops` cron) then:

1. **Refreshes your own posts' engagement metrics** from X (newest first). This
   is *not* Pro-gated — it runs for every connected account, because it's what
   keeps the loop fresh for everyone.
2. **Syncs your timeline** into `user_analytics.posts` (Pro — the primary pool
   source).
3. **Re-ranks your voice examples** (for accounts with auto-refresh on).

Net effect: a post you publish today has real engagement in the
[canonical pool](../../src/lib/analysis/posts-pool.ts) within **~1 day**, so it
can rank as a voice example or be mined as a pattern — with no manual CSV upload.
The manual `POST /analytics/sync` and one-tap **Voice Tune-Up** stay available as
accelerants when you want the freshest signal *now* rather than at the next daily
pass. Freshness is reported as `context_freshness` (`retune_recommended`) on
`whoami`, `get_writing_context`, `/me`, and the dashboard, so you always know when
analytics have moved ahead of your tuned context.

## Reading a single tweet

`GET /tweets/{id}` (MCP `get_tweet`, **1 credit**) fetches one tweet's text and
metrics by raw ID or x.com URL — the usual way to pull reply context before
drafting a reply.

## Outcome attribution — is it working?

`GET /analytics` (and the dashboard) include an **`attribution`** block comparing
your **AFX-assisted posts** (anything published through the app, API, or MCP —
flagged `afx_assisted`) against your **baseline** posts (your own posts synced
from X that weren't written here):

```json
"attribution": {
  "assisted": { "count": 12, "avg_engagement": 1840 },
  "baseline": { "count": 96, "avg_engagement": 1190 },
  "lift_pct": 54,
  "has_enough_data": true
}
```

It only renders a verdict once both groups have enough refreshed posts
(`has_enough_data`), so it never over-claims. This is the ROI proof — "the posts
I wrote with Agents For X outperformed my baseline" — that nothing else in the
category shows.

## Weighted engagement

Across the product, "engagement" is a single weighted score, not raw likes, so
all surfaces rank posts the same way. The canonical function
([`src/lib/utils/engagement.ts`](../../src/lib/utils/engagement.ts)) weights:
**replies 5× · retweets/reposts 4× · likes/bookmarks 3× · impressions 0.001×**.
It normalizes the two metric naming conventions (captured-post `views`/`retweets`
vs. CSV `impressions`/`reposts`), so it works on both data sources.

This weighted score is what selects your **voice examples**, ranks **patterns** by
multiplier, and orders **top posts** in the Voice Report.
