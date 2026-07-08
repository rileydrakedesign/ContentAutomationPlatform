# Product Focus — the packaged PMF product (2026-07)

> **Status:** Proposed — decision doc for Riley's sign-off
> **Date:** 2026-07-08 · **Owner:** Riley
> **Evidence base:** `research/market-scan/2026-07-pmf-validation.md` (1,231-post Reddit pull), `2026-07-true-signal-addendum.md` (live X/HN/dev-forum, July 2026), `2026-07-reddit-signal.md` (July 7 pull), `REPLY_RADAR_SCOPE.md`, `PRODUCT_FEATURES.md` (implementation inventory).
> **What this is:** every feature we ship or have specced, resolved into **add / change / keep / drop** so the product is one coherent package with true PMF — not a toolbox. Each call cites its evidence.

---

## 1. The product, in one line

**The reply-first growth coach for X: we find the moment, you write it in your voice — and you can prove it.**

The cohesive loop every feature must serve (anything that doesn't feed this loop gets cut or demoted):

```
 ① RADAR finds the moment      → bounded daily queue + perishable-window alerts
 ② COACH helps you write it    → live assistant in the composer: your voice, algorithm-aligned,
                                  sounds-like-AI lint — you keep the pen
 ③ PROOF it's you              → voice fingerprint + provenance receipt
 ④ OUTCOMES tune the loop      → engage-backs, follows, profile clicks feed back into
                                  Radar ranking and your voice rubric
```

Why this specific package is TRUE PMF (the one-paragraph case): reply-driven growth is the *current mainstream playbook* on X (live July-2026 signal: "0 followers 7 months ago… reply guy… 20.2K"), the only feature users have ever specced unprompted is reply-target curation, and X itself destroyed the automated alternative (Feb-2026 API restriction + March–May ban waves) — so the curation+coaching lane is defensible **by platform policy**. Meanwhile audiences punish AI-sounding text harder every month (834-pt HN slop thread; "Everyone sounds the same!!!"), users are already hand-rolling pre-publish voice checks with Claude/ChatGPT, and the category leader (Grammarly Authorship) is converging on provenance. We own the only compliant reply lane *and* the only voice loop grounded in the user's own analytics. That intersection is the product.

---

## 2. ADD — new, evidence-forced

| # | Feature | What ships | Evidence | Effort |
|---|---|---|---|---|
| A1 | **Reply Radar core** | Pooled sweeps (topic clusters + watchlist), bounded daily queue (10–15, with per-target "why"), perishable-window alerts. Per `REPLY_RADAR_SCOPE.md` Phase 1, with the §4/C1 delivery correction. | The strongest validated demand in three research passes; unprompted user spec; monitoring vacuum (TweetDeck refugees); Pluggo's 1,000-users-from-3-replies story | L |
| A2 | **Sounds-like-AI lint** in the live assistant | A scored dimension (1–10) with named, per-flag reasons: banned-phrase list, "it's not X it's Y" reversals, rule-of-three, uniform sentence rhythm, em-dash density — **seeded from the user's own voice profile**, not a generic list. Tier-0 deterministic first, Tier-1 LLM judgment second (fits the existing 3-tier check engine in `GRAMMARLY_PIVOT_PLAN.md` §6). | Users DIY this *today*: "Every post I write gets scored 1-10 on how much it sounds like AI before it ships. Claude does the scoring. I wrote the rubric." (x.com/RezaaliMo, 2026-07-07) + a second independent "final human filter" workflow. First demand-side validation in the whole program | **S** |
| A3 | **Provenance receipt** | "Written by you, coached" — editor/extension records that the words were typed by the user (accepted-suggestion count vs typed chars), surfaces a shareable receipt in the Voice Report. Not surveillance; a badge the user chooses to use. | Grammarly Authorship ("writing replay"); HN moderators demanding authors "prove they are the author of their work"; HN now bans AI-*edited* comments — proof beats claims | M |
| A4 | **Outcome loop** (Radar Phase 3) | Attribute engage-backs / follows / profile clicks per reply; re-rank the queue per user; monthly "your best targets" insight. | The ~150× author-engage-back signal is public knowledge now (open-source algorithm); no competitor has per-user outcome attribution; mimicry tools structurally can't | M–L |

## 3. CHANGE — existing features, re-pointed at the loop

| # | Feature (today) | Change | Why (evidence) | Effort |
|---|---|---|---|---|
| C1 | **All API publish paths** (`publish_reply`, `publish_post`, `publish_thread`, MCP) | **Native-composer-first.** Replies: extension injection / X web intent; API reply-publish only where compliant. Audit *every* path for unsolicited @mentions/quotes — the official Feb-2026 rule restricts those in normal posts too (self-serve tiers; Enterprise-only exemption). Graceful 403 fallback (old G8) becomes the core design. | Official rule text, devcommunity.x.com/t/257909 — this is a compliance cliff, not a UX preference | S–M |
| C2 | **Extension reply agent** (today: 3 generated options → inject) | **Invert to coach-first:** click a target → composer opens with live reply-voice assistant (wire `voice_type:"reply"` + parent context — old G6); generated options demoted to a "starting points" affordance behind a click. You write; it coaches. | X's ranker LLM-judges replies with an extra spam screen — generated replies are what it's built to bury; slop accusations are audience-enforced; assistant-primary is the pivot's whole thesis, and the extension is the last gen-primary surface left | M |
| C3 | **Opportunity score** (duplicated, drifted weights) | Unify to the server-canonical formula, parity test, legible "why this score" reasons (old G5). Becomes Radar's ranking core (Opportunity 2.0 factors: topic fit, author band, freshness/velocity, competition, traction, repliability). | "Your score, explained" is the anti-black-box stance; two drifted formulas undermine the trust the product sells | S |
| C4 | **Niche account watch** (stored, unused for discovery — old G2) | Watched accounts + analyzed niche clusters **seed the Radar watchlist and sweep queries**. The existing capture behavior becomes the cold-start for ① instead of a dead-end dataset. | The r/SaaS spec asked for exactly this ("my designated follow list"); cost model requires pooled watchlists | S |
| C5 | **Analytics + best-times** | Reframe as the outcome loop's face: engagement-weighted, reply-outcome-aware, and marketed on **reliability** ("your numbers, not inflated ones"). Best-times becomes a Radar timing input, not a standalone tab. | Pro users pay $400–600/mo and churn over "skewed/outdated, even inflated" analytics; X can't even find your own replies — we can | S |
| C6 | **Voice system** | Keep as the engine; add the A2 personal rubric and A3 receipt as Voice Report sections; reply-voice becomes first-class across dashboard *and* extension. | Voice is the moat but it's latent — the Report is how it's demonstrated; "sounds like you" claims are saturated marketing noise, receipts aren't | S |

## 4. KEEP — supporting cast, as-is

- **One-click capture + inspiration library** — the in-X data-collection loop that feeds voice, patterns, and niche. Untouched.
- **Pattern extraction + controls** — powers the coach's "what angle fits you" context card in Reply Desk.
- **MCP/API surface** — distribution and agent-era positioning; subject to the C1 audit.
- **Scheduling/queue** — keep as a utility. **Never market it.** Free OSS (Postiz) owns "schedule posts"; it's a $0-reference-price commodity.
- **Custom trackers** (scope §3.2) — ship inside Radar's sweep pipeline in Phase 2 as scoped (budgeted, test-sweep preview). Validated demand at indie price points under a $7–9k/mo enterprise umbrella; Pluggo proves it monetizes. Differentiate via reply-composer integration, not listening breadth.

## 5. DROP / DEMOTE — with disposition

| # | Feature | Call | Rationale | Disposition |
|---|---|---|---|---|
| D1 | **Voice-memo / transcript → drafts** (inventory #12) | **Drop** | Legacy, off-spine, already "ditched" per inventory; keeping it visible confuses the package | Remove UI entry points now; delete `src/app/api/sources/*` path in a cleanup PR |
| D2 | **Create page as a front door** (topic → drafts, inventory #11) | **Demote (finish the pivot)** | Gen-primary front doors are the anti-wedge; the pivot already demoted generation to "starting points" — the standalone Create page is the leftover | Fold into the editor as a "starting points" panel; retire the route |
| D3 | **Any auto-posting/auto-reply/auto-plug direction** | **Never (re-affirmed)** | Policy-dead (API), enforcement-dead (ban waves), discourse-dead (3 mentions/7 days); it's also our sharpest marketing contrast | Keep the scope §10 exclusion; say it louder in copy |
| D4 | **Multi-platform expansion** (IG/TikTok/LinkedIn asks, e.g. from Typefully fans) | **Refuse, explicitly** | X-only depth *is* the moat (algorithm receipts, reply lane, pooled sweeps); multi-platform is where incumbents are strong and voice is weakest | Positioning rule stays; revisit only post reply-lane dominance |
| D5 | **Agency tier** | **Out of roadmap** (gate = 5 interviews) | Three research passes: pain exists, tool demand unproven, not X-specific | No build; interviews per `2026-07-pmf-validation.md` §4 |
| D6 | **Waitlist landing (agent-for-x)** | Refresh copy only | Copy predates the reply-first packaging | Rewrite around §1's one-liner when launch content ships |

## 6. Packaging (the buyable shape)

| Tier | Gets | Job |
|---|---|---|
| **Free** | Editor + Tier-0 checks + sounds-like-AI lint (deterministic) + first-session **Voice Report** + 2–3 Radar tastes/day | Carry the demonstration — ChatGPT-$20 is the substitute; the report + a felt "found you a great target" is what converts |
| **Pro $29** | Full Radar queue + watchlist + real-time alerts, unlimited live coach (all tiers), 2–3 trackers, outcome loop, provenance receipts | The daily-felt feature (anti-vigil) is the subscription driver; Fireply's $69–129 shows reply-tooling WTP headroom above us |
| **Credits** | Extra trackers/budgets, generation "starting points", deep checks | Metered COGS stays margin-safe per `COGS.md` |

**Activation north star (unchanged, now with a path):** new user publishes ≥1 accepted, voice-checked, Radar-sourced reply in session 1.

## 7. Sequencing (13 weeks)

1. **Weeks 1–2 — Hygiene + compliance (unblocks everything):** C1 audit (the mention/quote rule), C3 score unification, C6/G6 reply-voice in extension, A2 lint Tier-0. *Mostly small, independent; ship behind flags.*
2. **Weeks 3–6 — Radar MVP:** A1 (sweep units, pooled candidates, queue UI, budgets/cap accounting), C4 niche seeding, C2 coach-first reply UX.
3. **Weeks 7–10 — Desk + trackers + proof:** context cards, alerts, custom trackers v1, A3 provenance receipt, A2 Tier-1 lint.
4. **Weeks 11–13 — Outcome loop + launch content:** A4 attribution + re-ranking; ship the algorithm-receipts marketing ("X ranks replies with an LLM judge built to catch generic AI replies — we find the moment; you keep the pen") before the Teract/OpenTweet SEO cluster owns the phrase.

## 8. Ship gates (per `SHIP_GATE.md` convention)

- **Radar:** ≥10 repliable on-niche targets/day for a niche-analyzed Pro user, zero hand-written queries; sweep reads within budget ($25/day platform alert).
- **Coach:** lint acceptance rate >30% of flags acted on; extension pill and server ranking agree (parity test).
- **Compliance:** zero API-publish attempts that violate the reply/mention rule in telemetry (native-composer fallback covers 100%).
- **Loop:** Radar-sourced replies' author-engage-back rate visibly ≥ user's baseline within 30 days of Phase 3.
- **Package coherence check (qualitative):** a new user can say what the product is in one sentence after session 1. If they say "scheduler" or "AI writer," the packaging failed.

## 9. What we deliberately bet against (so the doc is falsifiable)

1. **That generic assist wins:** Grok is free in the composer; if users are satisfied with generic rewrite-assist, our voice-grounded coach loses its premium. Bet: homogenization backlash keeps growing (evidence trend says yes).
2. **That X re-opens automated replies:** would revive the automation competitors overnight. Bet: anti-spam direction is durable (LLM-judge ranker + three enforcement waves say yes).
3. **That reply-guy culture sours:** if "reply guy" becomes net-cringe beyond the founder bubble, demand thins. Mitigation already in copy: *targeting quality over volume* — "better 5 great replies than 50."
