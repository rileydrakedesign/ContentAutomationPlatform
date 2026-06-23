# Phase 3 — Feature → ICP → JTBD Mapping

> **Status:** Internal, code-grounded (reconciled against current repo, not the older `PRODUCT_FEATURES.md`). Serves product prioritization. ICP lenses are the candidates from Phases 0–1, not yet the final ICP (that's Phase 5).
> **Date:** 2026-06-19

---

## 3.0 Correction to Phase 0 (important)

Phase 0 framed the product as "two products" — a legacy extension *outside* the credits/MCP world vs. the new agent voice-tuner. **Code reconciliation corrects this:** the Chrome extension is **actively maintained (v1.3.0) and runs on the shared v1 credits + voice system** (`/api/generate-reply` + `/api/voice/check`, ~6 cr/reply; it no longer calls the dead `/api/capture`). **All four surfaces — web, extension, v1 REST, MCP — now converge on one assembled voice context (`getAssembledPromptForUser`), one credit currency, one reply engine (`findReplyTargets`), one analytics pool.** The cohesiveness/close-the-loop work did its job. The strategic question is no longer "two products" but "**which ICP do we point this one cohesive product at.**"

---

## 3.1 ICP lenses used
- **C1 — Deliberate Creator** (solo, 500–50K followers, posts for distribution)
- **C2 — Reply-Growth Operator** (growth via replying to bigger accounts; Opportunity-Score persona)
- **C3 — Ghostwriter / Agency** (manages many client accounts; highest WTP per Phase 1)
- **C4 — Agent-Builder** (wires AFX into an agent via MCP/API; distribution not revenue)

Tier key: **WEDGE** (daily-driver, reason-to-buy) · **RETENTION** (compounding lock-in) · **SUPPORT** (necessary, not why they buy) · **ORPHAN** (built, not connected to the loop).

---

## 3.2 Feature → JTBD → ICP matrix

| Feature (shipped) | Job-to-be-done | Cares most | Tier |
|---|---|---|---|
| **Voice system** (settings, examples, `get_writing_context`, assembler) | "Make everything I post sound like *me*, automatically" | C1, C3 | **WEDGE** |
| **`check_draft` / ambient voice-check + publish gate** | "Tell me before I post whether this is off-voice; don't let me ship slop" | C1, C2, C3 | **WEDGE** |
| **Engagement-weighted pattern extraction** (`run_tuneup`, `list_patterns`, multipliers) | "Show me what actually works *for my account* and bake it into my writing" | C1, C3 | **WEDGE** (the moat — Phase 2) |
| **Reply finder** (`find_reply_posts` / `/reply` / Opportunity Score) | "Find the highest-value posts worth my reply, fast" | C2 | **WEDGE** (for C2) |
| **Voice-faithful reply generation** (`generate_reply`, extension) | "Write a reply that sounds like me and won't get me flagged" | C2 | **WEDGE** (for C2) |
| **Chrome extension** (in-timeline replies, save, score) | "Do it where I already am, without leaving X" | C1, C2 | **RETENTION** (daily-use habit hook) |
| **Publishing & scheduling** (`publish_*`, `schedule_post`, queue) | "Get it out / plan my week without babysitting" | C1, C3 | **SUPPORT** (table stakes; commoditized) |
| **Analytics + sync + best-times** | "Know what's working and when to post" | C1, C3 | **RETENTION** (feeds the loop) |
| **Niche analysis & positioning** (`get_niche`) | "Keep my content on-topic and on-position" | C1, C3 | **RETENTION** |
| **Strategy / weekly targets** (`get/update_strategy`) | "Hold myself to a cadence" | C1 | **SUPPORT** |
| **Inspiration** (`add/list_inspiration`, library, promote) | "Save posts that work and learn from them" | C1, C2 | **SUPPORT** (gateway/onboarding hook per old marketing doc) |
| **Feedback loop** (`send_feedback` → prompt) | "Make it learn my preferences over time" | C1, C3 | **RETENTION** |
| **Cold-start bootstrap** | "Be useful before I've configured everything" | all (onboarding) | **RETENTION** (activation — see Phase 6) |
| **MCP server (36 tools) + hosted OAuth** | "Let my agent do all of this in my voice, metered safely" | C4 | **WEDGE for C4 / channel** |
| **v1 REST API + per-key scopes** | "Programmatic, permissioned access" | C4 | **SUPPORT (for C4)** |
| **Credits system + transparent metering** | "Pay only for what costs money; no bait-and-switch" | all | **SUPPORT** (trust differentiator — Phase 2) |

---

## 3.3 The wedge feature per ICP

| ICP | Daily-driver wedge | Why |
|---|---|---|
| **C1 Deliberate Creator** | **Voice system + visible pattern extraction** (the "sounds like me AND like what works for me" loop) | Phase 2's #1 unmet need; the moat competitors can't fake |
| **C2 Reply-Growth Operator** | **Reply finder (Opportunity Score) + account-safe voice replies, in-timeline** | Unique mechanic; now a *survival* story post-May-2026 suspensions |
| **C3 Ghostwriter / Agency** | **Voice fidelity across many accounts** (their #1 documented pain: voice drift) | Highest WTP; but **blocked by a gap — no multi-account support** (see 3.5) |
| **C4 Agent-Builder** | **MCP voice layer** (`get_writing_context` + `check_draft`) | The one thing free MCP servers don't have — but channel, not revenue |

**Cross-ICP truth:** the *voice fidelity + own-analytics loop* is the wedge for 3 of 4 ICPs (C1, C3, and the "write in voice" half of C2/C4). It is the spine of the whole product. Everything else is support or channel.

---

## 3.4 Orphans & cleanup candidates (deprioritize / cut)

| Item | Status | Recommendation |
|---|---|---|
| Voice memo / transcript / audio ingestion | Legacy dead code | **Delete** — confirmed dead, app is X-only |
| Instagram Reels / `REEL_SCRIPT` | Already removed | Done |
| `/api/capture` endpoint | Dead (extension no longer calls it) | **Delete** |
| BullMQ publish pipeline | Dead (QStash is canonical) | **Delete** |
| Niche-accounts watch | Orphan — backend exists, no UI, not in loop | **Decide: finish or cut.** Lean cut unless it feeds C2 reply targeting |
| Possible duplication: extension **client-side Opportunity Score** vs server-side **`findReplyTargets` traction ranking** | Two scoring implementations | **Reconcile** — unify on the server-side score so the number is consistent and improvable (Pro-gated V2 was already a roadmap idea) |
| Public v1 API (live but unmarketed, "cut from v1" in BACKLOG) | Shipped, hidden | **Decision tied to C4** — if agent-builders are a real channel, this is the front door; market it. If not, leave dormant |

**Why cutting matters for this project:** dead code dilutes the "X-only voice tuner" story and adds QA surface. Every orphan is a thing the ICP doesn't need.

---

## 3.5 ICP needs with NO adequate feature (gaps to build)

Ranked by leverage on the validated ICP needs from Phases 1–2:

1. **DEMONSTRABLE voice depth (the "show, don't tell" proof).** *Highest leverage.* Phase 2's core GTM problem: buyers can't tell analytics-driven from style-mimicry, so they price us against PostOwl's $9.99. The Voice Report exists (`/insights`) but needs to *visibly* show **"this proven pattern came from *these* top posts, with this engagement multiplier"** — ideally shareable. This converts the moat from a claim into a felt experience. → Critical for C1/C3 and onboarding.
2. **Multi-account / agency capability.** *Highest WTP segment is blocked.* C3 (ghostwriters/agencies) scored top on WTP in Phase 1, and their #1 pain *is* our wedge — but the product is single-account; the $79 "Agent" tier is single-profile. No client roster, no per-client voice switching surfaced, no approval workflow, no white-label. → Build a multi-account/agency tier to unlock the high-ACV expansion (Hypefury Agency $199 proves the price).
3. **Account-safety as a first-class, surfaced feature.** *Now a buying criterion.* The pieces exist (human-in-loop, voice-check gate, no keyword auto-reply), but safety isn't *surfaced* as a guarantee/feature. C2 buyers are scared of suspension (May 2026 wave). → Make "account-safe by design: human-approved, relevance-gated, never auto-spam" an explicit, visible promise.
4. **Outcome/results attribution ("did this actually grow me?").** *Empty lane — nobody proves results.* Analytics show metrics but don't close the loop to "the posts written *with AFX* outperformed your baseline." Phase 2 found *no competitor credibly demonstrates results.* → A simple "your AFX-assisted posts vs. your average" view would be a unique proof and a retention/word-of-mouth driver.
5. **Publish-ready output / in-editor tone & length controls.** *Moderate.* Reduces the "I spend twice as long editing" churn driver; some controls exist but reviewers want tone/length/CTA/emoji toggles inline.

---

## 3.6 Prioritization read-out (for the brief)

- **Protect and deepen the spine:** voice fidelity + own-analytics pattern extraction + the write-against-context/voice-check loop. This is the wedge for nearly every ICP and the only thing competitors can't quickly copy. Invest in making its depth **visible** (gap #1).
- **The biggest *unbuilt* opportunity is C3 (agency/multi-account)** — highest WTP, pain = our wedge, currently blocked by a single-account limitation. This is the clearest "build to unlock revenue" call.
- **C2 (reply-growth) is the sharpest self-serve beachhead** — already well-served by shipped features; the missing piece is *surfacing account-safety* (gap #3) and unifying the Opportunity Score (orphan reconciliation).
- **C4 (agent-builder) needs almost no new build** — the surface exists; the decision is whether to *market* the v1 API/MCP as a channel (cheap to do, distribution upside) without over-investing (it's not the revenue engine per Phase 1).
- **Cut the dead code** (voice memo, `/api/capture`, BullMQ, niche-accounts) to keep the "X-only voice tuner" story clean.

→ Feeds Phase 5 (which ICP is primary) and Phase 6 (the activation moment is almost certainly the first time the user *feels* "this sounds like me" — gap #1 made visible).
