# Reply Radar — Scope: the Reply-Sourcing Enhancement

> **Status:** Proposed (research-validated, not yet started)
> **Date:** 2026-07-08 · **Owner:** Riley
> **Evidence base:** `research/market-scan/2026-07-reddit-signal.md` (theme 5 — the strongest validated demand in the pull), `research/market-scan/2026-07-direct-competitor-scan.md`, `COGS.md`, code inventory of the current reply surface (§2).
> **One-liner:** Stop making the user hunt for reply opportunities. Deliver a small, ranked, perishable queue of "reply here, now, and here's why" — sourced by pooled niche sweeps + account watchlists + user-defined trackers — feeding into the coached composer we already have. We automate the *watching*; the user keeps the pen.

---

## 1. Why — the validated pain (from the July 2026 Reddit signal pull)

Reply-driven growth was the **only theme where a user specced our product unprompted**. The pain decomposes into four distinct problems:

| # | Facet | Evidence (verbatim, permalinked in the signal doc) |
|---|---|---|
| 1 | **The vigil** — finding targets is unbounded ambient surveillance, not a task | "I hate using Twitter and have trouble bringing myself to spending hours just refreshing waiting for good enough posts to reply to… Is my best option to build out a Python tool that pulls in tweets from my designated follow list, passes it to GPT with the pre-prompted conditions I want to reply to, then choose to reply to just that GPT-curated list?" — [r/SaaS, 2025-03-01](https://reddit.com/r/SaaS/comments/1j17glk/how_can_you_outsourceautomate_the_reply_guy/) |
| 2 | **The perishable window** — opportunities decay in minutes-to-hours; X's native alerting is broken | "by the time I saw it, it was too late. No one was paying attention anymore… I tried setting up twitter alerts, but elon has apparently decided to give up on that feature" (built rss.app + LLM + Slack instead) — [r/microsaas, 2025-05-16](https://reddit.com/r/microsaas/comments/1knppe2/how_a_weekend_hack_turned_into_1000_users_and_now/) |
| 3 | **Targeting quality is the variable** — undirected engagement fails; the working playbook targets specific account bands | "concentrate on crafting thoughtful replies to tweets from larger accounts in your niche, particularly those with 50k to 100k followers" — [r/SaaS_Email_Marketing, 2024-09-22](https://reddit.com/r/SaaS_Email_Marketing/comments/1fmqrfu/3_tips_to_reach_your_first_1k_followers_on_twitter/); counter-case: months of undirected liking/replying → ~100 views — [r/socialmedia, 2025-01-05](https://reddit.com/r/socialmedia/comments/1htz5a4/why_is_xs_algorithm_ignoring_my_efforts/) |
| 4 | **Workflow poverty** — post tools have dashboards; replies have TweetDeck and bookmarks | "Tools like buffer, Typefully supports posts creation and UI for that, anything for replies?" — [r/SocialMediaMarketing, 2025-05-14](https://reddit.com/r/SocialMediaMarketing/comments/1kmj8ex/twitter_reply_scheduler/); "Leave 30 Comments (under big accounts) — Use TweetDeck or bookmarks" — [r/thesidehustle, 2025-04-09](https://reddit.com/r/thesidehustle/comments/1jv687x/1_year_of_growing_a_twitterx_account_here_is_what/) |

**Why us, why now:** every commercial answer (Choosy AI, Imagine AI $25/mo, Hypefury auto-reply, Tweet Hunter $200+) automates the *writing* — the part users didn't ask to lose and the part X now punishes: our own algorithm mapping (`src/lib/analysis/x-algorithm.ts`) encodes that replies are **LLM-judged with an extra spam screen on low-follower accounts** ("generic AI replies are exactly what it's built to catch"), that a reply ≈ **27× a like**, and that a reply the author engages with is the **single biggest positive signal (~150× a like)**. The curation+coaching lane — automate the finding and timing, human writes — is empty, matches the validated ask verbatim, and is account-safe *and* algorithm-favored by construction.

**Marketing line this unlocks (receipts in the open-source ranker):** "X ranks replies with an LLM judge built to catch generic AI replies. Tools that auto-write your replies feed that judge exactly what it's trained to bury. We find the moment; you keep the pen."

---

## 2. Current state — what exists and what's missing

Full inventory as of 2026-07-08:

**Exists (keep and build on):**
- `findReplyTargets(userId, opts)` — `src/lib/x-api/reply-targets.ts` — on-demand wrapper over X recent-search (`searchRecentTweets`, `src/lib/x-api/client.ts:393`). Repliability filter (`reply_settings` allow-list, fail-closed) in `src/lib/x-api/search-mapping.ts:37-119`; optional `tractionScore` ranking (`weightedEngagement ÷ ageHours`, `search-mapping.ts:126-147`). Exposed via `GET /api/v1/search/reply-targets`, `GET /api/search/reply-targets`, MCP `find_reply_posts`.
- **Reply writing is well-developed:** extension reply button → `POST /api/generate-reply` with rich parent/quote/link/media context and the user's assembled reply voice; MCP steers agents to self-write with `get_writing_context(voiceType:"reply")`; on-demand voice check (3 cr). Never auto-sends.
- **Dashboard live assistant supports `voice_type:"reply"`** (`/api/live-read`, `live-read/route.ts:49`).
- **Niche model** (`niche-analyze.ts`: pillars, topic clusters, positioning) and **strategy quota** (`replies_per_week`) exist.
- **Algorithm knowledge base** (`x-algorithm.ts`) with reply weights, LLM-judge claims, and a weekly `algo-watch` diff cron.

**Gaps (the scope of this enhancement):**

| # | Gap | Where |
|---|---|---|
| G1 | No sweeping at all — discovery is pull-based, per-call, query 100% caller-supplied | `reply-targets.ts` |
| G2 | Niche model never feeds target discovery (informs how replies are *written*, never *which posts to find*) | `niche-analyze.ts` ↛ `reply-targets.ts` |
| G3 | No author/audience filtering (follower band, engage-back likelihood) — the 150× signal is unused | `search-mapping.ts` |
| G4 | No velocity or reply-window timing; only engagement÷age decay | `search-mapping.ts:126-147` |
| G5 | Opportunity Score exists twice with **different weights** despite docs claiming unification (extension `content.js:120-127`: likes×3/rt×4/replies×5 vs server `engagement.ts:26-40`: likes×1/rt×3/replies×10) + rolling normalization issues (BACKLOG EXT-8, EXT-9) | `chrome-extension/src/content/content.js`, `src/lib/utils/engagement.ts` |
| G6 | Extension real-time assistant is reply-blind (mounts in reply composer but never applies reply voice/context) | `chrome-extension/src/content/assistant-ui.js` |
| G7 | No dedup of already-replied targets; no feedback loop from reply outcomes into targeting | — |
| G8 | `reply_allowed` is best-effort; publish-time 403s surface with no graceful pre-flight | `search-mapping.ts:72-81` |

---

## 3. Product scope

Three layers plus one add-on, shipped in phases (§7). All layers share one sweep/score/deliver pipeline.

### 3.1 Reply Radar (core)

A standing, **system-seeded, user-trimmed** watch producing a bounded daily queue (10–15 targets) plus real-time alerts for perishable windows.

- **Watch inputs (per user):**
  - **Topic clusters** — auto-compiled search queries from the user's analyzed niche (pillars/topic clusters → keyword queries with `lang:` + `-is:retweet -is:reply` hygiene). User can disable/edit; never starts from a blank query box.
  - **Account watchlist** — seeded from accounts the user already engages with + niche-adjacent large accounts (the 50k–100k band); user adds/removes. This is the r/SaaS poster's "designated follow list."
- **Delivery:**
  - **Daily queue** ("your 20-minute reply session, pre-hunted") on the dashboard; bounded, ranked, with per-target "why" reasons.
  - **Real-time alerts** (push/extension badge) only for high-urgency windows on watchlist accounts — fresh post from a watched account, accelerating velocity, low reply competition.
  - Queue states: new / snoozed / replied / skipped (feeds the outcome loop).
- **Explicitly NOT:** an infinite feed. The bound is the product promise (anti-vigil), and it also bounds COGS.

### 3.2 Custom trackers (add-on, same pipeline)

User-defined sweep+alert for a specific search (e.g., "AI chat apps that help students") — the r/microsaas founder's duct-taped rss.app+LLM+Slack workflow as a first-class feature. Personal (not pooled), therefore **budgeted per tracker per day** (§5). At creation, run one test sweep and show "~N matches in the last 24h" to calibrate expectations and warn on firehose queries. Secondary wedge into social-listening/lead-gen use cases.

### 3.3 Reply Desk

Click a target → composer opens with:
- **Live assistant in reply mode** (fix G6: wire `voice_type:"reply"` + parent context into the extension assistant; dashboard already supports it).
- **Context card:** *why this target* — every Opportunity 2.0 factor legible ("your score, explained" — same positioning stance as against SuperX's black-box simulator), and *what angle fits you* from the user's own extracted patterns.
- Human writes; nothing is auto-sent. Publish-time 403s (G8) surface gracefully with a "pick the next target" fallback.

### 3.4 Outcome loop (the moat)

Attribute per-reply outcomes — author engage-back, profile clicks, follows gained, reply impressions — and feed them back into Radar ranking: "your replies to 10–50k accounts in your niche converted 3× better than replies to mega-accounts; retuning your queue." This is the engagement-weighted own-analytics wedge applied to targeting. No competitor has it; mimicry tools structurally can't.

---

## 4. Architecture

### 4.1 Sweep units and pooling (the economic core)

X API pay-per-use (Feb 2026, `COGS.md §1b`): search billed **per post returned ($0.005)**; requests free; **re-read of the same post within 24h free (dedup)**; hard cap **2M post-reads/month per app** (Enterprise ≈ $42K/mo is not an option). Therefore:

- **Candidate discovery is a shared resource, not a per-user job.** Reads bill per app and dedup makes overlap free, so sweeps run per **sweep unit**, results land in a shared **candidate pool**, and all per-user work (scoring, filtering, dedup) happens on our side (embeddings ≈ $0, DB reads).
- **Sweep units:**
  1. **Topic-cluster queries** (pooled) — one per niche cluster (~20 clusters at launch scale), swept 2–4×/day.
  2. **Watched accounts** (pooled) — the union of all users' watchlists, deduplicated; batched `from:a OR from:b` queries, swept every 15–30 min. Cost scales with *unique* accounts, not user-watches.
  3. **Custom trackers** (personal) — per-user queries, swept daily-to-hourly under a per-tracker daily read budget.
- **`since_id` cursors on every unit** — sweeps only return posts newer than the last sweep. **Frequency is therefore ~free; breadth is the entire cost.** Cadence is a product decision, not a cost one.
- **Per-unit daily read budgets** enforced in the sweep runner (not per-sweep caps — a firehose query swept hourly at 25/sweep is 600 reads/day; a 50/day budget hard-ceilings any unit at $7.50/mo). Budget exhausted → unit pauses until tomorrow + user notified their query is too broad.

### 4.2 Data model (sketch)

- `sweep_units` — type (cluster / watchlist_batch / tracker), owner (null = pooled), compiled query, since_id cursor, daily_read_budget, reads_today, status.
- `candidate_posts` — post id, author (id, follower band), metrics snapshots (for velocity), first_seen/swept_at, source unit(s). Shared pool; TTL ~7 days (matches recent-search horizon).
- `user_target_queue` — user × candidate, score + factor breakdown (JSON), state (new/snoozed/replied/skipped), delivered_via (queue/alert).
- `reply_outcomes` — user reply → target link, engage-back / follows / impressions attribution (Phase 3).

### 4.3 Opportunity Score 2.0

One implementation, server-side, shared verbatim with the extension (same "one source of truth + parity test" pattern used for the engagement-bait lists in `x-algorithm.ts`). Factors, each contributing a legible reason string:

| Factor | Signal | Source |
|---|---|---|
| Topic fit | embedding similarity: candidate text vs user niche centroids | `vectors.ts` infra (exists) |
| Author band | follower count in the proven 10k–100k band; engage-back likelihood (Phase 3: learned per user) | user lookup ($0.01, cached) |
| Freshness/window | post age + **velocity** (Δengagement between metric snapshots) — "12 min old and accelerating" | candidate pool snapshots |
| Competition | reply count vs views (early = visible; 200 replies = buried) | public_metrics |
| Traction | canonical `weightedEngagement` (`engagement.ts` weights — the single source) | exists |
| Repliability | `reply_allowed` allow-list (exists) + already-replied dedup (G7) | `search-mapping.ts` + queue states |

### 4.4 Sweep runner & cadence

- Cron-driven (existing `daily-ops` / cron patterns): watchlist units every 15–30 min; cluster units 2–4×/day; trackers per their tier.
- Scoring pass after each sweep: embed new candidates (≈ $0.0000014 each), score against affected users' centroids, upsert `user_target_queue`, fire alert notifications for above-threshold urgency.
- `usage-rollup` cron extended with sweep-read COGS counters + the existing $25/day platform / $5/user/day alerts.

### 4.5 Token/billing note

Pooled sweeps read public content via **app-level access**; per-user actions (publish, own-analytics, owned reads) stay on user tokens. Deliberate design decision at spec time — pooling is the whole economic model (flag from the cost analysis; confirm compliance posture with X's ToS for cached/pooled reads within the 24h dedup window).

---

## 5. Cost model & unit economics

From the 2026-07-08 analysis (X pay-per-use rates per `COGS.md §1b`, confirmed against docs.x.com July 2026):

| Design | Reads/day | COGS/user/month | Verdict |
|---|---|---|---|
| **Naive per-user sweeping** (30 accounts + 5 niche queries per user) | 300–500/user | **$45–75** | 🔴 Dead — underwater on $29; ~300 users hits the 2M cap |
| **Pooled** (20 clusters × ~300/day + 500 unique watched accounts × ~5/day) | ~8,500 total | ~$1,275/mo total → **~$6 @ 200 users, ~$1.30 @ 1,000** | 🟢 Marginal cost of next user in an existing niche ≈ $0; ~13% of the 2M cap |
| **Custom tracker** (narrow query, daily) | 5–25 | **$0.75–3.75 per tracker** | 🟢 Metered |
| **Custom tracker** (50 reads/day budget ceiling, any cadence/breadth) | ≤50 | **≤$7.50 per tracker** | 🟢 Hard ceiling |

Fits inside the ~58%-margin Pro structure (`COGS.md §4`): pooled Radar adds single-digit dollars trending to pennies with niche density. **The 2M/month app cap is the scale ceiling and forces the pooled architecture from day one** — treat it as a first-class budget in the sweep runner.

Custom-tracker retail: existing `search.per_post` = 1 credit ($0.01) vs $0.005 cost — 50% margin preserved; a maxed 50/day tracker ≈ 1,500 credits/mo retail ($15) vs ≤$7.50 COGS.

## 6. Packaging

| Tier | Radar | Trackers | Alerts |
|---|---|---|---|
| **Free** | A few pooled radar hits/day (taste; ~$0 marginal COGS) | — | — |
| **Pro ($29)** | Full daily queue + watchlist (≤~30 accounts) | 2–3 included, 50 reads/day budget each | Real-time watchlist + tracker alerts |
| **Credits** | — | Extra trackers / raised budgets at `search.per_post` rates | — |
| **Agency (future)** | Per-client queues | Per-client trackers | — (proof-gated per ICP brief) |

Radar is the natural Pro driver: it's the feature whose absence is *felt daily* (the vigil), and pooled economics make the free taste nearly costless.

---

## 7. Phasing

### Phase 0 — Hygiene (days; do regardless of Radar)
1. **Unify the Opportunity Score** (G5): extension consumes the server-canonical formula (`engagement.ts` weights); delete drifted client weights; parity test (same pattern as the engagement-bait consolidation). Fixes the "pill number ≠ ranking number" bug and BACKLOG EXT-8/9 while in there.
2. **Reply-aware extension assistant** (G6): wire `voice_type:"reply"` + parent-post context into `assistant-ui.js` when mounted in a reply composer.
3. **Already-replied dedup** (G7, discovery half): filter targets the user has replied to from `findReplyTargets` results.

*Acceptance: extension pill and server ranking agree on ordering; live assistant in the X reply composer applies reply voice; repeat targets don't resurface.*

### Phase 1 — Radar MVP (the differentiating build)
1. `sweep_units` + `candidate_posts` + `user_target_queue` schema; sweep runner cron with `since_id` cursors + per-unit daily budgets + cap accounting.
2. Niche → query compiler (topic clusters → hygiene-filtered queries); watchlist CRUD seeded from engagement history.
3. Opportunity 2.0 scoring pass (topic-fit embeddings + author band + freshness + competition + traction) with legible factor reasons.
4. Dashboard daily queue UI (bounded 10–15, states, "why" card); extension badge.
5. COGS instrumentation in `usage-rollup`.

*Acceptance: a Pro user with an analyzed niche gets a ranked queue of ≥10 repliable, on-niche targets daily without ever writing a query; platform sweep reads stay under budget alerts.*

### Phase 2 — Desk + alerts
1. Target → composer flow with context card (score factors + fitting angle from user patterns).
2. Real-time watchlist alerts (push + badge) gated on urgency threshold (fresh + accelerating + low competition).
3. Custom trackers v1: creation flow with test-sweep volume preview, daily budgets, credit metering, alert delivery.
4. Graceful publish-time 403 handling (G8) with next-target fallback.

*Acceptance: time from alert → published human-written reply < 5 min in dogfooding; tracker COGS ceiling enforced.*

### Phase 3 — Outcome loop
1. `reply_outcomes` attribution (engage-back, follows, impressions) via existing analytics sync.
2. Ranking feedback: per-user factor re-weighting (which bands/topics/windows convert *for them*); surfaced as a legible insight ("your best reply targets this month were…").
3. Radar digest email/notification with outcome recap (retention surface).

*Acceptance: queue ranking measurably shifts per user based on their outcomes; "replies via Radar vs baseline" attribution visible to the user.*

---

## 8. Metrics

- **Activation tie-in:** time-to-first Radar-sourced published reply (target: first session).
- **Queue quality:** % of daily queue acted on (replied/skipped ratio); alert → reply conversion.
- **The wedge metric:** author engage-back rate on Radar-sourced replies (the ~150× signal) vs user baseline.
- **North-star support:** % of new users with ≥1 accepted, voice-checked reply in session 1 (BRIEF §8 target >50%).
- **COGS guardrails:** sweep reads/day vs budget; reads per delivered queue item; 2M cap headroom.

## 9. Risks & mitigations

| Risk | Mitigation |
|---|---|
| X API pricing/policy volatility (~1 hostile change/year; existential per BRIEF §6) | Pooled design minimizes read exposure; budgets + cap accounting from day one; sweep units degrade gracefully to lower cadence |
| 2M/month read cap at scale | Pooling (≈13% of cap at launch scale); per-unit budgets; cluster consolidation as niches densify |
| Broad-query firehose (user trackers) | Per-tracker daily read budget (hard ceiling $7.50/mo); creation-time volume preview + warnings |
| Pooled app-level reads vs X ToS posture | Explicit compliance review at spec time (24h dedup window is X's own billing construct — align caching to it) |
| `reply_allowed` best-effort → publish 403s | Graceful fallback UX (Phase 2); measure 403 rate; consider author-relationship pre-flight if material |
| Queue quality < hand-picking (cold niche, thin analytics) | Bounded queue + skip feedback from day one; cold-start = watchlist-heavy (user-curated) until niche model warms |
| Cultural: "reply guy" reads as cringe/spam outside founder bubble | Copy leads with *targeting quality over volume* ("better 5 great replies than 50"), never "automate replies"; LLM-judge receipts as the anti-spam credential |

## 10. Out of scope (explicitly)

- **Auto-writing or auto-sending replies** — anti-wedge, algorithm-punished, account-unsafe. Never.
- Multi-platform (LinkedIn/Bluesky) radar — X-only is a feature (positioning rule #5).
- Full social-listening suite (sentiment, brand monitoring) — trackers are a wedge, not the product.
- Agency multi-client radar — proof-gated behind the secondary-ICP validation (Reddit pull found zero organic ghostwriter signal; see `2026-07-reddit-signal.md` §7, §10).
- DM/outreach automation of any kind.

## 11. Open questions

1. Pooled-read compliance posture (§4.5) — needs a ToS read before Phase 1 spec freezes.
2. Author engage-back likelihood: derivable pre-Phase-3 from public signals (author's reply-rate to others), or purely learned from our outcomes?
3. Do cluster sweeps need relevance-ranked supplemental pulls (X `sort_order=relevancy`) to seed cold niches, or is recency-only sufficient?
4. Alert channel priority: push (mobile) vs extension badge vs email digest — dogfood first, instrument, then commit.
5. Whether Phase-0's score unification ships the extension formula server-side (extension calls API) or the server formula client-side (shared constant) — leaning shared constant + parity test given offline pill rendering.
