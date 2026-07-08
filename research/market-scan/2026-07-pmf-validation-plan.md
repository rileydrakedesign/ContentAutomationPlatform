# Reddit PMF Validation — Session Plan

> **Status:** Plan approved-pending-review · execution to follow in this session
> **Date:** 2026-07-08 · **Owner:** Riley (research run by Claude, inline — no agent swarms; sequential passes to keep token use bounded)
> **Builds on (does NOT redo):** `2026-07-reddit-signal.md` (421 posts, 8 hypotheses, 2026-07-07), `REPLY_RADAR_SCOPE.md` (reply-sourcing hypothesis, 2026-07-08), `../marketing-positioning/00-positioning-and-pivot.md` (writing-assistant thesis), `../icp-user-story/BRIEF.md`, `2026-07-direct-competitor-scan.md`.

---

## 1. Objectives

One overarching question — **do we have product-market fit signal, and on which features is it strongest and most defensible?** — decomposed into three hypotheses:

### H1 — The writing-assistant thesis (the pivot's core bet)
> *"A real-time writing assistant for X — coach in the corner, user keeps the pen — is a category buyers trust and want, in a way 'AI generator' is not."*

The 07-07 pull left this **half-validated**: AI-voice anxiety is real and audience-enforced (validated), but nobody asks for a pre-publish check demand-side (three founders supply-side, all traction-less). What we have NOT yet tested on Reddit:

- **Category trust transfer:** does "writing assistant" (Grammarly's category) actually carry trust for social writing? What do people say about Grammarly itself — tone flattening, voice complaints, "worth it" debates? If Grammarly is resented for homogenizing voice, the category anchor cuts both ways.
- **The assist/generate boundary:** where do users draw the acceptable-AI line? "AI edits my words" vs "AI writes for me" — is coach-form AI exempt from the slop penalty? (This is the pivot's whole premise and we've never looked for direct evidence.)
- **Post-mortem demand as proxy:** "why did my tweet flop" / "roast my post" behavior — people may not ask for pre-publish checks but demonstrably ask for post-hoc feedback. If so, the demand is real and our job is moving it 5 minutes earlier.
- **Editor-experience affection:** the Typefully finding ("it genuinely makes me want to write more") — is love for the *writing surface* a repeated pattern we can inherit, or a one-off?

### H2 — The Reply Radar hypothesis (the new reply-sourcing direction)
> *"The empty lane is curation + coaching: automate the WATCHING (sweep, rank, alert), the human keeps the pen. The vigil, the perishable window, targeting quality, and workflow poverty are the four pains."* (`REPLY_RADAR_SCOPE.md` §1)

The scope doc stands on ~5 strong quotes from the 07-07 pull. **Expand the evidence base without duplicating it** — new angles the existing battery never queried:

- **Monitoring/alerting pain as its own market:** broken X alerts, keyword-alert asks, TweetDeck-replacement threads, cheap-social-listening asks (validates Custom Trackers as the secondary wedge).
- **Lead-gen-via-replies framing:** "found my first customers replying on X" — the outcome that makes the vigil worth paying to kill. Different searcher intent than "grow followers."
- **Timing/window evidence:** "reply in the first N minutes," notification-bell workflows for big accounts — validates the freshness/velocity factor and real-time alerts.
- **Anti-automation sentiment depth:** auto-reply bots called out as spam/cringe/ban-bait — the stronger this is, the more defensible "we never write it for you" becomes.
- **Watchlist workflows in the wild:** Twitter Lists / bookmark / spreadsheet duct-tape for tracking accounts — the manual version of our watchlist feature.

### H3 — General PMF sweep: demand map + defensibility per feature
Across every feature we ship (live assistant, voice report, reply tooling, analytics loop, scheduling, extension, trackers), plus the open follow-ups the 07-07 doc ranked:

1. **Ghostwriter/agency targeted pass** (07-07 follow-up #2): r/freelanceWriters, r/copywriting, r/Ghostwriters, r/socialmediamanagers — the secondary-ICP thesis currently stands on zero direct evidence across two passes. This decides the agency-tier gate.
2. **Postwise/PostOwl re-check** (follow-up #3): zero mentions in 421 posts didn't square with "nearest claimed comp."
3. **Untracked competitors:** Postiz, Publora, Post-Bridge, Metricool, Taplio, Cleve.ai — churn triggers and gaps.
4. **Churn & switching:** "cancelled / switched from" — what actually kills subscriptions in this category (07-07 said price + missing reply features, never voice; confirm with a dedicated query).
5. **Commodity floor:** scheduling-as-commodity check — what nobody will pay for anymore (defensibility inverse).
6. **Pricing in non-indie rooms:** r/agency, r/socialmediamanagers — the 07-07 WTP read came from the cheapest corner of the market.

---

## 2. Constraints verified today (2026-07-08)

| Path | Status | Implication |
|---|---|---|
| `old.reddit.com` / `www.reddit.com` JSON | **403** (re-tested today) | No live Reddit from this environment |
| `api.pullpush.io` archive | **200, works** — but newest post is still **2025-05-19** | Primary path; all quotes ≤ May 2025. The 07-07 doc's data-limits preamble applies verbatim to this pull too |
| WebSearch, reddit.com-restricted | **Blocked** (Reddit blocks the crawler; re-confirmed) | Cannot retrieve 2026 Reddit posts at all |
| WebSearch, general | **Works, returns 2026 content** | Non-Reddit 2026 corroboration only (vendor SEO, blogs) — context, never demand quotes |

**Honesty rule carried forward:** the May-2026 suspension wave, Jan-2026 algorithm open-sourcing discourse, and Grok-in-composer reactions remain **structurally invisible** on the Reddit path. Verdicts must not silently treat absence-after-May-2025 as refutation. A small general-WebSearch pass (§5, Pass F) captures 2026 discourse as *context*, clearly firewalled from Reddit demand evidence.

**No agent swarms:** every phase runs inline in the main session, sequentially. The raw pull is a local script (zero tokens); analysis reads the JSONL in chunks, one themed pass at a time.

---

## 3. Query battery v2 (new — zero overlap with the 07-07 battery)

Extend `reddit-pull.mjs` with a second battery behind a flag (`--battery=pmf`), same etiquette (~1 req/1.2s), same schema, `--pullpush` path. The 07-07 battery's 24 queries are **not** re-run.

**H1 — writing-assistant thesis (11 queries):**

| # | Query | Sub | Probes |
|---|---|---|---|
| A1 | `grammarly tone OR voice changed` | — | Category anchor's voice reputation |
| A2 | `grammarly worth it` | — | WTP for writing-assist form factor |
| A3 | `"writing assistant" AI recommend` | — | Category vocabulary in the wild |
| A4 | `AI to edit not write` | — | The assist/generate boundary |
| A5 | `"why did my tweet" OR "why did my post" flop OR views` | — | Post-mortem feedback demand |
| A6 | `roast my tweet OR post honest feedback` | — | Feedback-seeking behavior |
| A7 | `hemingway editor OR app writing` | — | Non-AI coach-form affection |
| A8 | `typefully editor writing experience` | — | Deepen the editor-affection finding |
| A9 | `"AI detector" false positive accused` | — | Slop-accusation collateral damage |
| A10 | `improve my tweets writing better` | r/Twitter | Self-improvement framing (vs platform-blame) |
| A11 | `AI helps me write my own` | — | Coach-form acceptance, first person |

**H2 — Reply Radar expansion (11 queries):**

| # | Query | Sub | Probes |
|---|---|---|---|
| B1 | `twitter alerts broken OR alternative` | — | Perishable-window pain (facet 2) |
| B2 | `keyword alert twitter OR X tool` | — | Custom-tracker demand |
| B3 | `tweetdeck alternative monitor` | — | Workflow poverty (facet 4) |
| B4 | `social listening tool cheap OR affordable OR indie` | — | Tracker secondary wedge sizing |
| B5 | `found customers twitter replies` | — | Lead-gen outcome framing |
| B6 | `first customers from twitter OR X how` | r/SaaS | Same, in the ICP's room |
| B7 | `reply fast big accounts notifications` | — | Timing/window evidence (facet 2/3) |
| B8 | `twitter lists workflow engage` | — | Manual watchlist duct-tape (facet 1) |
| B9 | `auto reply bot twitter spam OR cringe OR banned` | — | Anti-automation depth (defensibility) |
| B10 | `track mentions niche conversations twitter` | — | Sweep/monitor demand |
| B11 | `spending hours on twitter engagement worth it` | — | The vigil, cost framing (facet 1) |

**H3 — general PMF sweep (13 queries):**

| # | Query | Sub | Probes |
|---|---|---|---|
| C1 | `ghostwriting client voice sound like them` | r/freelanceWriters | Agency-gate evidence |
| C2 | `twitter OR X ghostwriting clients` | r/copywriting | Agency-gate evidence |
| C3 | `client voice` | r/Ghostwriters | Agency-gate evidence (small sub, broad query) |
| C4 | `client approval voice tone` | r/socialmediamanagers | SMM voice-drift pain |
| C5 | `postwise` | — | Follow-up #3 re-check |
| C6 | `postowl` | — | Follow-up #3 re-check |
| C7 | `postiz OR publora OR "post bridge"` | — | Untracked competitor sentiment |
| C8 | `metricool twitter replies OR engagement` | — | The auto-reply churn trigger, verified |
| C9 | `taplio OR cleve` | — | Adjacent-platform comps (same buyer) |
| C10 | `cancelled OR switched social media tool` | — | Churn triggers |
| C11 | `schedule tweets free` | — | Commodity floor |
| C12 | `social media tools monthly cost client` | r/agency | Non-indie WTP |
| C13 | `moved to bluesky audience` | — | Category churn vector |

Comments pass: pull `top_comments` for the ~50 most-discussed relevant threads, as before.

---

## 4. Signal storage & dedup (the "expand, don't duplicate" rules)

1. **Raw store:** everything the battery returns lands in `reddit-signal/raw-2026-07-08-pmf.jsonl` — same schema as the 07-07 file (`source, query, sub, title, created, score, comments, text, url, top_comments`) so the two files concatenate cleanly. Committed as-is; this is the durable signal store.
2. **Dedup at write time:** the script loads every `url` in `raw-2026-07-07.jsonl` and drops rows already present, tagging the run summary with a `duplicates_skipped` count. New queries hitting old posts is expected (it's confirmation); we keep exactly one raw copy.
3. **Dedup at cite time:** if an analysis pass needs a quote that lives in the 07-07 file, it cites `2026-07-reddit-signal.md` §N rather than re-quoting — the synthesis must make *net-new* evidence legible at a glance.
4. **Reply-angle expansion:** the 5 quotes in `REPLY_RADAR_SCOPE.md` §1 are the baseline; the H2 pass reports evidence counts as "N new, on top of the 5 known" per facet.
5. **2026 web context** (Pass F) is stored inline in the synthesis under a clearly-marked "non-Reddit 2026 context" section — never mixed into the JSONL.

---

## 5. Analysis protocol (sequential, inline)

Each pass reads the raw JSONL in chunks (grep-filtered by query tag first, full-text second), mines **verbatim quotes + permalink + date + score**, tags `[self-promo]` where the speaker is a vendor, and scores frequency + intensity. Order:

- **Pass A — H1 mining** (queries A1–A11): produce a verdict per H1 sub-question (category trust, assist/generate boundary, post-mortem proxy, editor affection).
- **Pass B — H2 mining** (B1–B11): evidence count per Reply Radar facet (vigil / window / targeting / workflow poverty) + tracker demand + anti-automation depth.
- **Pass C — ghostwriter/agency gate** (C1–C4): this is the third look at the secondary ICP; the verdict here is decisive either way.
- **Pass D — competitors, churn, pricing, commodity floor** (C5–C13).
- **Pass E — disconfirmation sweep:** one deliberate pass over the *whole* new corpus hunting only for evidence **against** our positioning (platform-blame vs self-improvement, assistant-form rejection, "just use ChatGPT," free-tool entitlement). The most valuable output, per the 07-07 method.
- **Pass F — 2026 context (WebSearch, non-Reddit):** suspension-wave fallout, algorithm open-sourcing discourse, Grok-in-composer, competitor moves (imagineai.me and Vera traction watch — 07-07 follow-up #4). Firewalled as context.

## 6. Deliverables

1. `reddit-signal/raw-2026-07-08-pmf.jsonl` — committed raw signal.
2. `2026-07-pmf-validation.md` — the synthesis:
   - **H1 verdict** with sub-verdicts, quotes, and what it changes in `00-positioning-and-pivot.md` (if anything).
   - **H2 verdict** per facet ("N new + 5 known"), and whether `REPLY_RADAR_SCOPE.md` moves from *Proposed* toward Phase-1 commit, including any packaging changes (tracker wedge sizing).
   - **PMF scorecard** — one table, every feature: demand evidence (validated / latent / absent) × defensibility (moat / parity / commodity) × source of truth. The overarching "where is our PMF strongest" answer.
   - **Contradictions section** (Pass E output) ahead of the good news.
   - **Non-Reddit 2026 context** section, firewalled.
   - **Decision gates resolved:** agency tier (open/keep-gated), pricing band confidence, channel strategy confirmation.
3. **Doc updates as follow-ups, not silent edits:** proposed changes to `REPLY_RADAR_SCOPE.md` (status line, §1 evidence), positioning doc, and BRIEF gates listed at the end of the synthesis for explicit sign-off.

## 7. Decision rules (pre-registered, so the verdicts aren't vibes)

| Hypothesis | Validated if | Refuted/adjusted if |
|---|---|---|
| **H1 category** | Grammarly-form trust visibly transfers (people recommend assistant-form tools for social; assist-AI exempted from slop accusations in ≥4 independent instances) | Grammarly itself widely resented for voice-flattening → category anchor needs a "unlike Grammarly, it's *your* voice" twist |
| **H1 demand** | Post-mortem feedback-seeking is frequent (≥6 first-person instances) → latent pre-publish demand confirmed, education path clear | Zero feedback-seeking in any tense → the coaching form factor itself is unproven; raise activation risk in BRIEF |
| **H2 lane** | ≥8 net-new independent pain instances across ≥3 of the 4 facets, and anti-automation sentiment strong | Facets thin AND automation broadly tolerated → Radar is a nice-to-have, not the Pro driver; revisit packaging |
| **H2 trackers** | ≥4 independent keyword-alert/social-listening asks at indie price points | Listening demand only at enterprise framing → keep trackers Phase-2+, don't market as wedge |
| **H3 agency gate** | ≥5 first-person ghostwriter voice-drift/scaling complaints | Third strike near-zero → close the gate: cut agency tier from roadmap conversation until customer interviews say otherwise |
| **H3 pricing** | Non-indie rooms tolerate $29–49 without resentment markers | Same price sensitivity everywhere → free tier + demonstrated lift becomes *the* conversion mechanic, full stop |

## 8. Sequencing & effort

| Step | What | Cost profile |
|---|---|---|
| 1 | Extend `reddit-pull.mjs` (battery flag + dedup-from-file) | Small code change |
| 2 | Run pull (`--battery=pmf --pullpush`) | Local runtime ~2–4 min, zero tokens |
| 3 | Passes A→E over the JSONL | The token spend; bounded by chunked, query-tag-filtered reads — one theme in context at a time |
| 4 | Pass F (WebSearch, ~6–10 searches) | Small |
| 5 | Synthesis + scorecard + commit | Writing |

Checkpoint after step 2: if the new battery returns mostly noise (pullpush is newest-first, not relevance-ranked — 70–80% noise last time), tighten queries once before analysis rather than analyzing garbage. Checkpoint after Pass C: agency-gate verdict reported immediately since it's decisive for roadmap regardless of the rest.
