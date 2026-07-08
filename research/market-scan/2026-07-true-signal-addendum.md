# True-Signal Addendum — Live 2026 Cross-Source Sweep

> **Purpose:** Close the post-May-2025 blind spot from `2026-07-pmf-validation.md` with **first-person, current (2026, mostly this-week)** signal from user-led sources, and answer: where is PMF *both* validated and defensible, and what feature adds/tweaks does the live signal justify?
> **Sources & reach (verified 2026-07-08):** live X search via our own MCP (`search_tweets`, 7-day window, 63 credits spent of 1,776), Hacker News (Algolia API, full 2026), X developer forum (official Discourse JSON — WebFetch is blocked but `/t/<id>.json` works). Blocked: Reddit (all paths), Bluesky public API (proxy 403).
> **Signal store:** `reddit-signal/cross-source-2026-07-08.jsonl` — 26 rows, same commit-the-evidence convention, every row has a permalink.
> **Date:** 2026-07-08

---

## 1. The headline: our pre-publish voice check exists in the wild — as a DIY workflow, this week

The single thing the entire research program had never found — **demand-side** evidence for a pre-publish check — turned up on X, posted yesterday:

> *"Every post I write gets scored 1-10 on how much it sounds like AI before it ships. Claude does the scoring. I wrote the rubric. It reads the draft against my banned-word list and docks points for the usual suspects: game-changer, unlock, 'it's not X it's Y', rule-of-three"* — [@RezaaliMo, 2026-07-07](https://x.com/RezaaliMo/status/2074465956550615211)

And a second, independently-invented version the same day: a viral-prompt author's step 8, *"The Final Human Check (Run This Last Every Time)… catches anything that still sounds robotic and fixes it… 'You are my final human filter'"* ([@bruteforcearete, 2026-07-07](https://x.com/bruteforcearete/status/2074555317179060736)).

This upgrades the pre-publish score from "latent, founder-inferred" (five traction-less builders) to **"users are hand-rolling it today with general-purpose LLMs."** The form users chose is exactly ours: a *score + reasons against a personal rubric*, run at the moment before publish — not an approve/reject gate, not a rewrite. The delta we offer over their DIY: the rubric shouldn't be a hand-written banned-word list; it should be **derived from the user's own voice profile and own engagement data**, kept current automatically. That's the defensible version of what they're already doing.

**Feature tweak this justifies (cheap, high-conviction):** ship a legible **"sounds-like-AI" lint** dimension in the live assistant — named-pattern detections (banned-phrase list, "it's not X it's Y" reversals, rule-of-three, em-dash density, uniform sentence length) with a 1–10 score and per-flag explanations. The patterns are public knowledge (users recite them: *"One-word emphasis fragments, the 'here's the thing' opener, the reversal for punch"* — [@nerd_productive](https://x.com/nerd_productive/status/2074875158238568804)); the moat is grounding the score in *their* voice fingerprint, not a generic list.

## 2. The wedge, live: homogenization + slop backlash are peaking, and the boundary is tightening

- *"So annoying how everyone online sounds like AI wrote what they're saying for them. Everyone sounds the same!!!"* — [@IDontLikeIG, 2026-07-06](https://x.com/IDontLikeIG/status/2074255301117706376)
- **HN, 834 points / 734 comments (2026-05-07): "AI slop is killing online communities"** ([thread](https://news.ycombinator.com/item?id=48053203)) — including a moderator running an "AI creator" honeypot and asking members *"to prove they are the author of their work."* Provenance demand is now coming from **community moderators**, not just professors.
- **HN moderation now bans AI-*edited* comments**, not just generated ones: *"Don't post generated/AI-edited comments. HN is for conversation between humans"* ([2026-03-12](https://news.ycombinator.com/item?id=47345193)). The assist/generate boundary is tightening in the strictest communities — which raises the value of an assistant that can *show* the human wrote it, and lowers the value of anything that rewrites wholesale.
- The sharpest current framing, from a practitioner: *"Most AI content doesn't fail because it's AI-written. It fails because it's empty. Generic. Hedged. The statistical average of everything already published."* ([@MattGanzak](https://x.com/MattGanzak/status/2074924402592862228)) — this is the mature version of our pitch: the enemy isn't AI, it's *emptiness and sameness*; the fix is your specifics, your voice, your receipts.

## 3. Reply Radar: demand is current, the alternative is dead, and the workflow gap is verbatim

- Reply-guy growth is the **mainstream July-2026 playbook**, not a 2024 relic: *"I started with 0 followers 7 months ago… Just 1 strategy: Become the best 'reply guy' on X. Here's the exact breakdown of how I hit 20.2K"* ([@narhmickykofiii, 2026-07-08](https://x.com/narhmickykofiii/status/2074916599153181004)); *"if I continue at this pace with my reply guy strategy, I could hit 5million impressions"* ([@madduune](https://x.com/madduune/status/2074950986150613318)); plus advice threads pushing reply-first growth with real engagement ([@RK_dreamy, 594 impressions](https://x.com/RK_dreamy/status/2074946292229493203)).
- **The auto-reply conversation is dead.** 7-day X search for auto-reply/reply-automation/Fireply: 3 hits, none organic, zero Fireply mentions. The category X killed doesn't even get talked about anymore — negative space confirming the kill.
- Suspension anxiety is **ambient this week**: *"Went in one thread. Half the replies were suspended. Very odd week."* ([@HooBrown, 2026-07-08](https://x.com/HooBrown/status/2074971414218649778)); a user reinstated after *"4 wks… many appeals"* ([@AustinM425](https://x.com/AustinM425/status/2074950256068849919)); another *"suspended 3 weeks ago… so tired of that email bot replies"* ([@nhsco2016](https://x.com/nhsco2016/status/2074922265813061754)). The 07-07 doc said safety-driven tool choice was unconfirmed; it's now confirmable from live first-person data — **account-safety copy graduates from A/B-test to headline claim**, sourced.
- Reply workflow poverty, live: *"X can't reliably let you find your own recent reply to a major account, that's a pretty basic failure"* ([@urbest_body](https://x.com/urbest_body/status/2074898674904449439)) — supports the Radar queue's replied-state tracking and the outcome loop (we *can* find, track, and attribute your replies).
- Algorithm literacy is mainstream: *"The algorithm (now Grok-powered) pushes content that sparks replies and depth, not spam or low-effort posts"* ([@NealFrazierTech](https://x.com/NealFrazierTech/status/2074867923735187657)) — the market now educates itself on our core claim; receipts-based positioning costs less than it did in January.

## 4. The official rule text is broader than the press coverage — second compliance flag

Fetched from the [X staff announcement itself](https://devcommunity.x.com/t/update-to-reply-behavior-in-x-api-v2-restricting-programmatic-replies/257909) (2026-02-23): beyond the reply restriction, the API now also restricts **programmatic @mentions and quotes in ALL post creation**: *"you may only @mention and quote users if they are already involved in any ongoing context… restrictions on unsolicited @mentions and quotes will prevent spammy outreach."* Self-serve tiers only; *"Enterprise access levels are not impacted"* (no "Public Utility app" exemption appears in the official text — that was secondary-source language).

**Implication for us, wider than Reply Desk:** any *normal post* we publish via API that tags an account the user isn't already in conversation with can be rejected. Audit every publish path (posts, threads, quote-posts, MCP `publish_post`/`publish_thread`) for unsolicited-mention handling, not just replies. Extension/native-composer remains the universal safe route.

## 5. Competitive temperature (current)

- **Typefully affection persists in real time** — *"By far, @typefully has one of the best editors for drafting posts"* ([@RoyedOrg, 2026-07-08](https://x.com/RoyedOrg/status/2074931592360075528)) — and users run **fragmented stacks**: *"Hypefury still for X. Taplio for LI. WriteStack for substack"* ([@MCovBrown](https://x.com/MCovBrown/status/2074931171600036125)). Nobody owns the writing surface + coaching + replies together; the fragmentation is the opening.
- **Scorer-lane crowding continues at hobby scale:** two more Show HN builders scoring X posts against the open-source algorithm ([Claude skill](https://news.ycombinator.com/item?id=46691397), [X Post Analyzer](https://news.ycombinator.com/item?id=46700665)) — both 1-point launches, but builders #6 and #7 on the same idea. The window for owning "your score, explained, from *your* data" is real but narrowing.
- **Grok fatigue is a wedge, not a threat:** users block it (*"annoying as f**k"*), and its assist is generic by construction. The trigger is also as raw as ever, live: *"0 views, 0 likes, day 29"* ([@StarGMR1908](https://x.com/StarGMR1908/status/2074970866950021236)); HN this week: *"I can build anything, but only the void sees it"* ([48787370](https://news.ycombinator.com/item?id=48787370)).

## 6. TRUE-signal PMF verdict — where validated and defensible converge

Ranked by (current demand × structural defensibility × our head start):

1. **Reply Radar (curation + coaching, extension-delivered).** Demand is the mainstream playbook *this week*; the automated alternative is policy-dead and discourse-dead; pooled-sweep economics and the outcome loop are ours alone. **The 2026 evidence makes this the clearest PMF lane in the product.** Precondition: the §4 compliance audit and native-composer delivery.
2. **Voice fingerprint + provenance ("written by you, coached — provably").** Moderators, professors, and platforms are all converging on authorship proof; Grammarly's Authorship shows the direction; communities now punish even AI-*edited* text. Our own-analytics voice loop plus a provenance receipt is defensible against both generic assistants and Grok-in-composer.
3. **The "sounds-like-AI" lint / pre-publish score** — newly demand-validated (§1) and cheap to ship from existing pieces; the differentiator is personal-rubric grounding. Treat as the activation hook inside the live assistant, not a standalone product.
4. **Custom trackers** — unchanged from the main synthesis (validated, parity-risk): ship inside Radar's pipeline, differentiate via reply-composer integration.

**Feature adds/tweaks queued by this addendum:** (a) sounds-like-AI lint dimension in live assistant (§1); (b) provenance receipt in the Voice Report (§2); (c) unsolicited-mention compliance audit across all publish paths (§4); (d) replied-state/outcome tracking marketed as fixing X's own broken reply retrieval (§3); (e) safety copy sourced from live suspension quotes (§3).

**Method note for repeatability:** this sweep is re-runnable any week for ~60 credits + zero-cost HN/dev-forum pulls; the X 7-day window means monthly runs would build a rolling first-person 2026 corpus that Reddit can no longer give us.
