# COGS Index — Cost of Goods Sold

**Purpose:** A granular, call-by-call index of every cost the product incurs, so we can find and kill the outliers. Each LLM call site, X API action, and infra line item is listed with its model, token shape, per-call cost, and source location.

**Last updated:** 2026-06-25 · **Owner:** Riley

> **🏗️ Major update (2026-06-25) — writing-assistant re-architecture (`GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md`).** The always-on loop no longer runs an LLM on every pause. It now runs on **four layers/engines** at different cadences:
> - **L0** deterministic JS (every keystroke) — $0.
> - **L2** embeddings vs cached centroids (on a ~1s pause) — the new always-on scoring loop. ~**$0.0000015/score** (one `text-embedding-3-small` call). Effectively free.
> - **L3** the LLM (`live-read.ts`) — **demoted to rare/on-demand** (panel open / low-score-idle / explicit "why?"), **read-first cached** (`assistant_live_reads`), 0–2 calls per compose session instead of one per pause.
>
> This **structurally removes the old #1 outlier** (the per-pause Sonnet loop that put Pro underwater) independent of any model swap. Pro is now comfortably profitable even on Sonnet. The rankings below are updated accordingly.

**Legend:** ✅ verified from code/docs · ⚠️ estimated (assumption stated) · 🔴 outlier / optimization target

---

## 0. TL;DR — the outliers, ranked

| # | Cost driver | Why it's an outlier | Lever |
|---|---|---|---|
| 🟢 — | ~~**Agentic "deep draft" pipeline**~~ (3 chained Sonnet calls + web search ≈ **$0.105/run**) | **RESOLVED (2026-07):** the pipeline is **retired** — the route, the worker, and the `web_search_20250305` server-tool spend are gone. Generation is one call (~$0.03). | n/a — removed. |
| 🔴 1 | **URL posts** ($0.20 X API each) & **analytics.sync** ($0.10–0.50) | 13× and 5–15× the cost of a normal action. Already surcharged in credits — keep it that way. | Keep the 30-credit URL surcharge; `since_id` deltas on sync. |
| 🔴 2 | **L3 deep check runs on Sonnet 4.6** (`src/lib/analysis/live-read.ts`) | Was 🔴 #1 (per-pause); now **low-volume** (rare/on-demand + read-first cached). Still ~3× Haiku per call, so Haiku is a cheap, uncontroversial win on this now-explanatory-only path. | Route L3 → **Haiku 4.5**. Far lower stakes than before. |
| 🔴 3 | **No prompt-cache verification** on the LLM paths | If the voice context isn't caching, every L3/generation call pays full input price (~+30%) and nobody would notice. | Log `cache_read_input_tokens`. |
| 🟢 — | ~~Live Read per-pause loop on Sonnet~~ | **RESOLVED** by the L0–L3 re-architecture: the per-pause loop is now L2 embeddings (~$0), not the LLM. | n/a — shipped. |

**The one variable that used to decide everything** — non-cached Live Reads per active user per month — **no longer dominates.** The per-pause loop is now embeddings (~$0). The remaining LLM variable is **L3 deep-checks per active user per month** (a much smaller number, bounded by the on-demand/idle triggers). Instrument it before locking pricing (see §7).

---

## 1. Unit cost reference

### 1a. LLM token pricing (✅ verified via `/claude-api` skill, 2026-06)

| Model | Model ID | Input /M | Output /M | Cache read /M | Cache write /M (5m) |
|---|---|---|---|---|---|
| **Sonnet 4.6** | `claude-sonnet-4-6` | $3.00 | $15.00 | ~$0.30 (0.1×) | $3.75 (1.25×) |
| **Haiku 4.5** | `claude-haiku-4-5` | $1.00 | $5.00 | ~$0.10 (0.1×) | $1.25 (1.25×) |

Cost formula: `(input×in_rate + output×out_rate) / 1e6`. Cached input bills at 0.1× on reads, 1.25× on the first write.

**Model config lives in `src/lib/ai/providers/claude.ts:14-19`** — currently **both `fast` and `standard` map to `claude-sonnet-4-6`**. Changing `fast → claude-haiku-4-5` re-prices every "fast" call site below. `CLAUDE_ONLY` toggle: `src/lib/ai/index.ts:22` (default on → all paths forced to Claude; OpenAI/Grok providers wired but unused).

### 1b. X API pay-per-use (✅ `MCP_PROD_READINESS_PLAN.md §B1`, effective Feb 2026)

| Operation | Our cost |
|---|---|
| Post/reply, no URL | $0.015 |
| **Post containing a URL** | **$0.200** 🔴 |
| Read a post (standard) | $0.005 |
| Owned reads (own posts/mentions) | $0.001 |
| User lookup | $0.010 |
| Search (per post returned) | $0.005 |
| Re-read same resource within 24h | free (dedup) |

### 1c. Anthropic server tools (✅ verified)

| Tool | Cost | Where used |
|---|---|---|
| **Web search** (`web_search_20250305`) | ~$0.01 / search ($10/1k) | **No longer used** — the only caller (the agentic research step) was retired in 2026-07 |
| **Embeddings** (`text-embedding-3-small`, OpenAI, 1536-d) | **$0.02 / 1M input tokens** | `src/lib/ai/embeddings.ts` → `vectors.ts` (L2 score + centroid refresh + calibration) ✅ **now wired** |

**Embeddings are a separate provider (OpenAI, not Claude)** — `CLAUDE_ONLY` does not apply; uses `OPENAI_API_KEY`. A tweet-sized draft ≈ 70 tokens, so:
- **L2 score** (one draft embedding): ~70 × $0.02/1e6 ≈ **$0.0000014/call** — effectively free even at thousands/user/mo.
- **Centroid refresh** (`refreshVoiceVectors`): up to ~60 corpus texts × ~70 tok ≈ 4,200 tok ≈ **$0.00008/refresh**. Daily (via `daily-ops`) ≈ **$0.0025/user/mo**.
- **Calibration sample** (one embedding per L3 run): negligible (~$0.0000014 each).

### 1d. Platform / infra (⚠️ list-price estimates — replace with actual invoices)

| Service | Plan/base | Variable | Per active user (amortized) |
|---|---|---|---|
| Vercel | ~$20/mo Pro + Active-CPU/invocations | per request | ~$0.50–3.00 |
| Supabase | ~$25/mo Pro + usage | per row/egress | ~$0.10–0.50 |
| Upstash Redis (rate limiting, `src/lib/api/rate-limit.ts`) | pay-per-request | per API call | ~$0.05–0.20 |
| Upstash QStash (publish scheduling) | pay-per-message | per scheduled publish | ~$0.05 |
| Sentry (`@sentry/nextjs`) | ~flat | per event | negligible |
| **Stripe fees** | — | **2.9% + $0.30 / charge** | **~$1.14 on $29/mo** 🔴 (unavoidable) |

> Infra + Stripe combined ≈ **$2.6/active Pro user**. This is an **LLM-cost business** — optimize models and caching, not hosting.

---

## 2. LLM calls — per-call cost index (the granular table)

Token shapes are ⚠️ estimates (char/4 heuristic); output uses a typical value with the `max_tokens` ceiling noted. Cached column assumes the per-user voice context (~2,500 tokens) is cached and hitting.

| Call site | File:line | Model (tier) | Input tok | Output tok (cap) | **Sonnet $/call** | Sonnet cached | **Haiku $/call** | Haiku cached |
|---|---|---|---|---|---|---|---|---|
| **L3 deep check** (findings/rewrites only) | `analysis/live-read.ts` | Sonnet (fast) | ~3,000 | ~800 (1,100) | **$0.0210** | $0.0143 | **$0.0070** | $0.0048 |
| **Generate from topic** | `api/drafts/generate-from-topic/route.ts:184-202` | Sonnet (fast) | ~3,000 | ~1,400 (2,000) | **$0.0300** | $0.0233 | **$0.0100** | $0.0078 |
| Voice check (agent surface) | `analysis/voice-check.ts:77-87` | Sonnet (fast) | ~2,000 | ~700 (1,000) | $0.0165 | $0.0125 | $0.0055 | $0.0042 |
| Prepublish read (agent surface) | `analysis/prepublish-read.ts:293-303` | Sonnet (fast), temp 0.1 | ~2,000 | ~600 (800) | $0.0150 | $0.0113 | $0.0050 | $0.0038 |
| Refine (single revise) | `api/drafts/refine/route.ts:85` | Sonnet (`DRAFT_MODEL`) | ~3,000 | ~900 (1,200) | ~$0.0225 | — | ~$0.0075 | — |

> The **agentic pipeline rows are gone (2026-07)** — the ~$0.105/run research→draft→iterate chain and its web-search spend were retired with the pipeline. The most expensive generation action is now a single ~$0.03 call.

### 2b. Embedding & cache calls — the new always-on loop (✅ now wired)

| Call site | File | Engine | Tokens | $/call | Cadence |
|---|---|---|---|---|---|
| **L2 score** | `api/assistant/score` → `vectors.scoreDraft` → `embedText` | OpenAI embed | ~70 in | **~$0.0000014** | every ~1s pause (materially-changed draft) |
| **Centroid refresh** | `vectors.refreshVoiceVectors` | OpenAI embed | ~4,200 in | **~$0.00008** | per tune-up / daily-ops / cold-start |
| **Calibration sample** | `vectors.recordCalibrationSample` | OpenAI embed | ~70 in | **~$0.0000014** | once per L3 run |
| **L3 read-first cache hit** | `assistant_live_reads` (Supabase) | DB read | — | ~$0 | identical draft re-check → $0 LLM |

**Reading the table:**
- **The always-on loop is now L2 embeddings, not the LLM.** It fires on every ~1s pause but costs ~$0.0000014/call — even 3,000 scores/user/mo ≈ **$0.004**. The old "Live Read is the volume driver / #1 line item" is no longer true.
- **L3 (the LLM) is now the rare path** — it runs only on panel-open / low-score-idle / explicit "why?", and a **read-first cache** (`assistant_live_reads`) means an identical draft re-check costs $0. Aggregate L3 cost = (deep-checks/mo) × ($/call), where deep-checks/mo is now a small number (tens–low-hundreds, not 1,500).
- **The generation spike is gone** — the ~$0.105 "Research a draft" pipeline was retired (2026-07). A plain generation (~$0.03) is now the ceiling for a single in-app AI action.
- L3 still merges what were two agent-surface calls (voice-check + prepublish-read) into one; the displayed 0–100 scores now come from L2 embeddings, and L3 returns a calibration-only score that tunes the cheap L2 number over time.

---

## 3. Credit-metered actions — retail vs our COGS

Credit map: `src/lib/billing/credits.ts:11-22`. 1 credit = $0.01. "Margin" = (retail − worst-case COGS) / retail.

| Action | Credits | Retail | Our COGS (Sonnet) | Margin | COGS (Haiku) | Margin (Haiku) |
|---|---|---|---|---|---|---|
| `drafts.generate` | 3 | $0.03 | ~$0.024 (gen call) | 20% | ~$0.010 | 67% |
| `voice.check` | 3 | $0.03 | ~$0.017 | 43% | ~$0.006 | 80% |
| `insights.tuneup` | 5 | $0.05 | LLM (re-extract) | — | — | — |
| `publish.tweet` | 3 | $0.03 | $0.015 (X API) | 50% | — | — |
| **`publish.tweet_with_url`** | 30 | $0.30 | $0.200 (X API) | 33% | — | — |
| `tweets.read` | 1 | $0.01 | $0.005 | 50% | — | — |
| `search.per_post` (min 5) | 1 | $0.01 | $0.005 | 50% | — | — |
| `analytics.read` | 1 | $0.01 | ~$0 (DB) | ~100% | — | — |
| **`analytics.sync`** | 15 | $0.15 | $0.10–0.50 🔴 | −233%…+33% | — | — |
| `inspiration.create` | 3 | $0.03 | ~$0.024 | 20% | ~$0.010 | 67% |

**Notes:**
- 🔴 **`analytics.sync` can go negative** if it fetches 100 posts at the standard read rate ($0.50). The mitigation is mandatory: `since_id` deltas so steady-state syncs pull ~10–30 posts (`MCP_PROD_READINESS_PLAN.md §B2`). Verify the implementation honors this.
- The credit map assumes a single **generation** call (~$0.024 on Sonnet) — which is now the only kind. (The old caveat about the metered `drafts.generate` being cheaper than the in-app agentic pipeline is moot: the pipeline is retired.)
- Switching generation calls to Haiku would roughly **double every generation margin** — but test output quality first; generation is the quality-sensitive path where Sonnet may be worth keeping.

---

## 4. Per-user COGS model

⚠️ **Re-architected (2026-06-25).** The same typical Pro writer now generates **~1,500 L2 score calls/mo** (embeddings, ~$0) for the always-on loop, plus a **small number of L3 deep checks** (the LLM, on-demand) — assume **~120 L3 checks/mo** (**unmeasured** — see §7), of which the read-first cache absorbs repeats. Other assumptions unchanged: ~50 generations, ~110 plain publishes, voice context cached, infra ~$1.50/user, Stripe ~$1.14.

| Component | **Pro — Sonnet L3 (current)** | **Pro — Haiku L3 (recommended)** |
|---|---|---|
| L2 always-on loop (1,500 embeds + refreshes) | **~$0.01** | ~$0.01 |
| L3 deep checks (~120 cached) | $1.7 | **$0.6** |
| Generation (seeds + deep drafts) | $5.0 | $5.0 |
| X API (publish/sync/search) | $3.0 | $3.0 |
| Infra (amortized) | $1.5 | $1.5 |
| Stripe fees | $1.1 | $1.1 |
| **Total COGS / mo** | **≈ $12.3** | **≈ $11.2** |
| **Margin on $29** | **🟢 ~58%** | **🟢 ~61%** |

> **The headline:** the re-architecture moved Pro from **−9% (underwater)** to **~58% margin** — *without* the Sonnet→Haiku swap. The old model's $21/mo "live assistant" line collapses to ~$1.7 because the per-pause loop left the LLM. Routing L3 → Haiku now shaves only ~$1 more; it's a nice-to-have, no longer the thing that decides solvency.

| Scenario | Sonnet L3 | Haiku L3 |
|---|---|---|
| **Heavy writer (4,000 L2 scores + ~400 L3 checks)** | L2 ~$0.02 + L3 ~$5.7 ≈ **$9 assistant** (was ≈ $63) | L2 ~$0.02 + L3 ~$1.9 ≈ **$3 assistant** |
| **Free user** (L0+L2 free + a few manual deep checks/day) | embeds ~$0 + a few L3/day + ~$0.30 infra ≈ **$0.4–1.2** | ≈ **$0.3–0.7** |

**The heavy-writer catastrophe is gone** — 4,000 "reads" are now embeddings (~$0.02), and L3 is gated by the idle/low-score/explicit triggers + read-first cache, so even a power user's LLM cost is bounded by *how often they ask for explanations*, not by how much they type. A fair-use cap on L3 (not L2) is the only tail-risk lever still worth having.

**Free-tier cost** is now bounded by L3 deep-check frequency alone — L0 + L2 are ~$0 COGS, so free users can have the full live Voice Match / Performance experience essentially for free, with L3 explanations as the gated upsell.

---

## 5. Where each cost is incurred (source map for optimization)

```
LLM (Anthropic) ── src/lib/ai/providers/claude.ts:14-19   ← model tier → ID mapping (CHANGE HERE)
  ├─ live-read (L3)    src/lib/analysis/live-read.ts          ← fast tier = Sonnet; now rare/on-demand + read-first cached
  ├─ generate-topic    src/app/api/drafts/generate-from-topic/route.ts:184
  ├─ voice-check       src/lib/analysis/voice-check.ts:77
  ├─ prepublish-read   src/lib/analysis/prepublish-read.ts:293
  └─ refine            src/app/api/drafts/refine/route.ts:85 (DRAFT_MODEL → src/lib/ai/draft-text.ts:11)

Embeddings (OpenAI) ─ src/lib/ai/embeddings.ts                ← text-embedding-3-small, $0.02/1M tok
  └─ L2 vectors        src/lib/analysis/assistant/vectors.ts  ← scoreDraft / refreshVoiceVectors / recordCalibrationSample
       ├─ score route   src/app/api/assistant/score/route.ts        ← the per-pause call (unmetered)
       ├─ refresh route src/app/api/assistant/vectors/refresh/route.ts
       └─ refresh cron  src/app/api/cron/daily-ops/route.ts + cron/assistant-vectors/route.ts

Assistant gating ──── src/lib/stripe/gate.ts requireFeature("writingAssistant")  ← subscription entitlement, NOT metered
  └─ plan limit        src/types/subscription.ts PLANS.*.limits.writingAssistant

X API ──────────────── src/lib/x-api/client.ts               ← publish/read/search billing
  └─ URL detection     src/lib/billing/credits.ts:64-78       ← 30-credit surcharge gate

Metering ───────────── src/lib/billing/credits.ts:11-22       ← CREDIT_COSTS map (assistant is NOT here — entitlement-gated)
  └─ cost alerts       src/app/api/cron/usage-rollup/route.ts:10-11  ← $25/day, $5/user/day

Infra ──────────────── Vercel (hosting) · Supabase (DB) · Upstash (Redis+QStash) · Sentry · Stripe
```

> **Metering correction:** the assistant routes (`/api/assistant/score`, `/api/live-read`) are now gated by `requireFeature` (a plan check, no quota write), not `requireAiGeneration`. The old code consumed a daily AI-generation slot on every Live Read — that's fixed, so the live loop no longer eats into (or is blocked by) a user's generation quota.

---

## 6. Optimization backlog (prioritized)

| Priority | Action | Est. impact | Effort |
|---|---|---|---|
| ✅ done | ~~Move the per-pause loop off the LLM~~ → **L2 embeddings** (`vectors.ts`, `/api/assistant/score`) | **Pro −9% → ~58%** (the big one) | shipped 2026-06-25 |
| ✅ done | ~~Stop metering the live loop against AI-gen quota~~ → `requireFeature` | no quota burn / mid-sentence 429s | shipped 2026-06-25 |
| **P1** | Bound `max_uses` on pipeline web search; cache research results by topic | −$0.02–0.04 per deep draft | low |
| **P1** | Confirm `analytics.sync` uses `since_id` deltas (not full 100-post pulls) | sync $0.50→$0.10 | verify |
| **P1** | Confirm agent surface can't trigger the $0.105 pipeline for 3 credits | prevents negative-margin action | verify |
| **P2** | Route L3 deep check `fast` tier → **Haiku 4.5** (`claude.ts:14-19`) | ~$1/user/mo; low stakes now L3 is rare | 1-line + quality check |
| **P2** | Verify L3 + generation prompt-cache hits (`cache_read_input_tokens > 0`); audit assembler for `Date.now()`/unsorted-JSON invalidators | up to −30% on those calls | low |
| **P2** | Fair-use cap on **L3 deep checks** (not L2) if the deep-check tail runs hot | bounds power-user LLM tail | low |
| **P2** | Verify embeddings prompt path is cheap as modeled (batch refresh, no per-text round-trips) | confirms the ~$0 L2 assumption | low |
| **P2** | Test generation calls on Haiku (quality-gated) | ~2× generation margin | A/B |
| **P2** | Replace estimated infra figures with actual Vercel/Supabase/Upstash invoices | accuracy | data pull |

---

## 7. Instrumentation gaps (what we can't see yet)

To turn this index from estimated → measured, log:

1. **L3 deep-checks per active user per month** — the new (much smaller) LLM variable in §4, and the **read-first cache hit-rate** (`assistant_live_reads`). What used to be 1,500 per-pause reads is now this.
2. **L3 actuals** — per call: `usage.input_tokens`, `output_tokens`, **`cache_read_input_tokens`**, model.
3. **L2 embedding volume** — score calls + centroid refreshes per user/mo. Expected ~$0, but confirm the token counts and that refresh isn't firing more often than daily.
4. **Pipeline run frequency** — how often "Research a draft" fires per user (the now-#1 $0.105 spike).
5. **Web search count** per pipeline run (vs the assumed 2–4).
6. **Real infra invoices** — replace §1d list prices with actuals, divided by MAU. (Supabase now also stores `user_assistant_vectors` jsonb centroids — small, but a new row/egress line.)

The `usage-rollup` cron (`src/app/api/cron/usage-rollup/route.ts`) already estimates daily X API + LLM COGS from the credit ledger and alerts at **$25/day platform-wide** / **$5/day per user** — extend it to capture the LLM token/cache fields above.

---

## 8. Methodology & assumptions

- LLM prices: `/claude-api` skill, cached 2026-06 (Sonnet $3/$15, Haiku $1/$5 per MTok; cache read 0.1×, write 1.25×).
- Embedding price: OpenAI `text-embedding-3-small` $0.02/1M input tokens (2026-06). Draft ≈ 70 tok via char/4 heuristic.
- L2/L3 split & cadence: `GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md` (re-architecture, 2026-06-25). L2 fires on a ~1s pause; L3 only on panel-open / low-score-idle≥6s / explicit deep-check, read-first cached.
- X API prices: `MCP_PROD_READINESS_PLAN.md §B1` (official docs.x.com, Feb 2026).
- Token counts: char/4 heuristic on assembled prompts (voice examples budget 1,500 tok, inspiration 500 tok, patterns ~150 tok, base ~400-500 tok). **Re-baseline with `count_tokens` for precision.**
- Output tokens: "typical" estimate; `max_tokens` ceiling shown in parentheses (actual cost cannot exceed the ceiling case).
- Caching: assumes ~2,500-token per-user voice context cached and hitting. **Unverified in production.**
- Per-user usage profiles (§4): estimates pending instrumentation (§7).
- Infra/Stripe (§1d): list-price estimates pending actual invoices.

**Every figure marked ⚠️ is a placeholder for a measured value. Treat margins as directional until §7 lands.**
