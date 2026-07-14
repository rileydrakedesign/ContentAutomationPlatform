# Publishing & Scheduling — Source of Truth

> How a draft becomes a live tweet/thread on X — immediately or on a schedule (replies are handoff-only, never published) — plus the queue, media, char-counting, credit cost, and failure/retry machinery behind it. **Status (2026-06-26): shipped and in production.**
>
> This is the *engineering reference* (files, schema, jobs, CAS invariants). For the higher-level lifecycle narrative read [`docs/architecture/publishing.md`](../architecture/publishing.md) first — this doc does not re-tell that story, it grounds it in code.

---

## 1. Role (the publish/schedule end of the loop)

Publishing is the write end of the content loop: it takes resolved tweet text (+ optional media/poll/reply-audience) and posts it to X via the v2 API, then **backfills the posted tweet into `captured_posts`** so it immediately enters the analyzable pool and feeds voice/analytics ([`now/route.ts:124`](../../src/app/api/publish/now/route.ts), [`execute.ts:126`](../../src/lib/publish/execute.ts)).

There are **two parallel publish surfaces** with the same X mechanics but different policy:

| Surface | Routes | Auth | Credits / caps |
|---|---|---|---|
| **In-app** (web UI) | `src/app/api/publish/*` | Supabase session (`createAuthClient`) | **No credit debit, no daily cap** — the app user pays via subscription |
| **Agent API / MCP** (v1) | `src/app/api/v1/publish/*`, `src/app/api/v1/queue/*` | API key (`withApiAuth`) | **Debits credits + enforces daily publish cap** |

Both call the same low-level `postTweet`, `executeScheduledPost`, `enqueuePublish`, and `scheduled_posts` table. The split matters: the architecture-doc credit narrative ("3 each, 30 for a URL") describes the **v1/MCP** path; the in-app `/api/publish/now` charges nothing.

---

## 2. Publish now (post / thread) — flow + X API

In-app entrypoint `POST /api/publish/now` ([`now/route.ts`](../../src/app/api/publish/now/route.ts)); agent equivalent `POST /api/v1/publish/now` ([`v1/publish/now/route.ts`](../../src/app/api/v1/publish/now/route.ts)).

Body: `{ contentType: "X_POST"|"X_THREAD", payload, draftId? }`.

> **Replies are never published from here (2026-07).** `X_REPLY` was removed outright from the in-app route, and the v1 route still *recognizes* it only to return **`410 Gone`** (`code: "deprecated"`) — before the token lookup, the daily cap, and any credit debit ([`v1/publish/now/route.ts:30-48`](../../src/app/api/v1/publish/now/route.ts)). Replies go through the handoff (X web intent / extension / copy); see [reply-finder.md](reply-finder.md). Both schedule routes already rejected replies. Do not re-add a reply publish path.

**Shared mechanics (both surfaces):**
1. Resolve a valid X token via `getValidAccessToken(userId)` — refreshes the OAuth2 token race-safely, throws if the connection is stale ([`client.ts:157`](../../src/lib/x-api/client.ts)). v1 maps that throw to a clean `400 x_not_connected` ([`v1/publish/now/route.ts:45`](../../src/app/api/v1/publish/now/route.ts)).
2. Post to X with `postTweet(accessToken, text, options)` → `POST https://api.twitter.com/2/tweets`, Bearer-auth, returns `{ id_str }` ([`client.ts:426`](../../src/lib/x-api/client.ts)).
3. Backfill each posted tweet into `captured_posts` (`is_own_post: true`, `afx_assisted: true`, empty `metrics`), best-effort.
4. If `draftId` given, mark the draft `POSTED` (best-effort).

**`postTweet` body assembly** ([`client.ts:441`](../../src/lib/x-api/client.ts)):
- `inReplyToStatusId` → `reply.in_reply_to_tweet_id` (this is how threads *and* replies chain).
- `poll` (≥2 options) → `poll.{options,duration_minutes}`. **Poll and media are mutually exclusive — poll wins.**
- else `mediaIds` → `media.media_ids` (sliced to 4).
- `replySettings` → `reply_settings`, but **only** when not `"everyone"` (X rejects the default value if sent explicitly).

**Per-type behavior:**
- **X_POST** — single `postTweet`. A poll suppresses media ([`now/route.ts:99`](../../src/app/api/publish/now/route.ts)); `pollForPublish` normalizes the poll payload.
- **X_THREAD** — loop over `payload.tweets` (or `posts`), each `postTweet` replies to the previous `id_str`. **Mid-thread failure keeps the posted prefix** and returns it so the caller can resume — never blind-retry the whole thread ([`now/route.ts:173`](../../src/app/api/publish/now/route.ts)):
  - in-app: `500` with `{ postedIds, failedAtIndex, remainingTweets }`.
  - v1: `502 x_partial_thread` with the same shape; the **un-posted remainder's credits are refunded** ([`v1/publish/now/route.ts:189`](../../src/app/api/v1/publish/now/route.ts)).

---

## 3. Scheduling & the queue (schedule → cron publish-scheduled → QStash → X)

Entrypoints: in-app `POST /api/publish/schedule` ([`schedule/route.ts`](../../src/app/api/publish/schedule/route.ts)), agent `POST /api/v1/publish/schedule` ([`v1/publish/schedule/route.ts`](../../src/app/api/v1/publish/schedule/route.ts)). Both gate on the **Pro `scheduling` feature** (`requireFeature`) and reject a non-future `scheduledFor`.

**Schedule flow:**
1. (v1 only) Enforce daily publish cap, then **debit credits now** based on the resolved tweet texts; `credits_charged` is stored on the row for exact refund on cancel ([`v1/publish/schedule/route.ts:74`](../../src/app/api/v1/publish/schedule/route.ts)). In-app schedules store `credits_charged = 0`.
2. Insert a `scheduled_posts` row with `status: "scheduled"`, `content_type`, `payload`, `scheduled_for`.
3. **`enqueuePublish(...)`** → QStash `publishJSON` to `/api/qstash/publish` with `notBefore = scheduledFor`, `retries: 3`, and a `failureCallback` to `/api/qstash/failure?scheduledPostId=…&userId=…` ([`enqueue.ts`](../../src/lib/qstash/enqueue.ts)). On success store `qstash_message_id` (used for later cancel); on failure return `messageId: null` → row stays `scheduled`, response carries `deliveryConfirmed: false`, and the sweep is the safety net.
4. Mark the linked draft `SCHEDULED`.

**Delivery — three reliability layers (outermost first, per [`enqueue.ts:9`](../../src/lib/qstash/enqueue.ts)):**

```
schedule ─debit(v1)─▶ scheduled_posts(scheduled) ─enqueue─▶ QStash
                                                              │ at scheduled_for
   exact-time ────────────────────────────────────────────────┤
                                                              ▼
                                 POST /api/qstash/publish (Upstash-signature verified)
                                                              │
                                                  executeScheduledPost()
   safety net ── GET/POST /api/cron/publish-scheduled (runSweep) ┘
                                                              ▼
                                          posts to X, updates row status
```

- **`POST /api/qstash/publish`** — the per-post exact-time trigger. Verifies the Upstash signature, loads the row, **skips if status ≠ `scheduled`** (idempotent against cancel/double-fire), runs `executeScheduledPost`. Returns `200` even on app-level failure so QStash doesn't retry a logical error ([`qstash/publish/route.ts:63`](../../src/app/api/qstash/publish/route.ts)).
- **`/api/cron/publish-scheduled` `runSweep()`** — the safety net ([`cron/publish-scheduled/route.ts:15`](../../src/app/api/cron/publish-scheduled/route.ts)). It (a) marks rows stuck in `publishing` >10 min as `failed` (process died mid-publish — **never auto-republishes**, tweets may be partial), and (b) publishes any `scheduled` row past `scheduled_for` that QStash never delivered. Two triggers: `GET` (Vercel cron, `Authorization: Bearer ${CRON_SECRET}`, daily `0 5 * * *` in `vercel.json:5`) and `POST` (a QStash schedule, signature-verified, lets the sweep run sub-daily without Vercel Pro crons).
- **`executeScheduledPost`** ([`lib/publish/execute.ts`](../../src/lib/publish/execute.ts)) is the shared worker. Key invariants:
  - **Atomic claim**: `UPDATE … SET status='publishing' WHERE status='scheduled'` (CAS) — 0 rows ⇒ another actor owns it, bail. This is what makes QStash + cron + the per-post message safe to all fire ([`execute.ts:28`](../../src/lib/publish/execute.ts)).
  - **Resume from `posted_post_ids`**: a retried/partial thread starts at the first unposted tweet; each successful tweet is persisted to `posted_post_ids` *before* posting the next, and a failed persist **aborts** (so a retry can't double-post) ([`execute.ts:96`](../../src/lib/publish/execute.ts)).
  - On finish: CAS `status='posted'` (guarded on `publishing`); on error: CAS `status='failed'` with partial progress + `error`.

**Inspecting the queue:**
- In-app UI: `GET /api/publish/list` (array, ordered by `scheduled_for`) drives [`QueuePage.tsx`](../../src/components/queue/QueuePage.tsx) — list + calendar views, friendly error mapping, status-priority sort (`publishing→scheduled→failed→posted→cancelled`).
- Agent API: `GET /api/v1/queue` (paginated `{ items, total, limit, offset }`, optional `?status=`) ([`v1/queue/route.ts`](../../src/app/api/v1/queue/route.ts)).
- Statuses: `scheduled → publishing → posted`, or `failed` / `cancelled`.

---

## 4. Media upload

Server-side route `POST /api/x/media/upload` (multipart `{ file, alt_text? }`) — the X token never reaches the browser ([`x/media/upload/route.ts`](../../src/app/api/x/media/upload/route.ts)):

1. Per-user rate-limit (20/window) + size caps mirroring X: image ≤5 MB, GIF ≤15 MB, video ≤512 MB.
2. `uploadMediaV2` → X v2 **chunked** `INIT`/`APPEND`(4 MB segments)/`FINALIZE`, Bearer-auth; for video/large GIF it polls the async `STATUS` endpoint until `succeeded` ([`client.ts:519`](../../src/lib/x-api/client.ts)). v1.1 chunked upload isn't used (would need OAuth 1.0a we don't have).
3. Applies alt text via `setMediaAltText` (best-effort).
4. **Persists a durable copy** to the `draft-media` Supabase bucket and returns `{ media_id, category, type, alt_text, storage_path, preview_url }`.

**Scope caveat:** `media.write` is **not yet in the requested OAuth scope** ([`client.ts:69`](../../src/lib/x-api/client.ts) — pending X portal enablement). A 403 from X surfaces as `{ reconnect_required: true }` (403); text publishing is unaffected.

**Why the durable copy matters:** X `media_id`s expire (~24h unused). `resolveMediaIdsForPublish(..., { forceReupload })` ([`x-api/media.ts:50`](../../src/lib/x-api/media.ts)) decides per path:
- **Immediate publish** → `forceReupload: false`, reuse the just-uploaded `media_id` (only re-apply alt text).
- **Scheduled publish** → `forceReupload: true`, re-download from `draft-media` and re-upload to get a fresh id ([`execute.ts:79`](../../src/lib/publish/execute.ts)).

Media (and polls) attach to the **first tweet only** of a thread. `AttachedMedia` is parsed from draft/payload JSON via `parseAttachedMedia`.

---

## 5. Char counting & the link surcharge (tweet-text; credit cost difference)

Two *different* URL detectors live here — keep them distinct:

**Display counting** — `weightedTweetLength` ([`x-api/tweet-text.ts:48`](../../src/lib/x-api/tweet-text.ts)): mirrors twitter-text weighting — every URL counts as a fixed **23** (`URL_WEIGHTED_LENGTH`), CJK/fullwidth code points weight **2**, everything else **1**. Default limit `280` (premium accounts raise it; X enforces the real limit on publish). `tweetLengthInfo` returns `{ weighted, limit, remaining, isOverLimit, urlCount }` for the `CharCounter` UI. `findUrls`/`findLinks` share the same `URL_REGEX` so "what is a link" is one definition for the counter and the writing assistant's external-link penalty (`findLinks` additionally drops email-host bare domains).

**Billing detection** — `containsUrl` + `publishCreditCost` ([`billing/credits.ts:64`](../../src/lib/billing/credits.ts)): a *separate, allowlist-based* check (`LINKED_TLDS`) of whether X would bill the post at the URL rate. This drives the **link surcharge**:

| Action | Credits | Why |
|---|---|---|
| `publish.tweet` | **3** | X pay-per-use ≈ $0.015/post |
| `publish.tweet_with_url` | **30** (10×) | X charges ≈ $0.20 for a post containing a URL |

`publishCreditCost(texts)` sums per-tweet, so a thread is the sum and a single URL tweet in it costs 30. These costs are charged on the **v1/MCP** publish & schedule paths only (`requireCredits` → `debitCredits`), refunded on X rejection (`refund.publish_failed` / `refund.thread_partial`) or cancel (`refund.schedule_cancel`). See [billing-plans-and-credits](./billing-plans-and-credits.md).

---

## 6. Failure handling & retry

- **Immediate publish** — X rejection: v1 refunds and returns `502 x_api_error`; partial thread refunds the remainder and returns `502 x_partial_thread` with resume data (§2). In-app returns `500` with the same resume payload but no refund (no charge was made).
- **Scheduled, QStash retries exhausted (dead-letter)** — `POST /api/qstash/failure` ([`qstash/failure/route.ts`](../../src/app/api/qstash/failure/route.ts)). The post id rides in the **callback URL** (not QStash's body), so identification is robust. CAS `status='failed' WHERE status='scheduled'` — a late retry that already posted, or a user cancel, makes this a no-op. Logs to Sentry with the `dlqId`.
- **Stuck `publishing`** — recovered to `failed` by `runSweep` after 10 min (§3); never auto-republished.
- **Retry** — `POST /api/publish/retry` ([`publish/retry/route.ts`](../../src/app/api/publish/retry/route.ts)): only `failed` rows, CAS `failed→scheduled`, clears `error`, **leaves `posted_post_ids` intact** (thread resumes from first unposted), re-enqueues with `notBefore = now+5s`.
- **Cancel** — `POST /api/publish/cancel` ([`publish/cancel/route.ts`](../../src/app/api/publish/cancel/route.ts)): CAS over `scheduled`/`failed`, best-effort cancels the QStash message, reverts the draft to `DRAFT`; a row mid-`publishing` returns `409`. Agent `DELETE /api/v1/queue/:id` additionally **refunds `credits_charged`** exactly once via the CAS guard ([`v1/queue/[id]/route.ts:68`](../../src/app/api/v1/queue/[id]/route.ts)).
- **Delete** — `POST /api/publish/delete` ([`publish/delete/route.ts`](../../src/app/api/publish/delete/route.ts)): hard-removes the row (vs cancel which keeps it), refuses while `publishing` (`409`), cancels QStash, frees the draft.
- **QStash LLM jobs (removed 2026-07)** — the `POST /api/qstash/llm-job` worker that ran async agentic generation into `generation_jobs` is gone with the pipeline. `/api/qstash/publish` (+ `/api/qstash/failure`) is now the only QStash worker.

---

## 7. Key files, routes & tables

**Routes**

| Route | File | Purpose |
|---|---|---|
| `POST /api/publish/now` | [`publish/now/route.ts`](../../src/app/api/publish/now/route.ts) | In-app immediate publish (post/thread) |
| `POST /api/publish/schedule` | [`publish/schedule/route.ts`](../../src/app/api/publish/schedule/route.ts) | In-app schedule (Pro) |
| `GET /api/publish/list` | [`publish/list/route.ts`](../../src/app/api/publish/list/route.ts) | Queue list for the UI |
| `POST /api/publish/{cancel,delete,retry}` | [`cancel`](../../src/app/api/publish/cancel/route.ts) / [`delete`](../../src/app/api/publish/delete/route.ts) / [`retry`](../../src/app/api/publish/retry/route.ts) | Queue mutations |
| `POST /api/v1/publish/{now,schedule}` | [`v1/publish/now`](../../src/app/api/v1/publish/now/route.ts), [`schedule`](../../src/app/api/v1/publish/schedule/route.ts) | Agent/MCP publish (metered) |
| `GET /api/v1/queue`, `DELETE /api/v1/queue/:id` | [`v1/queue`](../../src/app/api/v1/queue/route.ts), [`[id]`](../../src/app/api/v1/queue/[id]/route.ts) | Agent queue list / cancel+refund |
| `POST /api/qstash/publish` | [`qstash/publish/route.ts`](../../src/app/api/qstash/publish/route.ts) | Exact-time per-post delivery |
| `POST /api/qstash/failure` | [`qstash/failure/route.ts`](../../src/app/api/qstash/failure/route.ts) | Dead-letter → mark failed |
| `GET\|POST /api/cron/publish-scheduled` | [`cron/publish-scheduled/route.ts`](../../src/app/api/cron/publish-scheduled/route.ts) | Safety-net sweep + stuck recovery |
| `POST /api/x/media/upload` | [`x/media/upload/route.ts`](../../src/app/api/x/media/upload/route.ts) | Server-side chunked media upload |

**Core libs:** [`lib/publish/execute.ts`](../../src/lib/publish/execute.ts) (shared scheduled worker) · [`lib/qstash/enqueue.ts`](../../src/lib/qstash/enqueue.ts) · [`lib/x-api/client.ts`](../../src/lib/x-api/client.ts) (`postTweet`, `getValidAccessToken`, `uploadMediaV2`) · [`lib/x-api/media.ts`](../../src/lib/x-api/media.ts) · [`lib/x-api/tweet-text.ts`](../../src/lib/x-api/tweet-text.ts) · [`lib/billing/credits.ts`](../../src/lib/billing/credits.ts).

**Tables** ([`supabase/migrations/20260206_publish_queue_and_byo_x.sql`](../../supabase/migrations/20260206_publish_queue_and_byo_x.sql))

| Table | Notable columns | Notes |
|---|---|---|
| `scheduled_posts` | `status` (`scheduled\|publishing\|posted\|failed\|cancelled`), `content_type` (`X_POST\|X_THREAD`), `payload jsonb`, `scheduled_for`, `posted_post_ids jsonb`, `error`, `credits_charged` (default 0), `qstash_message_id`, `job_id`, `draft_id` | `credits_charged` added [`20260610_scheduled_posts_credits_charged.sql`](../../supabase/migrations/20260610_scheduled_posts_credits_charged.sql); `job_id` is legacy BullMQ; `qstash_message_id` added via dashboard (not in migrations) |
| `drafts` | `status` (`DRAFT\|SCHEDULED\|POSTED`), `type`, `content jsonb` (incl. `media`) | [`drafts/route.ts`](../../src/app/api/drafts/route.ts); publish transitions are best-effort |
| `captured_posts` | `x_post_id`, `is_own_post`, `afx_assisted`, `metrics` | Backfilled on every publish — the loop into analytics/voice |
| `extension_replies` | `reply_text`, `replied_to_post_id` | Logged by the extension (`POST /api/extension/replies`) when the user sends a reply on X; feeds the reply voice |
| `credit_ledger` / `user_credits` | — | Debits, refunds, daily-cap counting (`checkDailyActionCap`) |

---

## 8. Current state & gaps

- ✅ Post / thread, polls, reply-audience, media (image/GIF/video + alt text), schedule + queue + retry/cancel/delete, exact-time QStash delivery with cron safety net, partial-thread resume, credit metering on the agent surface.
- ⚠️ **In-app publish is unmetered** — no credit debit or daily cap on `/api/publish/now` (subscription covers it). Only the v1/MCP surface meters. If the daily-cap/credit backstop should apply to web publishes too, that's a deliberate gap.
- ⚠️ **`media.write` scope not yet granted** ([`client.ts:69`](../../src/lib/x-api/client.ts)) — media upload returns `reconnect_required` 403 until the X portal scope is enabled and the scope string re-includes it.
- ⚠️ Media/poll attach to the **first tweet of a thread only**; no per-tweet thread media.
- ⚠️ Two URL definitions (`tweet-text` weighting vs `credits` `LINKED_TLDS` allowlist) can disagree at the edges — display count and billing use different matchers by design; a TLD miss undercharges, a false positive overcharges.
- ◻️ `qstash_message_id` column lives only in the live DB, not in a checked-in migration.
- ◻️ Thread reorder (drag) and per-tweet thread media not yet built (see the composer audit in [`architecture/publishing.md`](../architecture/publishing.md)).

---

## 9. Related docs

- [`docs/architecture/publishing.md`](../architecture/publishing.md) — lifecycle narrative + native-composer option audit (read first).
- [`docs/features/billing-plans-and-credits.md`](./billing-plans-and-credits.md) — credit buckets, debit/refund RPCs, plan gates, daily caps.
- [`docs/features/x-integration.md`](./x-integration.md) — OAuth2 PKCE connect, token refresh, X v2 API surface.
- [`docs/reference/data-models.md`](../reference/data-models.md) — `ScheduledPost` and related models.
