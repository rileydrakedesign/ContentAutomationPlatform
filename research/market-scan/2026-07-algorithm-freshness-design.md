# Keeping the Algorithm Mapping Dynamic — Design

> **Question:** How do we ensure the algorithm-mapping system stays correct as X changes the algorithm? Is there a public source of truth to latch onto?
> **Answer in one line:** Yes — `xai-org/x-algorithm` is the canonical *structural* source and is watchable, but it's partial (weights/prompts redacted) and sporadic; so the system needs **three layers**: (1) a provenance-tagged claims store, (2) automated watchers on the public sources, (3) an empirical drift monitor on our own cross-user data — which is the only *continuous* source of truth and is a moat competitors can't copy.
> **Date:** 2026-07-07 · builds on `2026-07-algorithm-mapping-teardown.md`

---

## 0. The exposure analysis (what can actually go stale)

| Layer | Depends on algorithm specifics? | Robustness today |
|---|---|---|
| **L0 / Tier-0 deterministic flags** (`x-algorithm.ts`, `tier0.ts`, prepublish flags) | **Yes — fully.** Hardcoded claims: weights table, bait/reply-hook phrase lists, link-penalty copy, the "why" text on every card | ⚠️ The concentrated risk. Static TS constants, 2023-era numbers, updated only by code change |
| **L2 embeddings** (voice/winners centroids) | No — tracks *your* measured winners; if the algorithm changes what wins, the centroids follow via analytics ingestion | ✅ Self-healing (lag = analytics sync + centroid refresh cadence) |
| **L3 LLM judge** (live-read, voice-check, prepublish resemblance) | Indirectly — prompts cite mechanisms; resemblance is vs your own top posts | ✅ Mostly self-healing; prompt claims need the same provenance treatment as Tier-0 |
| **`weightedEngagement` ordering** (the canonical currency) | Ordinal only (replies ≫ RT > likes) | ✅ Ordering survives coefficient changes; pinned by test |
| **Pattern extraction / tune-up** | No — pure own-data | ✅ Self-healing |

**Conclusion:** the whole freshness problem reduces to *the claims layer* — the deterministic flags and the "why" copy. Everything downstream of the user's own data already adapts automatically. That's a structural advantage to preserve and to market.

---

## 1. Layer 1 — A provenance-tagged claims store (make claims data, not code)

Evolve `X_ALGORITHM_WEIGHTS` + the flag copy into a versioned **algorithm knowledge base** where every claim carries its receipts:

```ts
type AlgorithmClaim = {
  id: string;                       // "link_reach_gap", "reply_over_like", ...
  tier: "A" | "B" | "C";            // A = verified in published code · B = measured/attested · C = folklore (never shipped)
  statement: string;                // the "why" copy shown to users
  source: { url: string; kind: "code" | "measurement" | "announcement"; date: string };
  last_verified: string;            // ISO date
  review_by: string;                // staleness deadline — UI softens/uses hedged copy past this
  numeric?: { value: number; basis: "published_2023" | "afx_measured" | "external_study" };
  status: "active" | "stale" | "retired";
};
```

- **UI renders "why" cards from the KB**, including the source + date ("measured across AFX accounts, Jun 2026" / "per the open-source release, May 2026"). The provenance *is* the differentiator vs. the fabricated-weights scorer market — show it.
- **Staleness is a first-class state**: a claim past `review_by` automatically downgrades its copy (e.g., "historically, replies far outweigh likes") instead of silently asserting stale facts. No claim can rot invisibly.
- Keep it as a TS module first (client-safe, bundled to the extension like `tier0.ts`); move to a Supabase table only if we want claims updatable without deploys. A **test pins every Tier-0 flag and prompt citation to a KB entry** so no surface can hardcode an unprovenanced claim.
- Scoring logic stays **ordinal** (never multiply by claimed platform coefficients) — orderings survive weight retunes; coefficients don't.

## 2. Layer 2 — Watchers on the public sources (event-driven)

**2a. The repo watcher (primary).** Weekly cron (fits the existing `daily-ops`/cron pattern):
- `GET https://api.github.com/repos/xai-org/x-algorithm/commits?per_page=1` (ETag-cached, unauthenticated is fine at this rate) → compare SHA to the stored snapshot.
- On change: fetch the handful of load-bearing files raw (`README.md`, `home-mixer/scorers/weighted_scorer.rs`, `home-mixer/filters/` listing, `grox/classifiers/content/` listing), diff the extracted **head list / filter list / classifier list** against the stored snapshot, and open a review task (Sentry alert / email / admin flag) with the diff attached.
- **Human-in-the-loop by design**: the watcher never auto-edits claims; it produces a reviewed diff. (An LLM summary of the diff is a cheap nice-to-have.)
- Store snapshots in Supabase (`algorithm_source_snapshots`) so the KB's `last_verified` can be bumped in bulk when a release is reviewed and nothing changed.

**2b. The comms watcher (secondary).** The behavioral changes that matter most (link demotion tightening, AI-reply enforcement, monetization policy) usually surface as **announcements, not code**. Cheap options, in order:
- Weekly X API search (we already have `searchRecentTweets`) over `from:XEng OR from:Support OR from:nikitabier algorithm OR ranking OR reach` — pennies/week at our credit costs, surfaces candidates for human review.
- X engineering blog / policy pages: a monthly fetch-and-hash of the automation-rules and ranking-related pages; alert on change.

**2c. What NOT to build:** anything that treats the repo as a live API (no coefficient scraping — they're redacted; no assumption of release cadence). Two drops (Jan 20, May 15) suggest ~quarterly, but nothing is promised.

## 3. Layer 3 — The empirical drift monitor (the moat, and the continuous source of truth)

The redaction argument cuts both ways: since X hides the coefficients, **the best available signal is measured behavior — and we sit on the dataset.** Every competitor pastes folklore; we can publish measurements.

- **Aggregate feature-effect job (monthly, cron):** across the opted-in analytics pool, estimate reach/engagement effects of the exact features our flags claim matter — link vs. no-link (the headline one), media presence, question/reply-hook presence, bait phrases, length bands, thread vs. single. Simple stratified comparisons per account size band are enough (we're validating *direction and rough magnitude*, not publishing econometrics).
- **Wire results into the KB**: `numeric.basis = "afx_measured"` with the measurement date — the link-gap card stops citing a static "30–50% (2025 studies)" and starts citing *our* number, refreshed monthly. When a measured effect flips or collapses, the claim auto-flags for review — **we detect algorithm changes from outcomes even when X ships nothing publicly.**
- **Per-user layer already exists** (pattern multipliers, winners centroid) — the drift monitor is the same idea at platform level, and it feeds marketing directly ("we measured the link penalty across N accounts this month: −X%"). Nobody else in the scorer market can produce that sentence.
- Privacy: aggregate, threshold-gated (no cohort smaller than N), and disclosed in terms.

## 4. Sequencing (cheap first)

1. **KB refactor of `x-algorithm.ts`** + provenance-rendering in the "why" cards + the pin test — a day-scale change, immediately converts the freshness problem into a data problem and ships the differentiating "receipts" UX.
2. **Repo watcher cron** — half-day; the May 15 drop proves updates happen and nobody notices for days; we should be first.
3. **Link-gap measurement** as the pilot drift metric (highest-traffic claim, simplest query) → then generalize to the other flags.
4. **Comms watcher** — opportunistic; piggyback on existing cron + X search credits.

## 5. Direct answers

- **"Is there an X public source of truth?"** Yes: `xai-org/x-algorithm` (structure, heads, classifiers — watch it by commit) plus official announcements (behavior/policy). But it is **partial** (weights + Grok prompts redacted), **sporadic** (no cadence contract), and **not sufficient**: the coefficients that scoring folklore obsesses over are deliberately hidden.
- **"How do we stay robust?"** Make every user-visible claim carry provenance + expiry (Layer 1), subscribe to the public sources as events with human review (Layer 2), and measure the claims continuously against our own pooled outcomes (Layer 3). The product's architecture already self-heals everywhere the user's own data drives the signal — keep the deterministic layer thin, ordinal, and receipt-backed, and the mapping can't silently rot.
