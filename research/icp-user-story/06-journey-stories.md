# Phase 6 — User Journey & User Stories

> **Status:** Synthesis of Phases 0–5. Built for the PRIMARY ICP (the Build-in-Public Founder/Operator); agency notes where they diverge.
> **⚠️ Pending Reddit validation:** Trigger narratives and the activation-friction points lean on IH/HN/Substack (Reddit blocked). The journey *shape* is well-grounded; emotional intensity at the trigger and onboarding steps should be confirmed with an authenticated Reddit pass.
> **Date:** 2026-06-19

---

## 6.1 End-to-end journey (primary ICP)

| Stage | What's happening | Emotion | Friction / risk | Our lever |
|---|---|---|---|---|
| **1. Trigger** | Shipped → crickets; or growth plateaued ("same posts, fewer views"); told "build in public." | Frustration, mild desperation, self-doubt | They may blame themselves and quit, not seek a tool | Meet the trigger language in copy: "shouting into the void," "remove the blank page" |
| **2. Discovery** | Sees us on X (#buildinpublic), IH, a creator they follow, or the Chrome Web Store. | Skeptical (category is "Ponzi-ish," course-burned) | Distrust of growth tools; "is this another grift?" | Dogfood proof (we grew *with* this); demonstrate, don't claim; transparent pricing |
| **3. Evaluation** | "Will this actually sound like me? Is it worth $29 on top of X Premium?" Compares to ChatGPT (free) and PostOwl ($9.99). | Hopeful but guarded | Can't tell us from $9.99 style-mimicry on a feature list | **Visible Voice Report** as the eval artifact: "these patterns came from *your* top posts ×N" |
| **4. Onboarding** | Connects X / uploads analytics CSV; the system tunes voice + extracts patterns. | "Show me it gets me" | **Cold-start**: thin history → generic output → bounce (Typefully's documented weakness) | **Cold-start bootstrap** + import existing tweets; set expectations |
| **5. Activation ("aha")** | First time they generate/check a post or reply and think **"yes, this sounds like me."** | Relief, delight, "finally" | If first output is generic, they churn immediately ("AI mush") | This is the north star — see 6.2 |
| **6. Habit** | Daily in-timeline use: reply-finding (building stage) or drafting (distribution stage); voice-check before posting. | Confidence, momentum | Quota frustration (free 5/day); spending credits without seeing growth | In-timeline extension (where they already are); account-safety reassurance |
| **7. Expansion** | Hits free limits → upgrades to Pro; later syncs analytics, uses run_tuneup, schedules. | Investment, trust | "Am I using it enough to justify it?" (ROI gate) | Show outcome attribution ("your AFX posts vs. your baseline") |
| **8. Advocacy** | Posts about results, recommends on X/IH; (technical subset) connects an agent via MCP. | Pride | Only happens if results are real and visible | Make wins shareable (Voice Report / results card); the dogfood flywheel |

**Riskiest step: #5 (Activation).** Everything before it is acquirable with copy and proof; everything after depends on the user *feeling* voice fidelity on first contact. If the first generated/checked output is generic, the #1 fear ("AI mush") is confirmed and they leave. **The product's success hinges on the first "this sounds like me" moment landing fast.**

**Second-riskiest: #4 (Cold-start).** Voice fidelity needs the user's data; a thin-history user gets generic output and never reaches activation. Cold-start bootstrap is the bridge — it must be good.

---

## 6.2 Activation moment & north-star metric

**Activation moment:** *The user generates or voice-checks their first post/reply and recognizes it as their own voice* — operationally, **"first voice-checked content the user accepts/publishes within session 1."**

**Proposed north-star metric:** **Time-to-first-"sounds-like-me"** — % of new users who produce ≥1 accepted, voice-checked post or reply in their first session (target >50%, per the primary-ICP hypothesis).

**Supporting metrics:**
- Activation rate by acquisition source (tests the ICP/channel fit).
- Voice-check acceptance rate (proxy for "did it sound like me?").
- Reply-loop completion (building stage): % of `find_reply_posts` → published reply.
- Outcome signal (retention driver): AFX-assisted posts vs. account baseline engagement.

---

## 6.3 Prioritized user stories

Format: *As a [persona], I want [job], so that [outcome].* Priority: **P0** = activation-critical · **P1** = retention/expansion · **P2** = supporting. Mapped to existing features (✅ shipped) or gaps (⚠️ from Phase 3).

### Activation (P0)
1. *As a build-in-public founder, I want the tool to learn my voice from my existing tweets quickly, so that the very first draft already sounds like me.* → ✅ voice system + ⚠️ cold-start must be strong
2. *As a skeptical evaluator, I want to see proof that the suggestions come from MY best-performing posts, so that I trust this is different from generic AI.* → ⚠️ **Gap #1: visible/shareable Voice Report** (highest leverage)
3. *As someone with blank-composer dread, I want a starting draft from a half-idea, so that the blank page is removed.* → ✅ generate + get_writing_context
4. *As a careful poster, I want to know before I publish whether this is off-voice, so that I never ship something that sounds like a bot.* → ✅ ambient voice-check + publish gate

### Reply-growth job (building stage) (P0/P1)
5. *As a small-account operator, I want to find high-value posts worth replying to in the early window, so that I grow via borrowed reach without scrolling for an hour.* → ✅ `find_reply_posts` / Opportunity Score
6. *As a reply-growth user, I want my replies to sound like me AND add value, so that I'm not the cringe "reply guy."* → ✅ reply voice + check_draft
7. *As someone scared of suspension, I want assurance the tool won't get me flagged (human-approved, relevance-gated, paced), so that I can grow safely.* → ⚠️ **Gap #3: surface account-safety as a feature/promise**

### Distribution job (growth stage) (P1)
8. *As a deliberate creator, I want to keep a consistent posting cadence while building, so that I don't fall off.* → ✅ strategy + schedule + queue
9. *As a creator, I want to know what's actually working for me and do more of it, so that effort converts to growth.* → ✅ analytics + patterns + run_tuneup
10. *As an ROI-gated buyer, I want to see that my AFX-assisted posts outperform my baseline, so that I can justify the subscription.* → ⚠️ **Gap #4: outcome attribution** (empty lane)

### Expansion / trust (P1/P2)
11. *As a course/tool-burned buyer, I want transparent pricing where I only pay for what costs money, so that I don't feel nickel-and-dimed.* → ✅ credits + the "URL posts = 30cr because X bills ~13×" explanation
12. *As a technical creator, I want my agent (Claude) to draft/post in my voice with me approving, so that I stay consistent hands-off but in control.* → ✅ MCP + check_draft (sell as outcome, not plumbing)

### Agency (secondary ICP) (build-to-unlock)
13. *As a scaling ghostwriter, I want isolated per-client voice profiles, so that my clients' voices never bleed into each other.* → ⚠️ **Gap #2: multi-account**
14. *As a ghostwriter, I want to onboard a new client's voice fast and prove it matches, so that I cut revision rounds and raise my client ceiling.* → ⚠️ guided voice onboarding + per-client Voice Report
15. *As an agency, I want client approval workflow + white-label reporting, so that I look professional and stop chasing approvals in Slack.* → ⚠️ multi-account governance

---

## 6.4 What the journey says to build next (priority order)
1. **Make voice depth *visible* (Gap #1)** — the Voice Report as the eval + activation artifact. Highest leverage on the riskiest step (activation) *and* the core GTM problem (telling us apart from $9.99 mimicry).
2. **Harden cold-start (step #4)** — the bridge to activation for thin-history users.
3. **Surface account-safety (Gap #3)** — cheap, and converts a fear into a reason-to-buy for the reply-growth job.
4. **Outcome attribution (Gap #4)** — the retention/advocacy driver nobody else has.
5. **Agency multi-account (Gap #2)** — the high-ACV expansion; build deliberately, proof-gated, after the primary loop is humming.

---

## 6.5 Cross-references
- ICP definitions & personas → `05-icp.md`
- Feature gaps referenced (Gaps #1–#4) → `03-features.md` §3.5
- Competitive "demonstrate don't claim" rationale → `02-competitors.md` §2.6
- Verbatim language for copy at each journey stage → `02-competitors.md` §2.7 + `04-discovery.md` §4.3
