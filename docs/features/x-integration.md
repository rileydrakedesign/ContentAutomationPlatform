# X (Twitter) Integration — Source of Truth

> The layer that talks to X: account connection (OAuth 2.0 PKCE), the in-house v2 API client, tweet/analytics sync, media upload, and X-accurate tweet-text utilities. **Status (2026-06-26):** in production. OAuth 2.0 PKCE connect/refresh live; in-house client owns all X calls (no third-party SDK); media upload gated on the `media.write` portal scope (graceful reconnect fallback until enabled).

---

## 1. Role & risk posture

X is the **existential dependency**. The product is "Built for X. Nothing else." — there is no second platform to fall back to, and X ships roughly one hostile pricing/policy change per year (X Basic is now $200/mo; per-use pricing bills ~$0.20 for a post containing a URL vs ~$0.015 for a plain one, Feb 2026).

Two structural responses live in this layer:

- **In-house client (`src/lib/x-api/client.ts`).** Every X call goes through one ~680-line file we own — OAuth, token refresh, timeline, search, post, media, analytics mapping. No vendor SDK sits between us and X, so a breaking API change is a localized edit, not a dependency migration. `src/lib/x-api/index.ts:1` re-exports it as the single import surface (`@/lib/x-api`).
- **Bill-aware fetching.** X bills per post returned. Timeline sync supports delta fetch (`since_id`, `client.ts:324`) and excludes retweets (`client.ts:316`); every billed route is throttled per-user (`checkRateLimit`). Link-bearing posts carry a credit surcharge mirroring X's link economics (§6).

**Account safety.** Tokens are write-protected at the DB layer (token columns on `x_connections` are not SELECTable by the authenticated role — service-role only; see `client.ts:152`). Refresh is race-safe (§2). Reply eligibility is computed conservatively — nothing is surfaced as repliable unless *provably* open (`search-mapping.ts:24`) — to avoid posting into restricted conversations.

---

## 2. Account connection & OAuth

Two distinct OAuth flows exist; don't conflate them:

| Flow | Route | Purpose |
| --- | --- | --- |
| **App login** | `src/app/api/auth/callback/route.ts` | Supabase auth (email / social). Exchanges Supabase `code` → session cookie; guards against open redirect (`route.ts:10`). Not X. |
| **X connect** | `src/app/api/x/{connect,callback}/route.ts` | OAuth 2.0 PKCE to link the user's X account. |

### X connect flow (PKCE)

1. **`GET /api/x/connect`** (`connect/route.ts`) — authenticated. Generates a PKCE pair (`generatePKCE`, `client.ts:47`) + random `state`, upserts them into `x_oauth_requests` keyed by `user_id` (`connect/route.ts:24`), and returns the X authorize URL (`getOAuth2AuthorizationUrl`, `client.ts:56`).
   - **Scopes:** `tweet.read tweet.write users.read offline.access` (`client.ts:69`). `offline.access` is what yields a refresh token. `media.write` is **deliberately omitted** — it must first be enabled in the X developer portal, and requesting it before that breaks the whole authorize call. Until enabled, media upload returns a graceful reconnect 403 (§5); text publishing is unaffected.
2. **`GET /api/x/callback`** (`callback/route.ts`) — X redirects here with `code` + `state`. Looks up the stored verifier by `user_id`+`state` (`callback/route.ts:38`), exchanges the code (`exchangeCodeForTokens`, `client.ts:77`), then fetches the X user identity via `verifyCredentials` (`client.ts:284`) since the OAuth2 token response omits it.
   - Upserts `x_connections` (`callback/route.ts:66`): `x_user_id`, `x_username`, `access_token`, `refresh_token`, `access_token_expires_at` (computed `now + expires_in`). Deletes the `x_oauth_requests` row.
   - **First-connection detection** (`callback/route.ts:58`): if no prior connection existed, redirect to `/?connected=1` (dashboard kicks off **bootstrap** — see below); reconnects go to `/?success=connected` and skip bootstrap.
3. **`POST /api/x/bootstrap`** (`bootstrap/route.ts`) — first-session value. Pulls the timeline (ungated; it's the user's own posts) and runs a full Voice Tune-Up so the first session shows real niche / patterns / top posts with no CSV upload. Throttled 2/window (`bootstrap/route.ts:40`), `maxDuration = 300`, best-effort (a sync failure still tunes whatever's captured). Pattern extraction is Pro-gated and skipped gracefully for free.
4. **`GET /api/x/status`** (`status/route.ts`) — returns `{ connected, username, userId, lastSyncAt, lastApiSyncAt, connectedAt }`. **`DELETE /api/x/status`** disconnects (deletes the `x_connections` row).

### Token storage & refresh

- Stored in `x_connections`: `access_token`, `refresh_token`, `access_token_expires_at`. Token columns are locked down by RLS — only the service role can read them (`client.ts:152`).
- **`getValidAccessToken(userId)`** (`client.ts:157`) is the single accessor. It uses the service role internally; row scope is enforced by the `userId` the caller already resolved from its own auth. Logic:
  - Returns the current token if it's still valid with a **5-minute buffer** (`client.ts:177`).
  - Otherwise refreshes via `refreshAccessToken` (`client.ts:110`, confidential client — fails loudly if `X_CLIENT_ID`/`X_CLIENT_SECRET` are missing).
  - **Race-safe rotation:** the update is conditional on `WHERE refresh_token = <old>` (`client.ts:233`). If another process already rotated the token, the update no-ops and we re-read the fresh row. An `invalid_grant`/`invalid_request` on refresh (token already consumed by a concurrent request) triggers a re-read and reuse of the newer token (`client.ts:199`).

---

## 3. The in-house X API client (`src/lib/x-api/`)

| File | Responsibility |
| --- | --- |
| `client.ts` | OAuth, token refresh, all v2 endpoints, media upload, analytics mapping. |
| `index.ts` | `export * from "./client"` — the import surface. |
| `media.ts` | `AttachedMedia` model + `resolveMediaIdsForPublish` (durable re-upload for scheduled posts). |
| `tweet-text.ts` | X-accurate char counting + URL/link detection (§6). |
| `search-mapping.ts` | Maps v2 search results → reply-eligibility + traction score. |
| `reply-targets.ts`, `poll.ts` | Reply-candidate selection; poll validation. (`*.test.ts` alongside each.) |

**Auth pattern.** All reads use a thin `makeBearerRequest` helper (`client.ts:264`) that attaches `Authorization: Bearer <token>`. Writes (post/media/metadata) build their own `fetch` with the bearer header and the appropriate content type.

**Read endpoints:**
- `verifyCredentials` (`client.ts:284`) — `GET /2/users/me`.
- `getUserTimeline` (`client.ts:305`) — `GET /2/users/:id/tweets`; requests `created_at,public_metrics,organic_metrics,referenced_tweets`, `exclude=retweets`, up to 100/page, supports `pagination_token` and **`since_id` delta sync** (bill-aware).
- `getTweet` / `getTweetsBatch` (`client.ts:344`, `:366`) — single / up to 100 by id.
- `searchRecentTweets` (`client.ts:393`) — `GET /2/tweets/search/recent` with `reply_settings`, `entities`, and `author_id` expansion so reply eligibility is derivable without extra calls.

**Write — `postTweet`** (`client.ts:426`): `POST /2/tweets`. Handles reply (`in_reply_to_tweet_id`), media (`media_ids`, max 4), polls (`poll`, 2–4 options), and `reply_settings`. Polls and media are mutually exclusive — poll wins as a backstop (`client.ts:447`). `everyone` reply audience is omitted to use X's default and avoid rejections.

**Rate handling — honest state.** There is **no automatic 429 backoff/retry inside the client**; a non-2xx throws an `Error` carrying the status + X's body text (e.g. `client.ts:472`). Rate pressure is managed *upstream*: per-user `checkRateLimit` on every billed route (sync 5, search 10, media 20, bootstrap 2), delta sync to minimize billed posts, and sequential per-user processing in cron. Reply-forbidden 403s are normalized to a clean outcome via `isReplyForbiddenError` (`search-mapping.ts:72`).

**Analytics mapping — `mapV2ToPostAnalytics`** (`client.ts:630`): folds v2 `public_metrics`/`organic_metrics` into the internal `PostAnalytics` shape, preferring organic impressions, computing `engagement_score` via `weightedEngagement`, flagging replies, tagging `data_source: "api"`.

---

## 4. Sync

Three ingestion paths land X data into two tables. Know which writes where:

| Path | Route / lib | Target table | Gating |
| --- | --- | --- | --- |
| **Timeline → captured posts** | `POST /api/x/sync` (`sync/route.ts`) | `captured_posts` | Pro (`xApiSync`) + throttle 5 |
| **Timeline → analyzable pool** | `syncUserTimeline` (`lib/analysis/timeline-sync.ts`) | `user_analytics.posts` | call-site gated (`xApiSync`) |
| **Browser-scraped analytics** | `POST /api/x/analytics-sync` | `captured_posts` | ungated fallback (no API cost) |
| **Search** | `POST /api/x/search` | none (returns tweets) | throttle 10 |

- **`/api/x/sync`** (`sync/route.ts`): fetches 100 tweets via `getUserTimeline`, dedupes against existing `x_post_id`s, inserts new rows into `captured_posts` (`is_own_post: true`, `triaged_as: "my_post"`, metrics JSON), stamps `last_sync_at`.
- **`syncUserTimeline`** (`timeline-sync.ts`): the **canonical** pool writer. Paginates (default 2 pages ≈ 200 tweets), maps via `mapV2ToPostAnalytics`, **merges** live metrics into the latest `user_analytics.posts` row (refreshes existing posts, not just appends), applies recency capping, stamps `last_api_sync_at` (`timeline-sync.ts:137`). Shared by in-app sync, the v1 API, cold-start bootstrap, and daily cron.
- **`/api/x/analytics-sync`** (`analytics-sync/route.ts`): accepts browser-scraped `{ posts, replies }` (CORS-enabled for the extension), dedupes, inserts into `captured_posts`, and **merges** impression updates into existing rows' metrics JSON (`analytics-sync/route.ts:152`). The free, no-API-cost path to backfill impressions.
- **`/api/x/search`** (`search/route.ts`): `searchRecentTweets` for inspiration; returns a lightweight `{ id, text, created_at, public_metrics }[]`. (Reply-target enrichment lives in `search-mapping.ts`, consumed by the v1 search routes.)

---

## 5. Media upload

**`POST /api/x/media/upload`** (`media/upload/route.ts`) — multipart `{ file, alt_text? }` → `{ media_id, category, type, alt_text, storage_path, preview_url }`. The X token never leaves the server; the browser only ever sees a `media_id`.

- **Limits** mirror X (`media/upload/route.ts:20`): images ≤ 5 MB, GIF ≤ 15 MB, video ≤ 512 MB. MIME → kind/category via `kindForMime` / `mediaCategoryForMime` (`client.ts:492`). `maxDuration = 120`; throttle 20/window.
- **Chunked upload — `uploadMediaV2`** (`client.ts:519`): `INIT → APPEND` (4 MB segments) `→ FINALIZE`, then polls `STATUS` for async-processing media (video / large GIF) with a bounded retry loop (`waitForMediaProcessing`, `client.ts:578`). Alt text via `setMediaAltText` (`client.ts:606`, best-effort).
- **Missing `media.write` scope** surfaces as a 403 from X → route returns `{ reconnect_required: true }` with a "reconnect your X account" message (`media/upload/route.ts:88`) rather than a raw error.
- **Durable persistence** (`media/upload/route.ts:113`): X `media_id`s expire (~24h unused), so the raw file is also stored in the `draft-media` bucket (`storage_path` + public `preview_url`), path-prefixed by `user.id` for RLS. `resolveMediaIdsForPublish` (`media.ts:50`) re-uploads from storage at publish time for **scheduled** posts (`forceReupload`) and re-applies alt text; immediate posts reuse the fresh `media_id`. Caps at 4 media.

---

## 6. tweet-text utilities (`src/lib/x-api/tweet-text.ts`)

X does not count `String.length`. This module is a small, dependency-free, faithful approximation of twitter-text's weighting and is the **one definition** of "how long is this tweet" and "what is a link" across the app.

- **`weightedTweetLength(text)`** (`tweet-text.ts:48`): URLs always count as **23** (`URL_WEIGHTED_LENGTH` — t.co wraps every link), CJK/Hangul/Kana ranges weight 2, everything else weight 1. Default limit **280** (`DEFAULT_TWEET_LIMIT`); premium accounts override on publish. `tweetLengthInfo` (`tweet-text.ts:81`) wraps it with `{ weighted, limit, remaining, isOverLimit, urlCount }`.
- **`findUrls(text)`** (`tweet-text.ts:120`): every URL with `{ raw, start, end }` offsets, sharing `URL_REGEX` (`tweet-text.ts:25`) with the counter. `findLinks` (`tweet-text.ts:142`) is the assistant-penalty variant — same detection minus email hosts (a bare domain right after `@`). `firstUrl` (`tweet-text.ts:97`) returns the first link normalized to `https://` for preview cards.

**What depends on these:**
- **Character counter** in the composer / writing assistant — `weightedTweetLength` / `tweetLengthInfo`.
- **Assistant link detection** — `findLinks` underlines links and drives the external-link penalty.

**Link billing surcharge (separate detector — note the seam).** Publishing a URL-bearing post costs **30 credits** vs **3** for a plain post (`CREDIT_COSTS["publish.tweet_with_url"]` vs `["publish.tweet"]`, `lib/billing/credits.ts:11`) — a 10× surcharge mirroring X's ~$0.20-vs-$0.015 link economics. `publishCreditCost` (`credits.ts:81`) sums per-tweet (thread = sum). **Importantly, billing uses its own `containsUrl` + `LINKED_TLDS` allowlist** (`credits.ts:64`, `:46`), *not* `tweet-text.findUrls`. The two URL definitions are deliberately separate (billing is conservative about bare-domain TLDs to avoid over/undercharging), but this is a known duplication — see §9. See `docs/api/credits.md` for the full credit model.

---

## 7. Cron / background sync

- **`/api/cron/daily-ops`** (`30 0 * * *`, `vercel.json:4`) is the live driver. Its `runLoopUpkeep` (`daily-ops/route.ts:100`) sweeps connected users ordered by stalest `last_api_sync_at` (`:111`) and, per user: (1) refreshes own-post metrics — **ungated**, the seam that closes the analytics loop; (2) runs `syncUserTimeline` if the plan has `xApiSync` (`:139`); (3) refreshes voice examples for opted-in users. Per-user failures are logged and swallowed so one bad token never stalls the sweep. `maxDuration = 300`.
- **`/api/cron/analytics-sync`** (`cron/analytics-sync/route.ts`) is a standalone, `CRON_SECRET`-guarded route for **manual / on-demand** timeline syncs across all paid users (sequential, plan-gated on `xApiSync`). The daily cadence is owned by daily-ops; this stays for ad-hoc triggering.
- The other scheduled cron is `/api/cron/publish-scheduled` (`0 5 * * *`) — covered in the publishing doc.

---

## 8. Key files, routes & tables

**Routes**

| Route | Method | Purpose |
| --- | --- | --- |
| `/api/x/connect` | GET | Start PKCE; return authorize URL |
| `/api/x/callback` | GET | Exchange code; save `x_connections` |
| `/api/x/bootstrap` | POST | First-session timeline pull + tune-up |
| `/api/x/status` | GET/DELETE | Connection status / disconnect |
| `/api/x/sync` | POST | Timeline → `captured_posts` (Pro) |
| `/api/x/analytics-sync` | POST | Browser-scraped → `captured_posts` |
| `/api/x/search` | POST | Recent-tweet search |
| `/api/x/media/upload` | POST | Chunked media upload → `media_id` |
| `/api/auth/callback` | GET | Supabase app-login (not X) |
| `/api/cron/daily-ops` | GET | Daily loop upkeep (drives sync) |
| `/api/cron/analytics-sync` | GET | On-demand all-user sync |

**Library**

| File | Role |
| --- | --- |
| `src/lib/x-api/client.ts` | In-house v2 client: OAuth, refresh, endpoints, media, mapping |
| `src/lib/x-api/media.ts` | Attached-media model + scheduled re-upload |
| `src/lib/x-api/tweet-text.ts` | Weighted length + URL/link detection |
| `src/lib/x-api/search-mapping.ts` | Reply eligibility + traction scoring |
| `src/lib/analysis/timeline-sync.ts` | Canonical `user_analytics.posts` writer |
| `src/lib/billing/credits.ts` | Link surcharge (`containsUrl`, cost map) |

**Tables**

| Table | Holds |
| --- | --- |
| `x_oauth_requests` | In-flight PKCE verifier + state (deleted on callback) |
| `x_connections` | Per-user tokens, `x_user_id/username`, `last_sync_at`, `last_api_sync_at` (service-role-only token columns) |
| `captured_posts` | Own + captured posts (sync / analytics-sync / extension) |
| `user_analytics.posts` | Canonical analyzable pool (timeline-sync merges here) |
| Storage `draft-media` | Durable media for re-upload at publish |

---

## 9. Current state & gaps

- **No in-client retry/backoff.** A 429 or transient 5xx from X throws; there is no exponential backoff inside `client.ts`. Mitigated by route-level throttles and cron's swallow-and-continue, but a burst against X's rate limits will surface as user-facing errors. Candidate for a wrapped `fetch` with bounded retry.
- **Two URL detectors.** `tweet-text.findUrls` (counter/assistant) and `credits.containsUrl` (billing) are independent definitions of "what's a link." They can disagree at the margins (exotic TLDs, email hosts). Intentional today (billing is conservative), but a divergence risk worth a shared core eventually.
- **`media.write` not yet requested.** Until the X developer-portal scope is enabled and added to the connect scope string (`client.ts:69`), media upload depends on a reconnect after the scope ships; existing connections predating it get a 403 reconnect prompt.
- **Two timeline-sync targets.** `/api/x/sync` writes `captured_posts` while `syncUserTimeline` writes `user_analytics.posts`. They serve different consumers (inbox vs analyzable pool) but the overlap is a source of confusion — confirm the intended writer before adding a third caller.
- **OAuth state keyed by `user_id` (upsert)** in `x_oauth_requests` — a second concurrent connect attempt overwrites the first's verifier. Fine for the single-tab connect flow; note if multi-tab connect ever matters.

---

## 10. Related docs

- `docs/architecture/publishing.md` — publish path, scheduling, `publish-scheduled` cron, media re-upload at publish.
- `docs/architecture/voice-system.md` / analysis docs — how synced posts feed the voice/analytics flywheel.
- `docs/api/credits.md` — full credit model and the link surcharge.
- `docs/features/writing-assistant.md` — the char counter and link-penalty consumers of `tweet-text.ts`.
