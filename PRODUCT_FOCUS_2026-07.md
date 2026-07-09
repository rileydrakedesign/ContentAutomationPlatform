# Product Focus — the packaged PMF product (2026-07)

> **Status:** Proposed — v2 after Riley's review (provenance cut; reply handoff redesigned; custom watches first-class; simplification pass)
> **Date:** 2026-07-08 · **Owner:** Riley
> **Evidence base:** `research/market-scan/2026-07-pmf-validation.md`, `2026-07-true-signal-addendum.md`, `2026-07-reddit-signal.md`, `REPLY_RADAR_SCOPE.md`, `PRODUCT_FEATURES.md`.
> **What this is:** every shipped/specced feature resolved into **add / change / keep / drop** so the product is one tight package with true PMF.

---

## 1. The product, in one line

**The reply-first growth coach for X: we find the moment, you write it in your voice, we get it onto X the compliant way — and show you what it earned.**

The core is exactly two things, connected by one loop:

```
 ① RADAR — watches (topic / custom / account) → one ranked queue + alerts
 ② COMPOSER — one assistant, one check bar (Algo • Voice • AI), you keep the pen
      ↓ smart handoff to X (intent prefill → extension assist → copy)
 ③ RESULTS — what each reply earned (engage-back, profile clicks, impressions)
      → feeds back into Radar ranking and your voice rubric
```

Why this is TRUE PMF, in one paragraph: reply-driven growth is the current mainstream playbook on X (live July-2026 signal), reply-target curation is the only feature users have ever specced unprompted, and X killed the automated alternative at the API and enforcement level — so the find-it-for-me / write-it-myself lane is defensible *by platform policy*. Meanwhile audiences punish AI-sounding text harder every month and users already hand-roll pre-publish "sounds like AI" checks with general-purpose LLMs. We own the only compliant reply lane **and** the only check bar grounded in the user's own voice and analytics. That intersection is the product; everything else in the codebase is either plumbing for it or gone.

---

## 2. The Radar (①) — one primitive: the Watch

Everything Radar does is a **watch**; all watches feed the same pipeline (sweep → score → dedup → queue/alert) and produce identical queue cards. No separate "trackers" concept in the UI.

| Watch type | How it's created | Example |
|---|---|---|
| **Topic watch** | Auto-seeded from the user's analyzed niche (pillars → compiled queries); user can trim | "indie SaaS marketing" |
| **Custom watch** | **User types a plain-English phrase**; we compile it to X search queries + an embedding centroid, run a test sweep, show "~N matches/24h" | **"student chat products", "AI writing pain points"** |
| **Account watch** | Seeded from accounts the user engages with + niche 10k–100k band; user adds/removes | @levelsio, @heyeaslo |

- **Custom watches are first-class, not an add-on.** The match is **semantic**: keyword queries recall candidates cheaply (pooled, `since_id`-cursored per `REPLY_RADAR_SCOPE.md` §4), then the embedding filter keeps only posts that actually match the *meaning* of the phrase — "AI writing pain points" must surface complaints, not tool ads. Only candidates passing the reply-worthiness gate (repliable, fresh window, author band, competition) reach the queue; the rest are dropped silently.
- **Alerts:** every watch has an alert toggle. High-urgency matches (fresh + accelerating + low reply competition) push in real time (extension badge + notification); everything else lands in the bounded daily queue (10–15). The bound is the promise — anti-vigil, and it caps COGS.
- Budgets/caps per the scope doc (per-watch daily read budget; pooled sweeps; 2M/mo cap accounting). Unchanged.

## 3. The Composer (②) — one assistant, one check bar, one handoff

**One composer everywhere.** The dashboard editor and the extension's on-X assist are the same brain with the same three checks. The standalone Create page dies; "generate a starting point" is a button inside the composer, nothing more.

**One check bar — three lights, one interaction.** Algo check (open-source-ranker alignment), Voice check (your fingerprint), AI check (sounds-like-AI lint: banned phrases, "it's not X it's Y" reversals, rule-of-three, uniform rhythm — seeded from *your* voice profile). Presented as a single bar with three segments; every flag is one click to see the reason, one click to fix or dismiss. No three panels, no separate scores to learn. (Fits the existing 3-tier check engine: deterministic lint free at Tier 0, LLM judgment at Tier 1/2.)

**One handoff — because the API can't post replies.** Radar card → "Write reply" → in-house composer with parent-post context → **Post on X**, which degrades gracefully through three tiers:

1. **Intent prefill (default, works for everyone):** open `x.com/intent/post?in_reply_to=<id>&text=<composed reply>` in a new tab — X's own composer opens on the post, reply pre-filled, user hits Post from their own session. No API involved, verified supported by the official Web Intents docs.
2. **Extension assist (best experience):** extension detects the handoff, opens the post, and mounts the same check bar in X's native reply composer — user can tweak with live coaching before posting.
3. **Copy fallback:** copy button + open post in new tab, for any environment where 1–2 fail (X app deep-link quirks on mobile are a known intent bug).

Posting always happens as the *user*, in *their* session, with *their* final keystroke — compliant by construction and immune to the Feb-2026 API rules. We record the handoff (target id + composed text) so Results can attribute outcomes without needing to have posted anything ourselves.

## 4. Results (③) — the outcome loop, scoped to what the API actually gives us

Honest feasibility per metric (all via the user's own OAuth token on their own posts):

| Metric | Feasibility | How |
|---|---|---|
| **Impressions per reply** | ✅ solid | own-post metrics (`non_public_metrics.impression_count`) |
| **Profile clicks per reply** | ✅ solid | `non_public_metrics.user_profile_clicks` — per-post, first-class API field |
| **Author engage-back** | ✅ solid | did the target author reply to / like your reply — conversation lookup + liking_users on your post; small-N, cached |
| **Follows gained** | ⚠️ heuristic only | X has **no per-post follow attribution**. Two labeled proxies: (a) follower-count delta in the hours after a reply session ("~+6 followers in the 4h after these 3 replies" — directional, never claimed as causal), (b) **author-followed-you-back** checked directly for watched targets (small-N relationship lookup — concrete and cheap) |

So the loop's core currency is **engage-back rate and profile clicks per reply** (both real, per-reply, actionable), with follower movement as a clearly-labeled estimate. That's enough to do the job: re-rank watches per user ("your replies to 10–50k accounts converted 3× better"), and show a Results view that answers "did this week's 20-minute sessions earn anything." Ranking feedback per scope Phase 3, unchanged otherwise.

Attribution mechanics: we know the reply exists because the handoff recorded the target + text; a light sync matches the user's newest posts against recorded handoffs (fuzzy text + `in_reply_to` id), then pulls that post's metrics on the normal analytics cadence. No publish API needed anywhere in the loop.

## 5. Making it simple and tight — the shape rules

1. **Three surfaces, period: Radar / Composer / Results.** That's the nav. Voice settings, patterns, library, tuneups, best-times all demote to a single Settings/backstage area or run silently (tuneup on cadence; best-times becomes a Radar timing factor; patterns feed the "what angle fits you" hint on queue cards).
2. **One primitive per surface.** Radar has watches → cards. Composer has drafts → one check bar → one handoff button. Results has replies → three numbers each. If a feature can't be expressed as one of these, it doesn't get UI.
3. **One card, one action.** Every queue card has exactly one primary action ("Write reply"); snooze/skip are quiet secondary. No modes, no tabs on cards.
4. **The extension is the same product, not a second one.** Same check bar, same queue (badge → mini-queue), same voice. Extension-only capabilities (native-composer assist, save/capture) are enhancements of the same loop, not separate features.
5. **No blank states.** Onboarding: connect X → niche auto-analysis → Radar pre-seeded with topic + account watches → first queue card visible in session 1 → first coached reply through the handoff. The user never writes a search query or configures a voice before feeling the loop once.
6. **Generation never leads.** "Starting point" is a button inside the composer. Nothing in nav, marketing, or onboarding says "generate."

## 6. ADD / CHANGE / KEEP / DROP (v2, net of the above)

**ADD:** A1 Radar core with the three watch types incl. plain-English custom watches (L) · A2 sounds-like-AI lint as the AI segment of the unified check bar (S) · A3 outcome loop scoped per §4 (M).

**CHANGE:** C1 all reply delivery → the §3 three-tier handoff; audit remaining API post/thread paths for the unsolicited-mention rule (S–M) · C2 extension reply agent inverted to coach-first, generated options demoted (M) · C3 opportunity score unified server-canonical with legible reasons (S) · C4 niche watch seeds Radar watches (S) · C5 analytics reframed as Results (S) · C6 voice system feeds the check bar invisibly; reply-voice first-class (S).

**KEEP (backstage):** capture/inspiration, pattern extraction, MCP surface (audited), scheduling as unmarketed utility.

**DROP:** ~~provenance receipt~~ (cut — not our product) · voice-memo/transcript pipeline (delete) · Create page as a surface (fold in) · any auto-posting direction (never) · multi-platform (refuse) · agency tier (interviews only) · separate "trackers" concept (merged into watches).

## 7. Packaging

| Tier | Gets |
|---|---|
| **Free** | Composer + check bar (Tier-0/deterministic) + first-session Voice Report + 2–3 Radar cards/day from topic watches |
| **Pro $29** | Full daily queue, account watches (≤30), **2–3 custom watches** with real-time alerts, full check bar (all tiers), Results loop |
| **Credits** | Extra custom watches / raised sweep budgets, generation starting points, deep checks |

Activation north star: **first coached reply through the handoff in session 1.** Radar (daily-felt anti-vigil) drives Pro; custom watches ("alert me on 'AI writing pain points'") are the demo-able wow and the lead-gen wedge; Fireply's $69–129 pricing shows headroom above $29.

## 8. Sequencing (13 weeks)

1. **Wk 1–2 — plumbing:** handoff v1 (intent prefill + copy fallback), score unification (C3), reply-voice in extension (C6), lint Tier-0 (A2). *All small; all shippable behind flags.*
2. **Wk 3–6 — Radar MVP:** sweep pipeline + topic/account watches + queue UI + budgets (A1), niche seeding (C4), coach-first extension reply UX (C2), extension handoff tier 2.
3. **Wk 7–10 — custom watches + alerts:** plain-English watch creation with test-sweep preview, semantic filter, real-time alerts; check bar Tier-1/2.
4. **Wk 11–13 — Results:** handoff-based attribution, engage-back + profile-click surfacing, watch re-ranking; launch content ("X ranks replies with an LLM judge built to catch generic AI replies — we find the moment; you keep the pen").

## 9. Ship gates

- **Radar:** ≥10 repliable on-niche cards/day for a niche-analyzed Pro user with zero hand-written queries; a custom watch created from a plain phrase surfaces ≥1 genuinely on-meaning candidate in its first 24h test sweep.
- **Handoff:** intent-prefill success rate ≥95% on desktop web; time from queue card → posted reply < 3 min in dogfooding; zero API reply-publish attempts in telemetry.
- **Check bar:** one component shared dashboard/extension (parity test); ≥30% of flags acted on.
- **Results:** engage-back + profile clicks visible per reply within 24h of posting; Radar-sourced replies' engage-back rate ≥ user baseline within 30 days.
- **Coherence:** a session-1 user describes the product as "it finds me posts to reply to and helps me write them." Anything else = packaging failure.

## 10. Bets this rests on (falsifiable)

1. Homogenization backlash keeps growing (evidence trend: yes).
2. X keeps automated replies dead (LLM-judge ranker + three enforcement waves: yes).
3. Reply-guy culture stays net-positive in our segment; copy hedges with *targeting quality over volume*.
4. Web intents stay supported (they're X's own embed surface; if they ever break, tier-2 extension assist and tier-3 copy already cover it).
