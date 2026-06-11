# MCP Production Readiness Plan — Agents For X

> **This document is a goal-mode prompt.** Feed it to `claude` with goal mode. All research,
> pricing math, and architectural decisions are already locked in below — do not re-research
> or re-litigate them. Execute the workstreams, flip checkboxes as acceptance criteria are
> verified, and stop when the Completion Condition is met.

---

## GOAL

Make the Agents For X MCP server (`mcp/`) and its backing v1 API production-ready: full tool
coverage of every user-facing capability in the app, hardened reliability (retries, rate-limit
handling, tests), npm-publishable packaging, and a credit-based metering/billing system wired
into Stripe that makes the economics in §B profitable at the locked prices.

## COMPLETION CONDITION

The goal is complete when ALL of the following are true (each is machine-verifiable):

1. Every checkbox in workstreams W1–W8 is checked, with the listed verification command(s)
   passing for each.
2. `npm run build` succeeds in both repo root and `mcp/`.
3. `npm test` (or `npx vitest run`) passes in `mcp/` with ≥ 1 test file per source file
   (`client`, `tools`), and v1 metering tests pass in the root project.
4. `cd mcp && npm pack --dry-run` succeeds and the tarball contains `dist/`, `README.md`,
   `LICENSE`, and nothing else unexpected; `package.json` has `"version": "1.0.0"`, a real
   SPDX license, `repository`, `keywords`, and `prepublishOnly: "npm run build"`.
5. `GET /api/v1/openapi.json` reflects every new/changed endpoint (verified by grepping the
   spec for each new path).
6. The Human-Required Checklist (§D) is the ONLY unchecked section remaining, and a final
   summary of those items has been written to `MCP_LAUNCH_HUMAN_TASKS.md`.

Items in §D are explicitly EXCLUDED from the completion condition — do not attempt them.

---

## A. AUDIT — CURRENT STATE (June 2026)

Verified by code audit; treat as ground truth, no need to re-verify before starting.

**What exists and works:**
- `mcp/` — stdio MCP server, 18 tools (`whoami`, `get_voice_settings`, `get_strategy`,
  `generate_post`, `generate_reply`, drafts CRUD ×5, `publish_post/thread/reply`,
  `schedule_post`, `list_queue`, `cancel_scheduled`, `get_analytics`, `get_tweet`), all
  wrapping the v1 REST API via Bearer API key (`CONTENT_API_KEY`). Merged to `main`.
- v1 API (`src/app/api/v1/`): 20 endpoints, `sk_live_` keys SHA-256 hashed in `api_keys`,
  10 scopes, Upstash sliding-window rate limit (60 req/min/key, fail-closed in prod),
  standard `X-RateLimit-*` headers, `/openapi.json`.
- Billing: Stripe subscriptions, Free ($0, 5 AI gens/day) and Pro ($29/mo, unlimited gens,
  scheduling, X sync, patterns, insights). Webhook idempotency via `stripe_events`.
  `ai_usage_log` counts daily generations. Files: `src/lib/stripe/{gate,subscription,client}.ts`,
  `src/types/subscription.ts` (`PLANS`).
- X API: per-user OAuth2 PKCE tokens (app credentials), v2 endpoints: POST /2/tweets,
  GET /2/tweets/:id, GET /2/users/:id/tweets, GET /2/tweets/search/recent, GET /2/users/me.
  Client: `src/lib/x-api/client.ts` (race-safe token refresh).
- LLM: unified `src/lib/ai/` — openai (gpt-4o-mini fast), claude (sonnet-4), grok (grok-3);
  user-selectable per voice type.

**Production gaps (drive the workstreams):**
- MCP client: no retries/backoff, no 429/`X-RateLimit-*` handling, 30s timeout only, no
  structured logging, weak schemas (`z.record(z.any())` for draft content, untyped `status`
  strings, no id min-lengths).
- Missing MCP tools for existing v1 endpoints: health, voice PATCH, strategy PUT,
  GET /publish (history).
- App capabilities with NO v1 endpoint (so no MCP tool possible yet): patterns
  (list/extract/toggle), inspiration (list/add), niche profile, best-times, consistency,
  X search, analytics sync trigger, generation feedback, publish retry.
- Packaging: `"license": "UNLICENSED"` (unpublishable), version 0.1.0, no LICENSE file,
  no prepublishOnly, no CI publish workflow, no tests anywhere in `mcp/`.
- No usage metering beyond the daily-gen counter: nothing maps API/MCP actions to the real
  X API + LLM costs they incur. With Feb-2026 X pay-per-use pricing this is the #1
  economic risk (a URL post costs us $0.20 — "unlimited" is not viable on the agent surface).
- No streamable-HTTP transport (claude.ai web/connector users can't use stdio).

---

## B. ECONOMICS — LOCKED DECISIONS

### B1. Underlying costs (X API pay-per-use, effective Feb 6 2026; official docs.x.com pricing)

| Operation | Our cost |
|---|---|
| Create post/reply (no URL in text) | $0.015 / request |
| Create post containing a URL | **$0.200** / request |
| Read a post (standard) | $0.005 / resource (2M reads/mo cap) |
| Owned reads (own posts/mentions/followers via own app) | $0.001 / resource |
| User lookup | $0.010 / resource |
| Search (priced per post returned) | $0.005 / post |
| Dedup | same resource re-read within a 24h UTC window is free |

LLM cost per generation call (~4K in / ~800 out, 3 options): gpt-4o-mini ≈ $0.001,
claude-sonnet-4 ≈ $0.024, grok-3 ≈ $0.024. Price for worst case ($0.024).

### B2. Credit system

1 credit = $0.01 retail. Credits meter the **agent surface only** (v1 API + MCP). In-app UI
usage keeps today's plan gating (Free 5 gens/day, Pro unlimited) — humans are self-limiting;
agents are not. This avoids repricing existing subscribers.

**Action costs (the canonical `CREDIT_COSTS` map to implement):**

| Action | Credits | Retail | Worst COGS | Floor margin |
|---|---|---|---|---|
| `drafts.generate` (post or reply, up to 3 options) | 3 | $0.03 | $0.024 | 20% |
| `publish.tweet` (per tweet; thread = N tweets) | 3 | $0.03 | $0.015 | 50% |
| `publish.tweet_with_url` (server-detected URL) | 30 | $0.30 | $0.200 | 33% |
| `tweets.read` (get_tweet) | 1 | $0.01 | $0.005 | 50% |
| `search.per_post` (min 5) | 1 | $0.01 | $0.005 | 50% |
| `analytics.read` (from DB, no X call) | 1 | $0.01 | ~$0 | ~100% |
| `analytics.sync` (on-demand X sync, ≤100 posts) | 15 | $0.15 | $0.10–0.50* | see note |
| Reads with no external cost (drafts, queue, voice, strategy, patterns, me) | 0 | — | infra only | — |

*Sync COGS is $0.10 at owned-read rate, $0.50 at standard rate. Implementation MUST use
`since_id` deltas so steady-state syncs fetch ~10–30 new posts, not 100. Scheduled (cron)
syncs remain a Pro plan feature, capped at 1/day, and do not debit credits; on-demand syncs
via API/MCP debit 15.

Scheduled posts debit at **schedule time** (refund on cancel) so an agent can't queue
unlimited posts against a balance it doesn't have. URL detection runs at both schedule and
publish time; if a scheduled post's content is edited to include a URL, re-price.

**Monthly allowances & plans (suggested retail — human signs off in §D):**

| Plan | Price | Included credits/mo | Notes |
|---|---|---|---|
| Free | $0 | 100 | API/MCP enabled (read + light write); no scheduling; publish ≤ 5/day |
| Pro | $29/mo | 2,000 | everything today + agent surface |
| Agent (new, optional) | $79/mo | 7,500 | for heavy MCP/automation users |

**Overage credit packs (one-time Stripe payments, consumed after monthly allowance,
never expire while subscription is active):**

| Pack | Price | $/credit | Worst-case floor (all URL posts) |
|---|---|---|---|
| 500 | $6 | $0.012 | 16 URL posts → $3.33 COGS → 44% margin |
| 2,000 | $20 | $0.010 | 66 URL posts → $13.30 COGS → 33% margin |
| 10,000 | $80 | $0.008 | 333 URL posts → $66.60 COGS → 17% margin |

### B3. Why these numbers hold

- **Typical Pro agent user** (150 gens, 60 plain publishes, 30 tweet reads, daily delta
  sync ≈ 360 sync-equivalent credits): ~1,020 credits — fits the 2,000 allowance. COGS ≈
  $2–8/mo depending on LLM choice → **72–93% gross margin on $29**.
- **Worst-case full burn** of the Pro allowance (2,000 credits ÷ 30 = 66 URL posts ≈ $13.30
  COGS) still leaves **54% margin** — the plan can never go underwater.
- Every pack's $/credit stays above the URL-post COGS floor ($0.20/30 credits ≈ $0.0067),
  so volume discounts can't be arbitraged into losses.
- The 13x URL-post surcharge is the single most important rule: without it, 145 URL posts/mo
  ($29 COGS) erases all Pro margin.

### B4. Rate limits (locked)

| Plan | Sustained | Daily publish cap | Daily generate cap (API/MCP) |
|---|---|---|---|
| Free | 20 req/min/key | 5 | 20 |
| Pro | 60 req/min/key | 200 | 1,000 |
| Agent | 120 req/min/key | 600 | 3,000 |

Per-key `rate_limit` column already exists — set it from plan at key creation and on plan
change. Daily caps are abuse backstops on top of credits, enforced in the metering layer.

---

## C. WORKSTREAMS

Work them in order; W1→W2 are blocking dependencies for W3+. Commit per workstream with
`feat(mcp-prod): W<N> <summary>`. Use the Supabase MCP `apply_migration` for DDL,
`execute_sql` for DML. Run `npm run build` + tests before each commit. Update checkboxes
in this file as you complete tasks.

### W1 — Credit ledger & metering core

- [x] **W1.1** Migration: `credit_ledger` table (`id`, `user_id`, `delta` int — positive
  grant / negative debit, `balance_after` int, `action` text, `reference_id` text nullable
  — draft/queue/tweet id, `pack_id` nullable, `created_at`) + `credit_balances` materialized
  view or a `user_credits` table (`user_id` PK, `balance`, `monthly_allowance`,
  `allowance_resets_at`, `updated_at`) with atomic debit via RPC
  (`debit_credits(user_id, amount, action, reference)` — `SECURITY DEFINER`, row-lock,
  rejects if balance < amount, returns new balance). RLS: users read own rows only.
  *Verify:* migration applied; RPC rejects overdraft in a SQL test via `execute_sql`.
- [x] **W1.2** `src/lib/billing/credits.ts`: `CREDIT_COSTS` map exactly as §B2,
  `debitCredits()`, `grantMonthlyAllowance()`, `getBalance()`, URL detector
  (`containsUrl(text)` — match `https?://` and bare domains the way X's pricing counts
  them: any t.co-shortenable URL). Unit tests for the URL detector edge cases
  (bare domain, @mention, $cashtag, no-TLD strings must not match).
- [x] **W1.3** Allowance reset: extend an existing daily cron (`src/app/api/cron/`) to call
  `grantMonthlyAllowance()` for users whose `allowance_resets_at <= now()` (reset to plan
  allowance, not additive; pack credits tracked separately and untouched).
- [x] **W1.4** Insufficient credits → HTTP 402 `{ error, code: "INSUFFICIENT_CREDITS",
  balance, required, topup_url }`; every metered response includes `X-Credits-Remaining`
  and `X-Credits-Charged` headers.

### W2 — Meter the v1 surface

- [x] **W2.1** Wire debits into: `POST /v1/drafts/generate` (3), `POST /v1/publish/now`
  (3/tweet, 30 if URL), `POST /v1/publish/schedule` (debit at schedule; refund on
  `DELETE /v1/queue/{id}`), `GET /v1/tweets/{id}` (1), `GET /v1/analytics` (1). Debit
  BEFORE the X/LLM call; refund on hard failure of the external call (publish failed,
  generation threw). QStash publish path must NOT double-debit already-scheduled posts.
- [x] **W2.2** Per-plan daily caps + per-plan default `rate_limit` (§B4) enforced in
  `requireApiAuth`/metering layer; key creation and plan-change webhook set `rate_limit`.
- [x] **W2.3** `GET /v1/me` response gains `credits: { balance, monthly_allowance,
  resets_at }` and `plan`. Free-plan keys: scheduling scope rejected as today; publish
  allowed within caps.
- [x] **W2.4** Tests (vitest, root project): debit/refund on publish failure, URL
  surcharge, 402 shape, schedule-then-cancel refund, cron no-double-grant.

### W3 — v1 endpoint parity (new endpoints, all metered/scoped)

New scopes: `patterns:read`, `patterns:write`, `inspiration:read`, `inspiration:write`,
`niche:read`, `search:read` — add to `src/lib/api/scopes.ts` + key-creation UI list.

- [x] **W3.1** `GET /v1/patterns` (list, `extraction_batch`/`is_enabled` aware),
  `PATCH /v1/patterns/{id}` (toggle `is_enabled`). 0 credits.
- [x] **W3.2** `GET /v1/inspiration`, `POST /v1/inspiration` (reuses internal analyze flow;
  3 credits — it triggers an LLM analysis), `DELETE /v1/inspiration/{id}`.
- [x] **W3.3** `GET /v1/niche` (profile read). 0 credits.
- [x] **W3.4** `GET /v1/analytics/best-times` (Pro-gated as internally). 1 credit.
- [x] **W3.5** `GET /v1/search?query=&max_results=` wrapping `GET /2/tweets/search/recent`
  (Pro-gated; 1 credit/result, min 5; `max_results` clamp 10–25 to bound cost).
- [x] **W3.6** `POST /v1/analytics/sync` (on-demand, 15 credits, Pro-gated, reuses
  `since_id` delta logic — implement delta fetch in `src/lib/x-api` if missing).
- [x] **W3.7** `POST /v1/feedback` (generation feedback passthrough). 0 credits.
- [x] **W3.8** Regenerate `/v1/openapi.json` to include everything above + credit costs
  documented per endpoint (`x-credits` extension field).

### W4 — MCP tool parity

- [x] **W4.1** New tools wrapping W3 + existing uncovered endpoints: `health`,
  `update_voice_settings` (PATCH /v1/voice), `update_strategy` (PUT /v1/strategy),
  `list_published` (GET /v1/publish), `list_patterns`, `toggle_pattern`,
  `list_inspiration`, `add_inspiration`, `get_niche`, `get_best_times`, `search_tweets`,
  `sync_analytics`, `send_feedback`, `get_credits` (reads /v1/me, returns balance/plan).
- [x] **W4.2** Every tool description states its credit cost (e.g. "Costs 3 credits.
  Publishing a post containing a URL costs 30."). Publish/schedule tool descriptions keep
  the confirm-with-user warning.
- [x] **W4.3** Schema hardening: replace `z.record(z.any())` with typed content shapes
  (`{ text }` for X_POST, `{ tweets: string[] }` for X_THREAD); `status` params become
  `z.enum`s matching server values; ids get `.min(1)`; `schedule_post` rejects
  empty-array tweets.

### W5 — MCP client reliability

- [x] **W5.1** Retries in `mcp/src/client.ts`: up to 3 attempts on network errors and
  5xx, exponential backoff + jitter; on 429 honor `Retry-After`/`X-RateLimit-Reset`
  (sleep ≤ 30s, else surface a clear "rate limited, retry after Xs" error). NEVER retry
  non-idempotent POSTs (publish, generate) after an ambiguous failure (timeout post-send)
  — surface the ambiguity instead.
- [x] **W5.2** Error mapping: 401 → "API key invalid/revoked — check CONTENT_API_KEY";
  403 → "key lacks scope X"; 402 → "out of credits, balance B, top up at URL"; 404 →
  "not found"; include `X-Credits-Remaining` in tool results where present.
- [x] **W5.3** Structured stderr logging (timestamp, tool, status, latency, request-id)
  behind `MCP_DEBUG=1`; startup pings `/v1/health` and logs key prefix + scopes (never
  the key).
- [x] **W5.4** Tests (vitest in `mcp/`): client retry/backoff/429 paths (mock fetch),
  error mapping, every tool's schema accepts valid / rejects invalid input, run() wraps
  ApiError into isError results.

### W6 — Packaging & distribution

- [x] **W6.1** `mcp/package.json`: version `1.0.0`, `"license": "MIT"`, `LICENSE` file,
  `description`, `repository`, `homepage`, `keywords` (mcp, x, twitter, agents),
  `prepublishOnly: "npm run build"`, `files: ["dist", "README.md", "LICENSE"]`.
- [x] **W6.2** README: per-tool credit costs table, scope reference (which tools need
  which scopes), error-code reference, rate-limit/429 behavior, security note (key
  storage), Claude Desktop + Claude Code + generic MCP-client config examples,
  troubleshooting.
- [x] **W6.3** GitHub Actions workflow `.github/workflows/mcp-publish.yml`: on tag
  `mcp-v*` → install, build, test, `npm publish --access public` using `NPM_TOKEN`
  secret (workflow authored now; secret + first publish are human, §D).
- [x] **W6.4** `npm pack --dry-run` clean (verification for Completion Condition #4).

### W7 — Remote MCP transport (hosted)

- [x] **W7.1** Streamable-HTTP MCP endpoint at `POST /api/v1/mcp` in the Next.js app,
  reusing `registerTools` from a shared build (move `mcp/src/tools.ts` consumption via a
  small shared package or duplicate-import with a sync test). Auth: `Authorization:
  Bearer sk_live_...` (same API keys). Stateless JSON mode (no SSE session) is acceptable
  for v1. Rate-limited and metered identically to REST.
- [x] **W7.2** Document remote usage in README + docs page (`claude mcp add --transport
  http agentsforx https://app.agentsforx.com/api/v1/mcp --header "Authorization: Bearer ..."`).
  OAuth/dynamic-client-registration for the claude.ai connector directory is explicitly
  OUT of scope (human decision, §D).

### W8 — Stripe credit packs & ops

- [x] **W8.1** Script `scripts/stripe-setup-credits.ts` that idempotently creates (test
  mode first) Products/Prices: `credits_500` $6, `credits_2000` $20, `credits_10000` $80,
  and optional `plan_agent` $79/mo — then prints the price IDs for env vars. Run it
  against test mode now if `STRIPE_SECRET_KEY` is a test key; live-mode run is human (§D).
- [x] **W8.2** `POST /api/stripe/checkout` extended for `mode: "payment"` credit packs
  (metadata: `pack_id`, `credits`); webhook `checkout.session.completed` with
  `mode=payment` grants pack credits via ledger (idempotent via `stripe_events`).
- [x] **W8.3** Settings UI: credits balance card (balance, allowance, resets-at, buy-pack
  buttons) on the existing settings/billing page; API keys page shows per-key last-used.
- [x] **W8.4** Spend telemetry: nightly cron job computes yesterday's estimated X COGS
  from `credit_ledger` actions and writes to a `usage_daily` table; alert (console/error
  log → Sentry) if estimated daily COGS > $25 or any single user > $5/day.
- [x] **W8.5** `PLANS` in `src/types/subscription.ts` gains `monthlyCredits` (100 / 2000 /
  7500) and the optional `agent` plan entry (price ID from env, absent = hidden).

### W9 — OAuth 2.1 connector (added 2026-06-11 by user directive; supersedes the W7.2/D5 out-of-scope call)

- [x] **W9.1** OAuth 2.1 authorization server: `oauth_clients/codes/tokens`
  tables (hashed, service-role only), RFC 8414 + RFC 9728 well-known metadata,
  RFC 7591 dynamic client registration (public clients, IP rate-limited),
  consent page at `/oauth/authorize` (server action, scope labels), token
  endpoint with PKCE S256 (timing-safe), single-use codes (CAS), rotating
  refresh tokens (CAS).
- [x] **W9.2** Hosted `/api/v1/mcp` is OAuth-only — API keys rejected there
  (they remain the credential for REST + stdio). 401s carry WWW-Authenticate
  → protected-resource metadata for client auto-discovery. v1 REST accepts
  `mcp_at_` bearers so the proxy keeps scopes/limits/credits enforcement.
- [x] **W9.3** Smoke-tested live: DCR → code exchange → 32 tools via OAuth
  token → REST accepts token → sk_live_ rejected on MCP → code replay
  rejected → refresh rotation kills the old token.

---

## D. HUMAN-REQUIRED CHECKLIST (excluded from completion condition)

Write these (with exact instructions + any IDs/URLs produced by the workstreams) to
`MCP_LAUNCH_HUMAN_TASKS.md` as the final task. Currently:

1. **X Developer Console**: switch/confirm the in-house app on pay-per-use billing, load
   initial credits, set a monthly spend cap (suggest $200 to start) and enable
   auto-recharge alerts. Confirm whether reads of users' own timelines via OAuth user
   context bill at the $0.001 owned-read rate or $0.005 standard — if standard, drop cron
   sync frequency to weekly for Free-tier-connected accounts (economics in §B assume
   owned-rate for synced timelines; the plan is profitable either way, but margins move).
2. **npm**: create/claim the `@agentsforx` org, generate an automation token, add as
   `NPM_TOKEN` GitHub Actions secret, push the `mcp-v1.0.0` tag to trigger first publish.
3. **Stripe live mode**: run `scripts/stripe-setup-credits.ts` with the live key, copy the
   printed price IDs into Vercel env (`STRIPE_PRICE_CREDITS_500/2000/10000`,
   `NEXT_PUBLIC_STRIPE_AGENT_PRICE_ID`), verify webhook endpoint covers the new event
   payloads, and sign off on retail pricing in §B (plans, allowances, pack prices).
4. **Decide**: ship the optional $79 Agent tier at launch or hold it.
5. **Decide**: pursue claude.ai connector directory listing (requires OAuth +
   dynamic client registration — separate project) or stay with API-key remote MCP.
6. **Legal/ToS**: update terms + pricing page for credits, overage packs, and the
   URL-post surcharge disclosure.
7. **Vercel env**: confirm `UPSTASH_*`, new Stripe price IDs, and any new secrets exist in
   production before promoting.

## E. OUT OF SCOPE

- Chrome extension, voice-memo pipeline, Instagram (deprecated/dead code — do not touch).
- OAuth for MCP (see D5). Multi-platform posting. Enterprise X API tier.
- Repricing the in-app (non-API) experience — Free 5 gens/day / Pro unlimited stays.

---

*Audit + economics compiled 2026-06-10 from code audit of `main` (29659dc9) and X API
pay-per-use pricing (docs.x.com, effective 2026-02-06). Sources: official X pricing docs;
verification via devcommunity.x.com pay-per-use pilot announcement.*
