# Publishing lifecycle

How content goes from a draft to a live post on X, immediately or on a schedule.

## Draft → publish (immediate)

`POST /publish/now` (MCP `publish_post` / `publish_thread`):

1. Validate `contentType` (`X_POST` | `X_THREAD`) and `payload`. **`X_REPLY` is deprecated:**
   the v1 route returns `410 Gone` (`code: "deprecated"`) before any credit debit, and
   the in-app route rejects it outright. Replies are handoff-only — see
   [../guides/reply.md](../guides/reply.md).
2. Resolve a valid X access token (refreshing if needed); a stale connection
   returns `400 x_not_connected`.
3. Enforce the daily publish cap (abuse backstop on top of credits).
4. **Debit credits** for the tweet(s) — 3 each, 30 for any tweet containing a URL.
5. Post to X. For a thread, each tweet replies to the previous one.
6. Backfill the posted tweet(s) into `captured_posts` (so they feed analytics and
   future voice examples) and, if `draftId` was given, mark the draft `POSTED`.
7. Return `{ posted, postedIds }` with credit headers.

**Failure handling:** if X rejects a single post, the charge is **refunded** and
you get `502 x_api_error` with X's message. For a thread that fails mid-way, the
posted prefix stands, only the **un-posted** remainder is refunded, and the
response is `502 x_partial_thread` with `postedIds`, `failedAtIndex`, and
`remainingTweets` — resume with those, never retry the whole thread.

## Draft → schedule → publish (deferred)

`POST /publish/schedule` (MCP `schedule_post`, **Pro**):

1. Gate on the Pro feature and validate a **future** `scheduledFor`.
2. Resolve the tweet texts (`payload.tweets`/`thread` for threads) — they drive
   the URL-surcharge price.
3. Enforce the daily publish cap; **debit credits now** (refunded on cancel).
4. Insert a `scheduled_posts` row (`status: scheduled`, `credits_charged`).
5. **Enqueue delivery via QStash** for the scheduled time. If QStash confirms,
   the message id is stored and `deliveryConfirmed: true`; if not, the row stays
   `scheduled` and the sweep (below) will deliver it (`deliveryConfirmed: false`).
6. Mark the draft `SCHEDULED` if `draftId` was given.

```
schedule ──debit──▶ scheduled_posts(row) ──enqueue──▶ QStash
                                                        │ at scheduledFor
                                                        ▼
                                   POST /api/qstash/publish  (signed)
                                                        │
                                              executeScheduledPost()
                                                        ▼
                                            posts to X, updates status
```

### Delivery

At the scheduled time QStash calls **`POST /api/qstash/publish`**, which verifies
the Upstash signature and runs `executeScheduledPost` (in
[`src/lib/publish/execute.ts`](../../src/lib/publish/execute.ts)) to post to X and
update the row's `status` and `posted_post_ids`. A scheduled-publish **sweep**
(cron) is the safety net for any row whose QStash delivery wasn't confirmed, so a
missed enqueue never silently drops a post.

### Cancel

`DELETE /queue/{id}` (MCP `cancel_scheduled`) cancels a row still in `scheduled`
state and **refunds** the credits debited at schedule time. Cancelling a row
that's no longer cancellable returns `409`.

## Inspecting the queue

- `GET /queue` (MCP `list_queue`) — paginated scheduled posts; each item includes
  its source `draft_id`. Returns `{ items, total, limit, offset }`.
- `GET /publish` (MCP `list_published`) — scheduled/published history as an array,
  filterable by status.

Statuses: `scheduled` → `publishing` → `posted`, or `failed` / `cancelled`.

See the [`ScheduledPost` model](../reference/data-models.md#scheduledpost) and
[../guides/strategy.md](../guides/strategy.md) for cadence planning.

## Media, link previews, and X-accurate counting (editor parity)

The draft editor (`/drafts/[id]`) matches X's native composer:

- **X-accurate character count.** `weightedTweetLength`
  ([`src/lib/x-api/tweet-text.ts`](../../src/lib/x-api/tweet-text.ts)) counts how
  X counts: any URL is 23 characters regardless of real length, CJK characters
  weight 2, the rest weight 1. The `CharCounter` component shows weighted count vs.
  the 280 limit (the API enforces the account's real, possibly-premium limit on
  publish).
- **Media uploader.** `POST /api/x/media/upload` (multipart) uploads an
  image/GIF/video server-side via the **v2 chunked media endpoints**
  (`uploadMediaV2`, Bearer-auth — v1.1 would need OAuth 1.0a we don't have),
  returns a `media_id`, applies **alt text**, and persists a durable copy in the
  `draft-media` bucket. Attached media is stored on the draft content
  (`content.media: AttachedMedia[]`) so it survives **save** and **scheduling**.
  Requires the connected account to have granted the **`media.write`** scope —
  connections predating it must reconnect (the route returns a clear
  `reconnect_required` 403).
- **Media survives scheduling.** X `media_id`s expire (~24h for unused media), so
  for a scheduled post `executeScheduledPost` **re-uploads from the durable
  `draft-media` copy** at publish time to obtain a fresh `media_id`
  (`resolveMediaIdsForPublish({ forceReupload: true })`). Immediate publishes use
  the just-uploaded id directly.
- **Link preview.** `GET /api/og?url=` fetches Open Graph / Twitter Card metadata
  server-side (SSRF-guarded) so the composer renders the first URL's card without
  relying on X to expand it. (The URL still counts as 23 in the counter.)
- **Reply audience.** The editor exposes X's "who can reply" setting
  (`everyone` / `following` / `mentionedUsers`), threaded through `postTweet`'s
  `replySettings` on both immediate and scheduled publish.

### Native-composer option audit

| X composer option | Status |
|---|---|
| Weighted character count (URL=23, CJK=2) | ✅ implemented |
| Image upload (≤4) + alt text | ✅ implemented |
| GIF / video upload + alt text | ✅ implemented (v2 chunked + async STATUS poll) |
| Link card preview | ✅ implemented (`/api/og`) |
| Reply-audience setting | ✅ implemented |
| Thread add / remove tweets | ✅ implemented (editor) |
| Draft autosave of unsaved edits | ✅ implemented (sessionStorage buffer, restore-on-return) |
| Per-tweet media on a thread | ⚠️ media attaches to the first tweet only |
| Thread reorder (drag) | ◻️ not yet |
| Polls | ◻️ not yet (X API supports `poll`; future increment) |
| Emoji picker | N/A — native OS/browser emoji input is used |

## Closing the loop: publish → analytics → re-tune

Every publish path (in-app `POST /api/publish/now`, API/MCP
`POST /api/v1/publish/now`, and the scheduled `executeScheduledPost`) backfills
the posted tweet into `captured_posts` so it enters the
[canonical analyzable pool](../../src/lib/analysis/posts-pool.ts) right away —
initially with empty metrics. The daily **loop-upkeep** step of the `daily-ops`
cron then refreshes those metrics from X (ungated, newest first), so a
just-published post has real engagement — and can rank as a voice example or be
mined as a pattern — within ~1 day, with no manual CSV upload. See
[../guides/analytics.md](../guides/analytics.md#the-flywheel-published-posts-feed-your-voice-automatically).
