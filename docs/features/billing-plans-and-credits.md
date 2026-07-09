# Billing, Plans, Quota & Credits — Source of Truth

> How money, entitlements, and rate limits map onto the product. **Status (2026-06-26): accurate to code on `main`.**
> One sentence: deterministic Tier-0 checks are free, the live LLM writing assistant is an **unmetered subscription entitlement**, in-app generation spends a **daily quota slot**, and the API/MCP surface spends **monthly credits** — four distinct mechanisms, not one wallet.

---

## 1. The money mechanisms

There are **four** independent gating mechanisms. They use different currencies and never cross-charge.

| # | Mechanism | Currency | Primitive | Where it applies | Metered? |
|---|-----------|----------|-----------|------------------|----------|
| 0 | **Tier-0 deterministic checks** | none | client-side / no gate | Writing-assistant algorithm flags (char count, link penalty, etc.), computed in the browser | Free, always |
| 1 | **Live LLM writing assistant (L2 + L3)** | subscription entitlement | `requireFeature("writingAssistant")` | `/api/assistant/score` (L2 embeddings), `/api/live-read` (L3 LLM), `/api/assistant/vectors/refresh` | **No — unmetered** |
| 2 | **In-app AI generation** | daily quota slots | `requireAiGeneration` → `ai_usage_log` | Draft/reply/voice generation in the web app | Yes — daily, per-plan slot count |
| 3 | **API / MCP surface** | monthly credits (+ packs) | `requireCredits`/`debitCredits` → `credit_ledger` | `/api/v1/*` (public API + MCP) | Yes — monthly credit balance |

Key separation: a user typing in the editor never burns a generation slot or a credit (mechanisms 0 and 1 only). The same logical action (e.g. "voice check") costs a **daily slot** in-app (`requireAiGeneration`, `src/app/api/voice/check/route.ts:29`) but **credits** through the API (`src/app/api/v1/voice/check/route.ts`). In-app UI usage is never credit-metered; only the v1/MCP surface is.

Retail anchor: **1 credit = $0.01** (`src/lib/billing/credits.ts:7`). Business economics (COGS floors, margins) live in `docs/business/cogs.md` and `docs/business/cost-analysis.md` — not duplicated here.

---

## 2. Plans & limits

Source: `src/types/subscription.ts:31` (`PLANS`). Four plans; `agent` and `agency` are hidden until their Stripe price-id env var is set (`isPlanAvailable`, `src/types/subscription.ts:144`).

| Limit | free | pro | agent | agency |
|-------|------|-----|-------|--------|
| Price / mo | $0 | $29 | $79 | $199 |
| `stripePriceId` | `null` | `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID` | `NEXT_PUBLIC_STRIPE_AGENT_PRICE_ID` | `NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID` |
| `aiGenerationsPerDay` | 5 | ∞ | ∞ | ∞ |
| `writingAssistant` | **true** | true | true | true |
| `xApiSync` | false | true | true | true |
| `scheduling` | false | true | true | true |
| `patternExtraction` | false | true | true | true |
| `insightsChat` | false | true | true | true |
| `multiAccount` | false | false | false | **true** |
| `monthlyCredits` | 100 | 2000 | 7500 | 7500 |
| `apiRateLimit` (req/min/key) | 20 | 60 | 120 | 120 |
| `apiPublishPerDay` | 5 | 200 | 600 | 600 |
| `apiGeneratePerDay` | 20 | 1000 | 3000 | 3000 |

Notes:
- `aiGenerationsPerDay: Infinity` on all paid plans → `checkAiGenerationLimit` short-circuits to "allowed, unlimited" and never queries `ai_usage_log` (`src/lib/stripe/subscription.ts:65`).
- `writingAssistant` is `true` on **every** plan including free — see §4.
- `monthlyCredits` only matters for the v1/MCP surface (§6). Free gets 100/mo as a trial-grade allowance.
- Plan struct (`PlanConfig`) also carries a human-readable `features: string[]` array used by the pricing UI (§7).

---

## 3. Gating primitives — when each is used

All in `src/lib/stripe/gate.ts` and `src/lib/billing/credits.ts`. Each returns either `null`/success or a ready-made `NextResponse` error you early-return.

| Primitive | File | What it does | Side effect | Error |
|-----------|------|--------------|-------------|-------|
| `requireFeature(userId, feature)` | `gate.ts:10` | Plan-entitlement check on `effectivePlan.limits[feature]` | **None** (no metering) | `403 PLAN_LIMIT` |
| `requireAiGeneration(userId, endpoint, weight=1)` | `gate.ts:42` | Checks daily slot balance, then **consumes `weight` slots** | Inserts `weight` rows into `ai_usage_log` | `429 AI_LIMIT` |
| `logAiGeneration(userId, endpoint, weight)` | `subscription.ts:93` | Raw slot-consumption write (called by `requireAiGeneration`) | Inserts rows into `ai_usage_log` | — |
| `requireCredits(userId, amount, action, ref?)` | `credits.ts:248` | Atomically debits credits (allowance → packs) | Inserts `credit_ledger` debit, decrements `user_credits` | `402 INSUFFICIENT_CREDITS` |
| `debitCredits` / `refundCredits` / `grantPackCredits` | `credits.ts:117,144,164` | Lower-level ledger ops (RPC) | `credit_ledger` + `user_credits` | — |
| `checkDailyActionCap(userId, "publish"\|"generate")` | `credits.ts:213` | Abuse backstop counted from today's ledger debits | None (read) | caller returns `429 daily_cap` |

Decision rule:
- **Entitlement, no per-use cost** (assistant scoring, X sync, scheduling, pattern extraction, insights chat, multi-account) → `requireFeature`.
- **In-app, costs the user a generation** → `requireAiGeneration` (default weight 1; Agent pipeline weight 3).
- **API/MCP request** → `requireCredits` (+ optional `requireFeature` for plan-gated capability + `checkDailyActionCap`).

`requireFeature` and `requireAiGeneration` can stack: e.g. `/api/insights-chat` requires the `insightsChat` entitlement AND spends a generation slot (`src/app/api/insights-chat/route.ts:40,43`); `/api/insights/tuneup` requires `patternExtraction` AND a slot (`route.ts:33,47`).

---

## 4. The writing-assistant entitlement (unmetered)

The "Grammarly for tweets" live editor is layered:
- **Tier 0** — deterministic algorithm flags, computed client-side. No gate, no cost.
- **L2** — `/api/assistant/score` (`src/app/api/assistant/score/route.ts`): one small embedding cosined against cached voice/winner centroids → live 0-100 Voice Match + Performance. Fires on **every typing pause**.
- **L3** — `/api/live-read` (`src/app/api/live-read/route.ts`): on-demand LLM read (anchored drift findings, rewrites). Rare (panel-open / low-score-idle / explicit "why?"), never per-pause.

Both L2 and L3 are gated **only** by `requireFeature(userId, "writingAssistant")` — `score/route.ts:29`, `live-read/route.ts:32`, and the centroid refresher `vectors/refresh/route.ts:24`. They are **NOT** gated by `requireAiGeneration` and **NOT** by credits.

Why unmetered (locked decision, documented inline at `live-read/route.ts:20-24`): the live writing loop can't have a credit meter ticking on every pause, and consuming a generation slot here would `429` a user mid-sentence and steal the slot they need for an actual generation. L3 is read-cached server-side by `draft_hash` and client-cached by text to bound LLM cost.

### Current state: free gets it; the lever exists but is NOT pulled

`writingAssistant: true` for **free** (`src/types/subscription.ts:49`) — so today every plan, including free, gets the full live LLM assistant for free and unmetered. This is the table-stakes posture.

The lever to make it a paid feature is a **one-line flip**: set `free.writingAssistant = false` in `src/types/subscription.ts:49`. Because the routes already call `requireFeature("writingAssistant")`, flipping the flag immediately downgrades free users to **L0-only** (deterministic flags), returning `403 PLAN_LIMIT` from `/api/assistant/score`, `/api/live-read`, and `/api/assistant/vectors/refresh`. No route changes required. The inline comment at `subscription.ts:15-19` records this intent.

---

## 5. Generation quota (daily slots)

In-app AI generation keeps a **daily slot** model (mechanism 2). `requireAiGeneration(userId, endpoint, weight)` (`gate.ts:42`):
1. `checkAiGenerationLimit` (`subscription.ts:56`) counts rows in `ai_usage_log` for `user_id` since `00:00:00Z` today and compares to `effectivePlan.limits.aiGenerationsPerDay` (free = 5; paid = ∞ → instant allow).
2. If `remaining < weight` → `429 AI_LIMIT` with `{ remaining, limit, upgrade_url }`.
3. Otherwise `logAiGeneration` inserts `weight` rows (one insert, `weight` rows) so heavier actions consume more of the quota.

Weights observed in code: default **1**; the agentic draft pipeline is **3** (`src/app/api/drafts/generate-agentic/route.ts:42`). Quota is **time-based daily**, reset implicitly by the `created_at >= today` window — there is no cron for generation slots.

Routes using `requireAiGeneration` (in-app generation surface): `drafts/generate-agentic` (w=3), `drafts/refine`, `drafts/generate-from-topic`, `generate-reply`, `prepublish-read`, `niche/analyze`, `insights/tuneup`, `insights-chat`, `voice/chat`, `voice/preview`, `voice/check`, `inspiration` (create + reanalyze), `captured/[id]/promote`. (Grep `requireAiGeneration` across `src`.)

A separate per-route LLM rate guard (`src/lib/api/with-llm-guard.ts`) runs **alongside** the quota — it is a burst limiter, not a billing mechanism.

---

## 6. API / MCP credits

The public v1 API and MCP surface (mechanism 3) is metered in **monthly credits**. Source of truth for costs: `src/lib/billing/credits.ts`.

### Credit costs (`CREDIT_COSTS`, `credits.ts:11`)

| Action | Credits |
|--------|---------|
| `drafts.generate` | 3 |
| `voice.check` | 3 |
| `insights.tuneup` | 5 |
| `publish.tweet` | 3 |
| `publish.tweet_with_url` | **30** |
| `tweets.read` | 1 |
| `search.per_post` | 1 |
| `analytics.read` | 1 |
| `analytics.sync` | 15 |
| `inspiration.create` | 3 |

### Link surcharge

`publish.tweet_with_url` is **10×** `publish.tweet` because X bills $0.20 for a URL-containing post vs $0.015 for a plain one (`credits.ts:8-10`). `containsUrl(text)` (`credits.ts:64`) decides the rate: it matches `http(s)://` plus bare domains whose TLD is in a curated `LINKED_TLDS` allowlist (`credits.ts:46`), while excluding `@mentions`, emails, and `$cashtags`. `publishCreditCost(texts)` (`credits.ts:81`) sums per-tweet costs so a thread = sum of its tweets.

### Buckets, ledger, packs

- **Two buckets** per user in `user_credits`: `balance` (monthly allowance) and `pack_balance` (purchased packs). `getCredits` (`credits.ts:182`) returns `total = balance + pack_balance`.
- **Debit order**: allowance first, then packs (`debit_credits` RPC via `debitCredits`, `credits.ts:117`).
- **Refunds** (`refundCredits`, `credits.ts:144`) always go to the **allowance** bucket, never packs — refunding into packs would let schedule+cancel launder expiring monthly credits into non-expiring pack credits.
- **Credit packs** (`CREDIT_PACKS`, `src/types/subscription.ts:153`): `credits_500` ($6), `credits_2000` ($20), `credits_10000` ($80), each gated by a `STRIPE_PRICE_CREDITS_*` env var. Purchased as one-time Stripe `mode=payment` checkout, fulfilled by webhook → `grantPackCredits` (`credits.ts:164`).
- **Ledger**: every debit/grant writes `credit_ledger` (action string, signed `delta`, optional reference). Negative-delta rows drive `checkDailyActionCap`.
- **Daily action caps** (`checkDailyActionCap`, `credits.ts:213`): abuse backstop on top of credits — per-plan `apiPublishPerDay` / `apiGeneratePerDay`, counted from today's ledger debits (refunds use distinct `refund.*` actions so they don't offset).
- **Response headers**: metered v1 responses carry `X-Credits-Charged` / `X-Credits-Remaining` (`withCreditHeaders`, `credits.ts:268`).

### Reference flow — `/api/v1/publish/now` (`src/app/api/v1/publish/now/route.ts`)

1. `checkDailyActionCap(userId, "publish")` → `429 daily_cap` if over (line 54).
2. Choose action by `containsUrl` (line 78), `requireCredits(...publishCreditCost...)` → `402` if short (line 79).
3. Call X. On failure, `refundCredits(charged, "refund.publish_failed")` (line 102); on partial thread, refund the un-posted remainder (line 190).
4. `withCreditHeaders(apiSuccess(...))` (line 144).

`ensureCredits` (`credits.ts:102`) is called on every metered request — it lazily creates the `user_credits` row and applies any due monthly reset via the `ensure_user_credits` RPC, so first use and lapsed resets self-heal.

API-side capability gates still use `requireFeature` (no metering): e.g. `xApiSync` for search/sync, `scheduling` for schedule, `patternExtraction` for tuneup (`src/app/api/v1/*`). Credits are charged **in addition**.

---

## 7. Stripe integration

`subscriptions` table holds the canonical per-user plan state (`UserSubscription`, `src/types/subscription.ts:176`): `plan_id`, `stripe_customer_id`, `stripe_subscription_id`, `status`, `current_period_end`, `cancel_at_period_end`.

- **Checkout** (`src/app/api/stripe/checkout/route.ts`): authed POST with `{ planId }` or `{ packId }`. Reuses/creates a Stripe customer (de-dupes by email), persists `stripe_customer_id` eagerly, then creates a `mode=subscription` (plan) or `mode=payment` (pack) Checkout Session. Stripe Tax enabled (`automatic_tax`, `tax_id_collection`, billing address). User id + plan/pack carried in `metadata` and `subscription_data.metadata`.
- **Portal** (`src/app/api/stripe/portal/route.ts`): authed POST → Stripe Billing Portal session for the stored customer; `400` if no billing account.
- **Subscription read** (`src/app/api/stripe/subscription/route.ts`): authed GET returning `effectivePlan` (free if `!isSubscriptionActive`), limits, and today's generation usage for the dashboard.
- **Webhook** (`src/app/api/stripe/webhook/route.ts`): signature-verified (`STRIPE_WEBHOOK_SECRET`). Handles `checkout.session.completed` (subscription upsert or pack grant), `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`.

### Effective-plan / grace logic

`isSubscriptionActive` (`subscription.ts:190`): `active`/`trialing` → active; `past_due`/`canceled` stay active **until `current_period_end`** (grace through paid period). `requireFeature`, `checkAiGenerationLimit`, `effectivePlan`, and the subscription read all funnel through this — a lapsed sub silently falls back to `PLANS.free`.

### Idempotency & ordering

- **Idempotency**: webhook claims `event.id` into `stripe_events` (`event_type`) *before* processing; duplicate insert (`23505`) → `{ duplicate: true }` no-op. On handler throw, the claim is **deleted** and a `500` is returned so Stripe retries (`webhook/route.ts:91,282`).
- **Out-of-order protection**: `upsertSubscription` (`subscription.ts:117`) accepts `eventCreated` (Stripe `event.created`) and does a guarded update — only applies if the stored `stripe_event_created` is null or `<=` the incoming event, so a delayed older event can't clobber newer state. Handlers that re-fetch from the Stripe API omit it (their data is current).
- **Plan resolution**: `resolvePlanId` (`webhook/route.ts:41`) maps `price.id` → plan via `getPlanByPriceId`; an unknown price **never silently grants pro** — it logs to Sentry and keeps the stored plan.
- **Cancellation**: voluntary cancels keep the plan through `current_period_end`; involuntary (`payment_failed`/`payment_disputed`) revoke to free at event time (`webhook/route.ts:192`).
- **Rate-limit sync**: every `upsertSubscription` calls `syncApiKeyRateLimits` (`subscription.ts:193`) to push `apiRateLimit` onto the user's live `api_keys` rows (best-effort).

---

## 8. Credit reset / cron

- **Generation slots**: no cron — the daily window is implicit (`created_at >= today` in `checkAiGenerationLimit`).
- **Monthly credits**: `GET /api/cron/credits-reset` (`src/app/api/cron/credits-reset/route.ts`), Bearer-authed with `CRON_SECRET`, calls `resetDueAllowances()` → `reset_due_allowances` RPC (`credits.ts:201`). Single idempotent SQL statement: a re-run after success is a no-op since nothing is due until next month. Returns `{ reset: <count> }`.
- Lazy fallback: `ensureCredits` also applies a due reset on any metered request, so a missed cron self-heals on next use.

---

## 9. Key files & tables

| File | Role |
|------|------|
| `src/types/subscription.ts` | `PLANS`, limits, `CREDIT_PACKS`, `isPlanAvailable`, `isSubscriptionActive`, price-id env gating |
| `src/lib/stripe/gate.ts` | `requireFeature` (entitlement), `requireAiGeneration` (slot) |
| `src/lib/stripe/subscription.ts` | `getUserSubscription`, `checkAiGenerationLimit`, `logAiGeneration`, `upsertSubscription`, `syncApiKeyRateLimits` |
| `src/lib/billing/credits.ts` | `CREDIT_COSTS`, `containsUrl`/`publishCreditCost`, `requireCredits`/`debitCredits`/`refundCredits`/`grantPackCredits`, `getCredits`, `checkDailyActionCap`, `resetDueAllowances`, header helpers |
| `src/app/api/stripe/{checkout,portal,subscription,webhook}/route.ts` | Stripe surface |
| `src/app/api/settings/credits/route.ts` | Dashboard credits balance + purchasable packs |
| `src/app/api/cron/credits-reset/route.ts` | Monthly allowance reset cron |
| `src/app/pricing/page.tsx` | Pricing UI (renders `PLANS` filtered by `isPlanAvailable`) |
| `src/app/api/{assistant/score,live-read,assistant/vectors/refresh}/route.ts` | Unmetered writing-assistant entitlement |

| Table | Purpose |
|-------|---------|
| `subscriptions` | Canonical per-user plan/billing state |
| `stripe_events` | Webhook idempotency claims (`id`, `event_type`) |
| `ai_usage_log` | Generation slot consumption (one row per slot) |
| `user_credits` | Per-user `balance` (allowance) + `pack_balance` + reset timestamp |
| `credit_ledger` | Append-only debit/grant log (drives daily caps) |
| `api_keys` | Per-key `rate_limit`, synced from plan |

RPCs (Postgres): `ensure_user_credits`, `debit_credits`, `grant_credits`, `reset_due_allowances`.

---

## 10. Current state, open decisions & gaps

- **Free gets the full live assistant, unmetered.** `free.writingAssistant = true` (`subscription.ts:49`). The lever to gate free to L0-only is a one-line flip; routes already enforce it. **Not pulled.** (§4)
- **`agent` and `agency` tiers are hidden** until their `NEXT_PUBLIC_STRIPE_*_PRICE_ID` env vars are set (`isPlanAvailable`). Pricing UI and checkout both filter on this.
- **`resolvePlanId` accepts only `free`/`pro`/`agent` from metadata fallback** (`webhook/route.ts:50`) — `agency` is not in that metadata allowlist. Agency resolves correctly via `getPlanByPriceId` (its price id), but a metadata-only fallback (e.g. portal/dashboard-created sub) would miss it. Minor gap.
- **Generation quota is global per user, not per-endpoint.** All `requireAiGeneration` calls share the same daily `ai_usage_log` pool; weights differentiate cost, not category.
- **No proration/credit on mid-cycle upgrade for generation slots** — slots are purely daily; credits reset monthly via cron.
- **Credit costs are duplicated** between `src/lib/billing/credits.ts` and `docs/archive/MCP_PROD_READINESS_PLAN.md §B2` (noted in-code as the source pair to keep in sync).

---

## 11. Related docs

- `docs/api/credits.md` — public-API credits reference (consumer-facing).
- `docs/business/cogs.md`, `docs/business/cost-analysis.md` — unit economics, COGS floors, margins (the "why" behind credit costs and the link surcharge).
- `docs/archive/MCP_PROD_READINESS_PLAN.md` §B2 — original pricing/credit-cost decisions.
- `docs/mcp/*` — MCP surface that consumes the credit mechanism.
- Writing-assistant and generation feature docs: not yet present under `docs/features/`; this doc is the billing-side authority for both until they exist.
