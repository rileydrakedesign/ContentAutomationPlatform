# Pre-Ship Backlog — Agents For X

Authoritative list of every issue blocking production launch, derived from a feature-by-feature audit of `src/`, `chrome-extension/`, `landing/`, `scripts/`, and `vercel.json`. Each item is independently actionable and tagged by severity.

**Severity legend**
- **P0** — ship-blocker. Will cause data loss, money loss, security incident, or user-visible failure on day one.
- **P1** — must-fix. Will cause support tickets / embarrassment but app is technically usable.
- **P2** — polish. Acceptable to ship; fix post-launch.

**Status legend** — `[ ]` = open, `[x]` = done, `[~]` = in progress, `[-]` = won't do (cut from scope).

**Build state at audit time** — `next build` exits 0 (lint disabled in build config). `tsc --noEmit` reports 13 errors (all in `landing/src/app/blog/*`, see #L-DEAD-1). `eslint .` reports 989 errors + 8,003 warnings.

---

## Progress log

| Date | Commit | Closed |
|---|---|---|
| 2026-04-29 | `114416ea` | SEC-1 → SEC-7 (all P0 security) |
| 2026-04-30 | `18a6a338` | MONEY-1, 2, 3, 4, 5, 6, 9, 15 (idempotency, missing handlers, env hardening, customer dedupe, gate ordering, cache-control) |
| 2026-04-30 | `50071267` | MONEY-7, 8, 10, 11, 12, 13 (drop Business / bump Pro to $29, support DM, legal links, grace cancel, cancel-at-period-end UI, Stripe Tax) |

**Outstanding pre-deploy actions** (not code changes, but required before flipping prod):
1. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` in Vercel env (now hard-required).
2. Apply migrations: `supabase/migrations/20260430_stripe_events.sql`, `supabase/migrations/20260430_subscription_cancel_at_period_end.sql`.
3. Stripe Dashboard: activate Stripe Tax; create a new $29 Pro price; update `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`; remove `NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID`; confirm webhook subscribes to `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`.

**Next phase**: Phase 2 — broken/half-built features (LIBRARY, EXT, VOICE, PUBLISH, X, ONBOARD). See `PHASE2_HANDOFF.md`.

---

## Recommended Ship Path

1. **Cut from v1**: Public API v1, MCP server, Developer Portal, Blog (see "Cut Scope" section below).
2. **Phase 1 — security & data integrity** (~3 days): items in `SEC` and `MONEY` sections.
3. **Phase 2 — broken/half-built features** (~4 days): items in `LIBRARY`, `EXT`, `VOICE`, `PUBLISH`, `X`, `ONBOARD`.
4. **Phase 3 — polish + dead code purge** (~5 days): items in `DEAD`, `MOBILE`, `OBSERVE`, P1 items in remaining sections.
5. **Phase 4 — pre-launch hardening** (~2 days): Sentry, env validation, password reset, smoke tests.

**Estimated total: ~2 weeks of focused engineering** before this is actually shippable.

---

## Cut Scope (do not ship in v1)

| ID | Decision | Rationale |
|---|---|---|
| `CUT-1` | **Public API v1** — drop `/developers`, do not link from marketing | ~40% of advertised endpoints missing, rate limiter fails open, CORS locked to own origin (defeats public API), thread publish non-atomic. Ship as private alpha later. |
| `CUT-2` | **MCP server** | Zero implementation despite product branding. Plan Phase 3 entirely unbuilt. |
| `CUT-3` | **Landing blog** | "remove blog links" commit left routes live; `tsc` errors; orphan indexable pages. |
| `CUT-4` | **BullMQ pipeline** | Dead code with no producer, no deployment manifest. Remove `bullmq` + `ioredis` deps. QStash is the real path. |
| `CUT-5` | **Voice-memo / transcript / Reels code paths** | Confirmed deprecated per project memory. Purge per `DEAD` section. |

---

## SEC — Security ship-blockers

- [x] **SEC-1 [P0]** `.env.production` is git-tracked. `git ls-files | grep .env.production` confirms. Even with only public values today, future secret leakage is one edit away.
  - **Fix:** add `.env.production` to `.gitignore`, `git rm --cached .env.production`, scan history for accidental secrets.
  - **Acceptance:** `git ls-files` no longer shows the file.

- [x] **SEC-2 [P0]** Cron auth fails open when `CRON_SECRET` unset.
  - **Files:** `src/app/api/cron/publish-scheduled/route.ts:15`, `src/app/api/cron/voice-refresh/route.ts:127`, `src/app/api/cron/analytics-sync/route.ts:16`, `src/app/api/cron/metrics-refresh/route.ts:15`.
  - **Pattern:** `if (cronSecret && authHeader !== ...)` short-circuits to false → public endpoint.
  - **Fix:** require `CRON_SECRET` to be set; return 500 (or 401) if absent.
  - **Acceptance:** missing env var causes endpoints to reject all requests.

- [x] **SEC-3 [P0]** Rate limiter fails open when Upstash env vars unset. `src/lib/api/rate-limit.ts:23-29`.
  - **Fix:** fail-closed in production; log loudly; allow only in `NODE_ENV !== "production"`.

- [x] **SEC-4 [P0]** `/api/analytics/sync` has no `requireFeature("xApiSync")` gate. `src/app/api/analytics/sync/route.ts:7`.
  - **Symptom:** Free users bypass the paid feature by hitting the endpoint directly; UI gating is decorative.
  - **Fix:** add `requireFeature` at top of handler; return 402/403 for non-entitled users.

- [x] **SEC-5 [P0]** CSV upload has no size limit or MIME validation. `src/app/api/analytics/csv/route.ts:206-213`.
  - **Symptom:** `formData.get("file")` → `await file.text()` on arbitrary content; trivial OOM.
  - **Fix:** enforce max 10MB, MIME `text/csv`, extension `.csv`. Reject otherwise.

- [x] **SEC-6 [P0]** Middleware uses allowlist for protected paths — leaks future routes. `src/middleware.ts:38-51`.
  - **Symptom:** `/strategy`, `/agent-for-x`, and any new top-level route is unauthed by default.
  - **Fix:** flip to deny-by-default with explicit public allowlist (`/`, `/login`, `/signup`, `/agent-for-x/*`, `/api/capture`, `/api/generate-reply`, `/api/auth/*`, `/api/waitlist`, `/api/stripe/webhook`, `/api/qstash/*`, `/api/cron/*`).

- [x] **SEC-7 [P0]** Middleware excludes `/api/*` from cookie refresh. `src/middleware.ts:87` matcher.
  - **Symptom:** long-idle SPA tabs only hitting `/api/*` get stale sessions; user bounced mid-session.
  - **Fix:** include `/api/*` in matcher and call `getUser()`.

- [ ] **SEC-8 [P1]** `/api/v1/*` uses service-role client + manual `.eq("user_id", auth.userId)` filter for authorization. RLS no longer protects you; one forgotten filter = cross-tenant leak.
  - **Files:** every route under `src/app/api/v1/` uses `createAdminClient()`.
  - **Fix:** use anon client with the API key's user identity, or add a wrapper that asserts `user_id` filter is present in every query. (Cut `CUT-1` defers this.)

- [ ] **SEC-9 [P1]** `waitlist_signups.dev.jsonl` at repo root contains real email signups (untracked but not gitignored).
  - **Fix:** add `*.dev.jsonl` to `.gitignore`. Move existing data to Supabase or delete.

- [ ] **SEC-10 [P1]** No env-var validation at boot. Every `process.env.X!` non-null assertion masks missing vars; missing prod env produces opaque "Cannot read property of undefined".
  - **Fix:** add `src/lib/env.ts` with Zod schema (or manual `assertEnv()`); call from server entry; fail loudly at startup with which var is missing.

- [ ] **SEC-11 [P1]** No rate-limit / CAPTCHA on `/api/auth/login`. `src/app/api/auth/login/route.ts`.
  - **Fix:** add per-IP and per-email rate limit (e.g. 10/min) via Upstash.

- [ ] **SEC-12 [P1]** OAuth state CSRF protection relies only on DB row presence. `src/app/api/x/callback/route.ts:36-48`.
  - **Fix:** also tie `state` to a signed httpOnly cookie set during `/x/connect`.

- [ ] **SEC-13 [P2]** OAuth `x_oauth_requests` cleanup is incomplete on failure paths (e.g. `save_failed`). `src/app/api/x/callback/route.ts:81-84`.

---

## MONEY — Stripe / billing / quota

- [x] **MONEY-1 [P0]** Stripe webhook has no idempotency. `src/app/api/stripe/webhook/route.ts:14`.
  - **Symptom:** Stripe retries on 5xx and network blips; retry of `customer.subscription.updated` can flip a recovered sub back to `past_due`.
  - **Fix:** create `stripe_events` table keyed by `event.id`; insert-or-skip before processing.

- [x] **MONEY-2 [P1]** Webhook missing `customer.subscription.created` handler. `src/app/api/stripe/webhook/route.ts:38`.
  - **Symptom:** subs created via Portal/Stripe Dashboard never sync until next `updated` fires.

- [x] **MONEY-3 [P1]** Webhook missing `invoice.payment_succeeded` handler.
  - **Symptom:** renewals don't refresh `current_period_end` until the next subscription event.

- [x] **MONEY-4 [P1]** Webhook returns HTTP 500 on processing errors. `src/app/api/stripe/webhook/route.ts:139`.
  - **Symptom:** Stripe retries indefinitely until event expires; compounds the lack of idempotency.
  - **Fix:** return 200 after logging; let our own retry mechanism handle it.

- [x] **MONEY-5 [P1]** `NEXT_PUBLIC_APP_URL || "http://localhost:3000"` fallback in checkout + portal.
  - **Files:** `src/app/api/stripe/checkout/route.ts:48`, `src/app/api/stripe/portal/route.ts:28`.
  - **Symptom:** missing env in prod = Stripe sends users to localhost.
  - **Fix:** hard-fail if env missing.

- [x] **MONEY-6 [P1]** Checkout creates duplicate Stripe customer if Supabase row missing but Stripe customer exists. `src/app/api/stripe/checkout/route.ts:31-46`.
  - **Fix:** also `stripe.customers.list({ email })` before creating.

- [x] **MONEY-7 [P1]** Pricing page lists "Priority support" on Business but no support channel exists in repo.
  - **Resolved 2026-04-30:** Business tier removed (MONEY-10); Pro now lists "Support via @AgentsForX DM"; BillingTab surfaces the same DM link as the early-launch support channel.

- [x] **MONEY-8 [P1]** Pricing page has no Terms/Privacy link near the buy button, no "cancel anytime / no refunds" copy.
  - **File:** `src/app/pricing/page.tsx`.

- [x] **MONEY-9 [P1]** `requireAiGeneration` is called BEFORE input validation in `/api/v1/drafts/generate`. `src/app/api/v1/drafts/generate/route.ts:11-12`.
  - **Symptom:** AI quota burned on a 400.

- [x] **MONEY-10 [P2]** Business plan limits identical to Pro. `src/lib/stripe/subscription.ts:69-75`. Business buyers get nothing extra functionally.
  - **Resolved 2026-04-30:** Business tier dropped entirely; Pro bumped from $19 → $29. `PlanId` is now `"free" | "pro"`; `NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID` env removed.

- [x] **MONEY-11 [P2]** `customer.subscription.deleted` downgrades to free immediately, ignores remaining paid period.
  - **Resolved 2026-04-30:** New `isSubscriptionActive()` helper graces both `past_due` and `canceled` while `current_period_end` is in the future; `subscription.deleted` keeps prior `plan_id` during grace.

- [x] **MONEY-12 [P2]** No `cancel_at_period_end` UI feedback. Users who cancel via Portal get no UI signal until period ends.
  - **Resolved 2026-04-30:** New `cancel_at_period_end` column on `subscriptions`, written by every webhook event; surfaced via `/api/stripe/subscription`; BillingTab shows "Your subscription will end on <date>".

- [x] **MONEY-13 [P2]** No automatic_tax / VAT / tax_id_collection / billing_address_collection. EU compliance gap.
  - **Resolved 2026-04-30:** Checkout now sets `automatic_tax`, `tax_id_collection`, `billing_address_collection: "required"`, `customer_update`. **Requires Stripe Tax to be activated in the Stripe Dashboard before deploy.**

- [ ] **MONEY-14 [P2]** `BillingTab.tsx:38, 41` and `pricing/page.tsx:42, 45` use `alert()` for errors. (Tracked under `OBSERVE-3`.)

- [x] **MONEY-15 [P2]** API keys POST returns the raw key without `Cache-Control: no-store`. `src/app/api/settings/api-keys/route.ts:84-87`.

---

## EXT — Chrome extension

- [ ] **EXT-1 [P0]** Save button hits wrong endpoint. `chrome-extension/src/background/background.js:283` calls `/api/inspiration` (gated by `requireAiGeneration`) instead of `/api/capture`.
  - **Symptom:** Free user burns their 5/day AI quota saving 5 tweets. Instant 1-star reviews.
  - **Fix:** route save to `/api/capture`; promotion-to-inspiration is a separate user action.

- [ ] **EXT-2 [P0]** Reply composer injection uses deprecated `document.execCommand('insertText')` against X's Draft.js editor. `chrome-extension/src/content/content.js:1517-1624`.
  - **Symptom:** state desync — user types and reply disappears, send button stays disabled. Falls back to `alert()` (#OBSERVE-3).
  - **Fix:** use proper Draft.js / Lexical input simulation (`InputEvent` with `data` and `inputType: "insertText"`, then `dispatchEvent`).

- [ ] **EXT-3 [P0]** "Niche account watch" feature is in product spec but has zero code in extension.
  - **Files:** no `WATCH_ACCOUNT` handler, no `/api/niche-accounts`, no `/api/niche-posts` routes.
  - **Fix:** either build it or strike it from the public feature list.

- [ ] **EXT-4 [P1]** Token refresh: on second 401 (after refresh) doesn't `clearTokens()`. `chrome-extension/src/background/background.js:120-138`.
  - **Symptom:** popup keeps showing "logged in" while every API call 401s.

- [ ] **EXT-5 [P1]** Token refresh: on network error, silently keeps stale tokens. `background.js:185-189`.

- [ ] **EXT-6 [P1]** MutationObserver + IntersectionObserver are global, never disconnected. `chrome-extension/src/content/content.js:1764-1808`.
  - **Symptom:** memory + CPU leak on long X sessions.
  - **Fix:** disconnect on `pagehide` / store and clean up on SPA navigation.

- [ ] **EXT-7 [P1]** `processedPosts` Set and `savedNichePostIds` chrome.storage Set both grow unbounded.
  - **Fix:** LRU cap (e.g. last 5000) or TTL-based eviction.

- [ ] **EXT-8 [P1]** Opportunity score `normalizeScore` uses rolling min/max from <100 samples — first post returns 50, early posts get unstable scores. `content.js:206-227`.

- [ ] **EXT-9 [P1]** Opportunity score throttle is global across batch. `content.js:1786`. If 10 posts intersect at once, only first gets scored.
  - **Fix:** per-article throttle key.

- [ ] **EXT-10 [P1]** `corsHeaders` (deprecated export) computed once at module load; preflighted requests from extension may fail. `src/lib/cors.ts:45`.
  - **Fix:** every API route that handles preflight must use `handleCors(request)`.

- [ ] **EXT-11 [P1]** Reply approach labels hardcoded `["Punchy", "Insight", "Spicy"]` regardless of selected tone. `src/app/api/generate-reply/route.ts:271`.
  - **Fix:** approach labels should reflect the selected tone (or remove labels).

- [ ] **EXT-12 [P1]** Save URL constructed as `https://x.com/${x_username}/status/${x_post_id}` — empty username produces `https://x.com//status/123`. `background.js:282`.

- [ ] **EXT-13 [P1]** "Already saved" duplicate state on save button is visually identical to a normal save. `content.js:1003`.
  - **Fix:** distinct toast / icon state.

- [ ] **EXT-14 [P1]** Extension popup `apiUrl` setting can be changed by user but `manifest.json` `host_permissions` is fixed to `https://app.agentsforx.com/*`. `manifest.json:11-14`, `popup.js:551-563`.
  - **Fix:** lock the URL or document the limitation.

- [ ] **EXT-15 [P2]** Logout doesn't revoke refresh token server-side. `popup.js:478`.

- [ ] **EXT-16 [P2]** ~10+ console.log calls in production reply-generation paths spam user consoles. (Tracked under `OBSERVE-2`.)

- [ ] **EXT-17 [P2]** Every tweet that scrolls into view adds a `document.click` listener for the tone dropdown. `content.js:1742`.

- [ ] **EXT-18 [P2]** `} catch {}` empty block swallowing errors. `content.js:650`.

---

## LIBRARY — Captured / library / patterns / insights

- [ ] **LIBRARY-1 [P0]** Library page does not show captured posts. `src/components/library/LibraryPage.tsx:5-19` is just a wrapper around `InspirationPostsTab`. The triage UI (`PostCard.tsx`) is dead code, never rendered.
  - **Fix:** wire `LibraryPage` to render captured posts grid with filter, search, triage actions. Implement pagination.

- [ ] **LIBRARY-2 [P0]** Pattern extract `.single()` throws on first-run users (empty `user_analytics`). `src/app/api/patterns/extract/route.ts:53-60`.
  - **Fix:** `.maybeSingle()` + graceful empty-state UI.

- [ ] **LIBRARY-3 [P0]** Pattern `confidence_score` stored 0–1, rendered as percent with `Math.round`. `src/components/voice/PatternsTab.tsx:215`.
  - **Symptom:** every pattern displays 0% or 100%.
  - **Fix:** `Math.round(confidence_score * 100)` or change storage convention consistently.

- [ ] **LIBRARY-4 [P0]** `/api/analytics/best-times` uses `.single()` — throws on multi-row analytics. `src/app/api/analytics/best-times/route.ts:24-30`.
  - **Fix:** `.order(uploaded_at).limit(1).maybeSingle()`.

- [ ] **LIBRARY-5 [P0]** `BestTimesToPost.tsx` referenced in product docs but only `BestTimesSection` exists. Confirm whether file should exist or doc is wrong.

- [ ] **LIBRARY-6 [P1]** No pagination on `/api/captured`. `src/app/api/captured/route.ts:23-42` loads ALL captured rows.
  - **Fix:** range pagination, default limit 50.

- [ ] **LIBRARY-7 [P1]** Promote-to-inspiration: no dedupe on `source_url`. `src/app/api/captured/[id]/promote/route.ts:42-55`.
  - **Fix:** check for existing inspiration with same `source_url` before insert.

- [ ] **LIBRARY-8 [P1]** Promote-to-inspiration fires `analyzeAndUpdate(...)` without `await` and without `waitUntil()`. `route.ts:69`.
  - **Symptom:** Next.js terminates the function; rows stuck `analysis_status: 'analyzing'` forever.
  - **Fix:** wrap with `waitUntil()` (Vercel) or move to QStash queue.

- [ ] **LIBRARY-9 [P1]** Pattern extract disable-then-insert is non-atomic. `src/app/api/patterns/extract/route.ts:211-215`.
  - **Symptom:** concurrent double-click → two enabled batches.
  - **Fix:** transaction (Postgres function) or unique constraint on `(user_id, is_enabled=true)`.

- [ ] **LIBRARY-10 [P1]** Pattern suggestions topic-pattern path bypasses the `multiplier >= 1.5` gate. `src/app/api/patterns/suggestions/route.ts:78-89`.

- [ ] **LIBRARY-11 [P1]** Insights chat is buffered, not streaming; history wiped on refresh. `src/app/api/insights-chat/route.ts:161-172`, `AssistantTab.tsx:34`.
  - **Fix:** stream via `ReadableStream`; persist messages to a `chat_messages` table.

- [ ] **LIBRARY-12 [P1]** Inspiration delete is optimistic-on-success only, no rollback, no toast, no confirm. `src/components/voice/InspirationPostsTab.tsx:96-103`.

- [ ] **LIBRARY-13 [P1]** `InspirationPostsTab.tsx:71-82` uses CSV `engagement_score` directly instead of canonical `weightedEngagement()`.

- [ ] **LIBRARY-14 [P2]** Pattern toggle has no error rollback. `PatternsTab.tsx:91-107`.

- [ ] **LIBRARY-15 [P2]** "Thread detection" via `🧵` / `1/` substring — leftover heuristic, not driven by extracted_patterns. `src/components/insights/PatternsSection.tsx:75-92`.

- [ ] **LIBRARY-16 [P2]** Mixed loading-state conventions across tabs (`animate-pulse`, inline pulse, skeleton bars, custom class). Standardize.

---

## VOICE — Voice system

- [ ] **VOICE-1 [P0]** `/api/voice/csv-upload` parses CSV and returns to client but **does not write `user_analytics.posts`**. `src/app/api/voice/csv-upload/route.ts:178-183`.
  - **Symptom:** modal "succeeds" but pattern extraction, voice refresh, niche analyze, examples seed all read from a blob that was never written.
  - **Fix:** persist parsed posts to `user_analytics.posts` JSONB. Decide whether `/api/voice/csv-upload` and `/api/analytics/csv` should be unified.

- [ ] **VOICE-2 [P0]** `/api/voice/preview` uses a divergent prompt builder that doesn't match real generation. `src/app/api/voice/preview/route.ts:7-62`.
  - **Symptom:** preview lies — output won't match what users get from `/api/generate-reply`.
  - **Fix:** call the same `assemblePrompt()` path as production.

- [ ] **VOICE-3 [P0]** `RefreshButton` is dead UI — defined but rendered nowhere. Manual voice refresh is unreachable.
  - **Fix:** mount in Voice page header, or delete component + `/api/voice/refresh` if cron is sufficient.

- [ ] **VOICE-4 [P1]** Voice refresh only handles `content_type: "post"`. Reply voice never auto-refreshed. `src/app/api/voice/refresh/route.ts:42-90`.

- [ ] **VOICE-5 [P1]** Voice settings save isn't optimistic, no rollback, no error toast. `src/components/voice/VoiceSection.tsx:231-245`.

- [ ] **VOICE-6 [P1]** Voice settings PATCH does full-row spread + upsert. `src/app/api/voice/settings/route.ts:247-253`.
  - **Symptom:** dragging two sliders concurrently → last-write-wins clobbers fields.
  - **Fix:** field-level patch (`update().eq("user_id", ...).set({ field: value })`).

- [ ] **VOICE-7 [P1]** Examples have no max-length cap, no duplicate check, no delete confirm. `src/app/api/voice/examples/route.ts:135-198`, `VoiceSection.tsx:264`.

- [ ] **VOICE-8 [P1]** CSV upload `isReply` heuristic = "starts with @" misses thread/quote replies. `csv-upload/route.ts:24`.

- [ ] **VOICE-9 [P1]** `parseInt("1,234")` yields 1, silently corrupting metrics. `csv-upload/route.ts:91-97`.
  - **Fix:** strip commas before parse, or use `Number(s.replace(/,/g, ""))`.

- [ ] **VOICE-10 [P1]** Slider drags fire one PATCH per change, no debounce. `VoiceSection.tsx`.
  - **Fix:** debounce 300ms; show "Saving…" indicator.

- [ ] **VOICE-11 [P1]** Examples GET has no pagination/limit. `examples/route.ts:55`.

- [ ] **VOICE-12 [P1]** Voice chat is buffered (not streaming). `src/app/api/voice/chat/route.ts`.
  - **Fix:** stream via OpenAI SDK `stream: true`.

- [ ] **VOICE-13 [P1]** Voice chat `handleAcceptChanges` spreads entire existing row into upsert. `chat/route.ts:587-599`. Same race as VOICE-6.

- [ ] **VOICE-14 [P1]** Pattern controls toggle is not optimistic, no error toast on fail. `src/components/voice/PatternControlsTab.tsx:58-76`.

- [ ] **VOICE-15 [P2]** `/api/voice/refresh:53,108` and `examples/route.ts:80-83` use impressions-only sort instead of canonical `weightedEngagement()`.

- [ ] **VOICE-16 [P2]** `prompt-assembler.ts` and `voice/refresh/route.ts` use `as any` repeatedly on row shapes. (Tracked also in `LINT-1`.)

- [ ] **VOICE-17 [P2]** PROHIBITED-WORDS list blacklists "can", "may", "just", "that". `chat/route.ts:134-135, 182-183`. Will produce stilted replies.

- [ ] **VOICE-18 [P2]** `slice(-6)` / `slice(-8)` of conversation history may truncate stage transitions. `chat/route.ts:498, 536`.

- [ ] **VOICE-19 [P2]** Legacy schema fallback path (string-matching `"voice_type"` in error messages). `settings/route.ts:36-62, 214, 234`. Remove if migration applied.

- [ ] **VOICE-20 [P2]** New range/type validation missing on `auto_refresh_enabled`, `refresh_day_of_week`, `max_example_tokens`, `max_inspiration_tokens`. `settings/route.ts:155-158`.

---

## PUBLISH — Workers / queue / cron

- [ ] **PUBLISH-1 [P0]** Double-post race between QStash webhook and `cron/publish-scheduled`.
  - **Files:** `src/app/api/qstash/publish/route.ts:62-65`, `src/app/api/cron/publish-scheduled/route.ts:28-41`.
  - **Symptom:** both can read `status='scheduled'` and post to X concurrently.
  - **Fix:** atomic claim — `UPDATE scheduled_posts SET status='publishing' WHERE id=$1 AND status='scheduled' RETURNING *`. Only proceed if row count = 1.

- [ ] **PUBLISH-2 [P0]** Thread publish has no rollback. `src/app/api/v1/publish/now/route.ts:81-90`.
  - **Symptom:** if tweet 3/5 fails, tweets 1-2 are live, draft state inconsistent, no captured rows persisted.
  - **Fix:** track partial-publish state; allow user to resume from last successful tweet ID.

- [ ] **PUBLISH-3 [P0]** BullMQ pipeline is dead code but `npm run worker:publish` still boots and idles forever. (Cut: `CUT-4`.)
  - **Files to remove:** `scripts/publish-worker.mjs`, `src/lib/queue/queues.ts`, `src/lib/queue/publish.ts`, `src/lib/queue/connection.ts`, package.json `worker:publish` script, `bullmq` and `ioredis` from deps.

- [ ] **PUBLISH-4 [P1]** Cron `analytics-sync` and `metrics-refresh` exist but not in `vercel.json`. Orphan code that never runs.
  - **Fix:** either add cron entries or delete the routes.

- [ ] **PUBLISH-5 [P1]** Cron `publish-scheduled` runs only `0 5 * * *` (once daily). Failed posts sit ~20h before safety-net retry.
  - **Fix:** every 5–15 min.

- [ ] **PUBLISH-6 [P1]** Retry path doesn't cancel old QStash message. `src/app/api/publish/retry/route.ts:36-44`.
  - **Symptom:** old + new message both fire → double-post.
  - **Fix:** call QStash messages cancel API before re-enqueue; OR record `qstash_message_id` and dedupe in webhook.

- [ ] **PUBLISH-7 [P1]** No DLQ / failure notification surface. Failed posts only visible in `/queue` page.
  - **Fix:** email user on failure (at minimum); in-app notification badge.

- [ ] **PUBLISH-8 [P1]** No rate-limit / 429 / Retry-After handling for X API calls in publish path.
  - **Fix:** detect 429, exponential backoff, requeue with delay.

- [ ] **PUBLISH-9 [P1]** QStash webhook returns 200 on application failure to suppress retries. `qstash/publish/route.ts:73`. Loses retry on transient X 500s.

- [ ] **PUBLISH-10 [P1]** Schedule UI swallows errors silently. `src/components/queue/QueuePage.tsx:109` `load()` has no try/catch; 401 produces non-array → empty state shown instead of auth error.

- [ ] **PUBLISH-11 [P2]** Schedule UI has no edit/reschedule (only cancel/retry).

- [ ] **PUBLISH-12 [P2]** No timezone stored per user. DST edge cases on far-future scheduled posts.

- [ ] **PUBLISH-13 [P2]** `.env.example` missing all QStash keys (`QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY`, `QSTASH_PUBLISH_URL`).

---

## X — X OAuth + sync + analytics

- [ ] **X-1 [P0]** `/api/x/status` only checks if a row exists. Cannot detect expired/revoked tokens. `src/app/api/x/status/route.ts:18-26`.
  - **Symptom:** UI says "Connected" forever after user revokes via x.com.
  - **Fix:** also call `/2/users/me` (or check `access_token_expires_at`); return "needs_reconnection".

- [ ] **X-2 [P0]** `/api/x/sync` has no pagination — caps at 100 tweets. `src/app/api/x/sync/route.ts:27-31`.
  - **Fix:** paginate with `pagination_token`; run as background job for large accounts.

- [ ] **X-3 [P0]** Two competing analytics-sync paths writing to different tables.
  - **Files:** `src/app/api/analytics/sync/route.ts` → `user_analytics.posts`. `src/app/api/x/analytics-sync/route.ts` → `captured_posts`.
  - **Fix:** pick one canonical path or document the split with intent.

- [ ] **X-4 [P1]** Disconnect doesn't call X's `/2/oauth2/revoke`. `src/app/api/x/status/route.ts:46-73`.
  - **Symptom:** token remains valid at X until natural expiry.

- [ ] **X-5 [P1]** `/api/x/sync` runs synchronously in request thread, no background job, no progress reporting. Will timeout on Vercel default 10–15s.
  - **Fix:** kick off via QStash; return 202 + status endpoint.

- [ ] **X-6 [P1]** `/api/x/sync` loads all `existingIds` into memory unbounded. `sync/route.ts:34-44`.

- [ ] **X-7 [P1]** `/api/analytics/sync` pagination loop hardcoded to 2 pages (max 200). Same scaling cliff.

- [ ] **X-8 [P1]** Single `user_analytics` row replacement is not atomic with merge read. Concurrent CSV upload + analytics-sync can lose data. `analytics/sync/route.ts:96-112`.

- [ ] **X-9 [P1]** `/api/x/search` has no `requireFeature` gate, no rate-limit. Free users can pound it. `src/app/api/x/search/route.ts:6-45`.

- [ ] **X-10 [P1]** `X_REDIRECT_URI` is `process.env.X_REDIRECT_URI!`. No validation; misconfigured deploy silently sends users to empty `redirect_uri`. `src/lib/x-api/client.ts:51, 70`. (Subset of `SEC-10`.)

- [ ] **X-11 [P1]** N+1 query in extension analytics-sync update loop. `src/app/api/x/analytics-sync/route.ts:139-163`.

- [ ] **X-12 [P2]** Vestigial OAuth 1.0a fields written as null. `src/app/api/x/connect/route.ts:28-29`, `callback/route.ts:63`.
  - **Fix:** drop columns from `x_oauth_requests` table in a migration.

- [ ] **X-13 [P2]** `/api/health` exposes both BYO (`X_API_KEY`/`X_API_SECRET`) and in-house (`X_CLIENT_ID`/`X_CLIENT_SECRET`) env vars. BYO is unused — remove.

- [ ] **X-14 [P2]** `client.ts:97-129` `refreshAccessToken` is inconsistent: line 108 supports public client, line 69 assumes confidential. Pick one.

---

## ONBOARD — Auth + signup + onboarding + tour

- [ ] **ONBOARD-1 [P0]** No password reset flow exists anywhere in `src/`. Users locked out forever on forgotten password.
  - **Fix:** add `/forgot-password` + `/reset-password` pages and Supabase reset email.

- [ ] **ONBOARD-2 [P0]** No `/drafts` index exists; `drafts/[id]/page.tsx:303` back-link points to it. Guaranteed 404.
  - **Fix:** create `src/app/drafts/page.tsx` listing all user drafts (or change back-link to `/create?tab=drafts`).

- [ ] **ONBOARD-3 [P1]** Signup never creates a `user_settings` row. Some callers do lazy-create (`/api/settings/route.ts:25-37`); others use `.single()` and 500 on PGRST116.
  - **Fix:** create `user_settings` row in signup or in a Supabase trigger on `auth.users` insert.

- [ ] **ONBOARD-4 [P1]** OAuth redirect uses `window.location.origin`. `login/page.tsx:46`, `signup/page.tsx:40, 62`. Breaks in dev or preview if not allowlisted.
  - **Fix:** use `NEXT_PUBLIC_APP_URL`.

- [ ] **ONBOARD-5 [P1]** Login page has no `?error=auth` query handler. Callback redirects with that param but UI never shows it. No "Forgot password?" link.

- [ ] **ONBOARD-6 [P1]** `OnboardingGate.tsx:34` returns `null` while loading — blank flash on every navigation.
  - **Fix:** show skeleton sidebar + main shell.

- [ ] **ONBOARD-7 [P1]** ProductTour skip = permanent dismiss with no reset path. `ProductTour.tsx:108-110`.
  - **Fix:** "Remind me later" option; settings toggle to replay tour.

- [ ] **ONBOARD-8 [P1]** ProductTour navigation fight: `useEffect` calls `router.push` on every mismatched render — yanks user back if they navigate away. `ProductTour.tsx:37-45`.

- [ ] **ONBOARD-9 [P1]** Tour positioning has no fallback UI when target selector never resolves. `useTourPositioning.ts:140` polls 15× then silently centers. User sees floating tooltip with no spotlight.

- [ ] **ONBOARD-10 [P1]** AuthProvider doesn't differentiate `SIGNED_OUT`, `TOKEN_REFRESHED`, `USER_UPDATED`. SIGNED_OUT in another tab won't redirect. `src/components/auth/AuthProvider.tsx:42-46`.

- [ ] **ONBOARD-11 [P1]** Two `react-hooks/set-state-in-effect` lint errors — real cascading-render bugs.
  - **Files:** `src/components/onboarding/OnboardingGate.tsx:20`, `src/components/voice/settings/SpecialNotesSection.tsx:16`.

- [ ] **ONBOARD-12 [P2]** Signup password min is 6 chars. Increase to 8 (NIST baseline).

- [ ] **ONBOARD-13 [P2]** Login redirect ignores `?next=` param. `middleware.ts:69-73`.

- [ ] **ONBOARD-14 [P2]** `OnboardingModal.tsx` exported but never imported. Dead code.

- [ ] **ONBOARD-15 [P2]** `/api/auth/login` uses `@supabase/supabase-js` (not `@supabase/ssr`); doesn't set session cookie. OK if only extension uses it — confirm and document.

- [ ] **ONBOARD-16 [P2]** Refresh token not revoked server-side on logout. `src/app/api/auth/refresh/route.ts`.

---

## DASH — Dashboard / sidebar / nav / layout

- [ ] **DASH-1 [P1]** `/library` not in `SidebarNav.tsx:9-16`. Reachable only via deep links.
  - **Fix:** add to sidebar (or rename to "Saved" if "Library" is too vague).

- [ ] **DASH-2 [P1]** `/developers` route exists with full Scalar API reference but not linked anywhere in app shell. Dead-end. (Cut per `CUT-1` — delete the route or hide.)

- [ ] **DASH-3 [P1]** `error.tsx` has no "Go home" link. If `reset()` re-throws, user is trapped.

- [ ] **DASH-4 [P1]** `layout.tsx:30-33` metadata is missing `viewport`, `themeColor`, `openGraph`, `icons.apple`, `manifest`. Recent rebrand commit only set title/description.
  - **Fix:** add Next.js `viewport` export; create `src/app/apple-icon.png`, `src/app/opengraph-image.png`.

- [ ] **DASH-5 [P1]** No `loading.tsx` files anywhere. Every navigation = hard wait.
  - **Fix:** add at least at root and per major route group.

- [ ] **DASH-6 [P1]** `OnboardingModal.tsx:358` "Upload CSV" QuickLink points at `/` rather than triggering upload drawer.

- [ ] **DASH-7 [P2]** `aria-current="page"` missing on active sidebar link. `SidebarNav.tsx:40-54`.

- [ ] **DASH-8 [P2]** No `<nav aria-label="Primary">` landmark. No "Skip to content" link.

- [ ] **DASH-9 [P2]** `HomePage.tsx:78` `postedCount` computed but never rendered. Dead.

- [ ] **DASH-10 [P2]** `HomePage.tsx:60-64` fetch errors only console.error'd; on API failure user sees fully-empty dashboard with no error state.

- [ ] **DASH-11 [P2]** `UserMenu.tsx` is a duplicate of `SidebarUserMenu.tsx` and unused. Dead.

- [ ] **DASH-12 [P2]** `global-error.tsx` uses hardcoded `#0a0a0f`/`#6366f1`; no "Go home" affordance.

---

## MOBILE — Mobile responsiveness

- [ ] **MOBILE-1 [P0]** App has zero mobile responsiveness. Fixed `w-60` sidebar + `grid-cols-[1fr_360px]` overflows every phone. No hamburger, no overlay.
  - **Files:** `src/components/sidebar/Sidebar.tsx:23-30`, `src/app/layout.tsx:51`, `src/components/home/HomePage.tsx:129`.
  - **Fix path A (recommended):** add mobile drawer with hamburger; `min-w-0` on main; responsive grid.
  - **Fix path B:** detect mobile and show "Open on desktop" gate (only acceptable if mobile is explicitly out of scope for v1).

- [ ] **MOBILE-2 [P0]** No `viewport` meta. Next 16 requires explicit `viewport` export for `width=device-width, initial-scale=1`.

---

## DEAD — Dead code purge

- [ ] **DEAD-1 [P0]** `landing/src/app/blog/[slug]/page.tsx` and `blog/page.tsx` import unresolved `@/lib/blog-data` — 13 tsc errors.
  - **Fix:** delete `landing/src/app/blog/`, `landing/src/lib/blog-data.ts`, and any blog navigation references. (Cut: `CUT-3`.)

- [ ] **DEAD-2 [P0]** REEL_SCRIPT references not removed despite project memory saying they should be.
  - **Files:** `src/components/create/DraftsList.tsx:8`, `DraftCard.tsx:10, 27`, `src/app/drafts/[id]/page.tsx:9, 108-162, 289, 339-344`, `src/components/ui/Badge.tsx:113, 124`.
  - **Fix:** delete entire `ReelScriptContent` type, `ReelScriptEditor` component, all `REEL_SCRIPT` enum values and code paths.

- [ ] **DEAD-3 [P1]** Voice-memo / transcript pipeline residue.
  - **Files:** `src/components/create/NewDraftForm.tsx` (transcript + audio UI), `src/lib/openai/prompts/voice-memo-instructions.ts`, `src/lib/openai/transcribe.ts`, `src/lib/openai/preprocessor.ts`, `src/lib/openai/router.ts`, BullMQ `transcription` queue in `src/lib/queue/queues.ts:15-34`.
  - **Fix:** delete; remove transcript-related fields from drafts schema if any.

- [ ] **DEAD-4 [P1]** `src/components/create/StyleSelector.tsx` and `FormatSelector.tsx` only re-exported in `index.ts:3`, never consumed by `CreatePage.tsx`. Dead.

- [ ] **DEAD-5 [P1]** Duplicate waitlist API: `src/app/api/waitlist/route.ts` and `landing/src/app/api/waitlist/route.ts` are byte-identical. Pick one home.

- [ ] **DEAD-6 [P1]** Duplicate legal pages: `src/app/agent-for-x/{privacy,terms}` and `landing/src/app/{privacy,terms}` — drift risk.
  - **Fix:** pick one canonical location.

- [ ] **DEAD-7 [P1]** BullMQ queues dead. (See `PUBLISH-3` / `CUT-4`.)

- [ ] **DEAD-8 [P1]** `RefreshButton.tsx` defined but rendered nowhere. (See `VOICE-3`.)

- [ ] **DEAD-9 [P1]** `OnboardingModal.tsx`, `UserMenu.tsx` unused. (See `DASH-11`, `ONBOARD-14`.)

- [ ] **DEAD-10 [P2]** `landing-page-assets/demo-extension.gif` superseded by mp4 — remove asset.

- [ ] **DEAD-11 [P2]** `BYO X` env vars in `.env.example` (`X_API_KEY`, `X_API_SECRET`) — remove. (See `X-13`.)

- [ ] **DEAD-12 [P2]** `IMPLEMENTATION.md`, `PRD.md`, `chrome_extension_addition.md`, `project.md`, `railway_error.md`, `CONSOLE_OUTPUT.md`, ad-hoc `dashboard-*.png` screenshots in repo root — should be moved to `docs/` or deleted.

---

## LANDING — Marketing site

- [ ] **LANDING-1 [P1]** No waitlist form rendered anywhere. All CTAs go to `${APP_URL}/signup`. Yet `/api/waitlist` exists in two places.
  - **Fix:** decide — render the form, or remove both API routes.

- [ ] **LANDING-2 [P1]** Footer "Chrome Extension" link → `${APP_URL}/signup`. `landing/src/app/page.tsx:1546-1551`. Should be Chrome Web Store URL (or removed until extension is published).

- [ ] **LANDING-3 [P1]** Hero `<video>` has no `poster` attribute, `preload="auto"` on 3.7MB MP4. `landing/src/app/page.tsx:383-392`.
  - **Fix:** add poster image, `preload="metadata"`.

- [ ] **LANDING-4 [P1]** No analytics (GA / PostHog / Plausible / Meta pixel). Zero conversion measurement on launch.

- [ ] **LANDING-5 [P1]** No `sitemap.ts`, `robots.txt`, `canonical` URL.

- [ ] **LANDING-6 [P1]** No per-page `metadata` exports on `/blog/*`, `/privacy`, `/terms`. All inherit root title.

- [ ] **LANDING-7 [P1]** No `not-found.tsx` or `error.tsx` in `landing/src/app/`.

- [ ] **LANDING-8 [P1]** `landing/.env.local.example` doesn't document `SUPABASE_SERVICE_ROLE_KEY`. Deploy will silently 500 on `/api/waitlist`.

- [ ] **LANDING-9 [P2]** OG image `landing/public/og.png` is 642 KB (target <200 KB).

- [ ] **LANDING-10 [P2]** "See how it works" CTA jumps to `#features` instead of `#how`. `page.tsx:323`.

- [ ] **LANDING-11 [P2]** Top nav has no Blog link but `/blog` route exists. (Cut per `CUT-3`.)

- [ ] **LANDING-12 [P2]** Feature `<Image>` alt text is generic (`${badge} screenshot`). Improve for SEO/a11y.

- [ ] **LANDING-13 [P2]** Hero video has no WebM source / format fallback.

---

## API — Public API v1 (SCOPE: cut from v1, see `CUT-1`)

If `CUT-1` is overruled, these are the conditions for shipping the public API:

- [ ] **API-1 [P0]** Rate limiter must fail closed. (See `SEC-3`.)
- [ ] **API-2 [P0]** CORS must accept third-party origins. `src/lib/api/response.ts:10-14` currently locked to `NEXT_PUBLIC_APP_URL`.
- [ ] **API-3 [P0]** Thread publish must be transactional. (See `PUBLISH-2`.)
- [ ] **API-4 [P0]** MCP server: implement at least 5 tools as a publishable npm package. Ship Claude Desktop config docs.
- [ ] **API-5 [P1]** Implement missing endpoints: `/queue`, `/queue/{id}` (DELETE/retry), `/analytics/{overview,posts,best-times,boost-opportunities}`, `/patterns`, `/patterns/extract`, `/voice/examples`, `/strategy/progress`, `/me`.
- [ ] **API-6 [P1]** OpenAPI spec drift: `PUT /strategy` vs spec POST; spec `/health` advertises `key_prefix` but route doesn't return it; missing 429 docs on POST endpoints; missing `X-Request-Id`/`X-RateLimit-*` header docs.
- [ ] **API-7 [P1]** API key DB layer: support `expires_at`, `rate_limit` per key from UI; support `sk_test_` prefix; emit `429` with `Retry-After` header.
- [ ] **API-8 [P1]** Per-endpoint rate-limit tiers: `/drafts/generate` should have stricter limit than reads (it costs LLM tokens).
- [ ] **API-9 [P1]** No `idempotency-key` support on `publish/now`. Replays double-post.
- [ ] **API-10 [P1]** `publish/schedule:74-76` enqueue failure logs but row is created with no `qstash_message_id`. Silent zombie.
- [ ] **API-11 [P1]** `drafts/generate:128-138` regex JSON extraction is brittle.
- [ ] **API-12 [P1]** API request logging: no `api_request_logs` table per plan; usage stats not surfaced in `ApiKeysTab`.
- [ ] **API-13 [P2]** No `Sunset`/`Deprecation`/`API-Version` headers.

---

## OBSERVE — Observability + UX hygiene

- [ ] **OBSERVE-1 [P0]** No Sentry / equivalent error tracking.
  - **Fix:** integrate `@sentry/nextjs`, ensure all API route errors are captured, sourcemap upload in build.

- [ ] **OBSERVE-2 [P1]** ~196 `console.*` calls in `src/`, ~34 in `chrome-extension/src/`. Highest offenders: `chrome-extension/src/content/content.js` (23), `src/app/api/generate-reply/route.ts` (14), `chrome-extension/src/background/background.js` (11), `src/components/voice/editor/VoiceEditorView.tsx` (7), `src/components/voice/VoiceSection.tsx` (7), `src/app/api/stripe/webhook/route.ts` (6).
  - **Fix:** wrap in dev-only logger; replace with Sentry `captureException` for errors.

- [ ] **OBSERVE-3 [P1]** Native `alert()` / `confirm()` dialogs used in production UI.
  - **Files:** `src/app/pricing/page.tsx:42, 45`; `src/components/insights/PatternsTab.tsx:82`; `src/components/settings/ApiKeysTab.tsx:85`; `src/components/settings/SettingsPage.tsx:92`; `src/components/settings/BillingTab.tsx:38, 41`; `src/components/create/DraftsList.tsx:34`; `chrome-extension/src/content/content.js:1244, 1622`.
  - **Fix:** build a real toast component (or use sonner / radix-toast) and a confirm modal.

- [ ] **OBSERVE-4 [P1]** No global request-ID propagation. `apiError` generates fresh `X-Request-Id` per call. Cross-log debugging impossible.

- [ ] **OBSERVE-5 [P2]** `_uid`, `_vt`, `_sn`, `parseError` and similar unused vars throughout — eslint warnings (8003 total).

---

## LINT — TypeScript + ESLint cleanup

- [ ] **LINT-1 [P1]** 989 ESLint errors. Build passes only because `next build` is configured to ignore lint.
  - **Highest density:** `src/app/api/voice/settings/route.ts`, `src/app/api/voice/refresh/route.ts`, `src/components/insights/AssistantTab.tsx`, `src/components/insights/PatternsSection.tsx`, `src/lib/openai/prompts/prompt-assembler.ts`.
  - **Common categories:**
    - `@typescript-eslint/no-explicit-any` (~hundreds)
    - `react/no-unescaped-entities` (multiple `'` and `"` in JSX text)
    - `prefer-const`
    - `react-hooks/exhaustive-deps`
    - `react-hooks/set-state-in-effect` (real bugs — see `ONBOARD-11`)
  - **Fix:** enable lint in `next build` (`eslint.ignoreDuringBuilds: false`), then sweep top files.

- [ ] **LINT-2 [P1]** 13 TypeScript errors in `landing/src/app/blog/*` (resolved by `CUT-3`).

---

## TEST — Pre-launch verification

These should be done **after** the P0/P1 work, before flipping the launch switch.

- [ ] **TEST-1 [P0]** Smoke test the critical user paths end-to-end on a staging deploy:
  - Sign up → email verify → onboarding tour → connect X → save 3 posts via extension → generate a reply → publish a draft → schedule a draft → see it post → cancel a scheduled draft.
- [ ] **TEST-2 [P0]** Stripe end-to-end with a test card: checkout pro → portal → cancel → reactivate → verify webhook idempotency by replaying events from Stripe CLI.
- [ ] **TEST-3 [P0]** Free-tier quota gating: hit `/api/inspiration`, `/api/generate-reply`, `/api/analytics/sync`, `/api/x/search`, `/api/v1/drafts/generate` directly with curl as a free user; verify 402.
- [ ] **TEST-4 [P0]** Run a load test on `/api/cron/publish-scheduled` with several scheduled posts to verify the atomic claim prevents double-post (`PUBLISH-1`).
- [ ] **TEST-5 [P1]** Browser test on real Chrome with the published extension on a fresh X account. Reply injection on Draft.js editor must work.
- [ ] **TEST-6 [P1]** Mobile audit: load on iOS Safari and Android Chrome. Confirm `MOBILE-1` resolution.
- [ ] **TEST-7 [P1]** Lighthouse run on landing + dashboard. Performance > 80, Accessibility > 90.
- [ ] **TEST-8 [P1]** Verify `vercel.json` cron entries actually fire after deploy (`PUBLISH-4`, `PUBLISH-5`).

---

## Counts

| Severity | Count |
|---|---|
| P0 (ship-blockers) | 30 |
| P1 (must-fix) | ~80 |
| P2 (polish) | ~50 |
| **Total** | ~160 items |

Cut items (`CUT-1` through `CUT-5`) account for ~25 of the P0/P1 above.

---

_Document generated from a feature-by-feature audit on 2026-04-29. Re-audit after P0/P1 sweep before flipping to "shippable"._
