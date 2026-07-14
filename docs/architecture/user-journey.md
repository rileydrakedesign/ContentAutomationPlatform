# The user journey through the loop

How our **ICP** actually moves through the product, and what we still need to
build to serve them. Grounded in the ICP & user-story research
([`research/icp-user-story/`](../../research/icp-user-story/), 2026-06-19) — see
[`BRIEF.md`](../../research/icp-user-story/BRIEF.md) and
[`06-journey-stories.md`](../../research/icp-user-story/06-journey-stories.md).

This is the narrative companion to the [parity matrix](loop.md#parity-matrix):
the matrix says *where* each loop stage lives on each surface; this says *how the
user travels it, what they feel, and where we're still short.*

---

## Who this is for (and the one metric that matters)

> **The ICP:** a solo founder/operator who lives on X to grow their product and
> personal brand, is anxious about sounding like generic AI, and will pay for a
> tool that makes everything they post and reply sound like *them* — and like
> what actually works for *their* account — with them in the loop.

They are **creator-primary**. The differentiated product is a **voice/identity
layer**; the MCP/agent surface is a **distribution channel**, not the buyer.

> **North-star: time-to-first-"sounds-like-me."** The % of new users who produce
> ≥1 accepted, voice-checked post or reply in their first session (target >50%).
> **Activation is the riskiest step** — everything before it is won with copy and
> proof; everything after depends on the first generated/checked output *feeling*
> like the user's voice. If it's generic, the #1 fear ("AI mush") is confirmed and
> they leave.

Design rule from the research: **demonstrate voice depth, don't claim it.** The
visible Voice Report ("these patterns came from *your* top posts ×N") is both the
evaluation artifact and the activation moment.

---

## The end-to-end journey

Each stage: what's happening · what they feel · our lever · where it lives ·
**status** (✅ shipped / ⚠️ gap — see [Alignment gaps](#alignment-gaps--what-to-add-or-change)).

### 1. Trigger — "I shipped and got crickets"
Plateaued growth, blank-page dread, "build in public" advice. Frustration + self-doubt.
- **Lever:** meet the language in copy ("shouting into the void," "remove the blank page"). Product-external (GTM), but the whole loop is the answer.

### 2. Discovery — "is this another growth grift?"
Sees us on #buildinpublic / IH / Chrome Web Store. Skeptical, course-burned.
- **Lever:** dogfood proof + transparent pricing. Product surfaces: the **credits** model ("pay only for what costs money; URL posts = 30cr because X bills ~13×") is a trust artifact. ✅ shipped.

### 3. Evaluation — "will it actually sound like me?"
Comparing us to ChatGPT (free) and PostOwl ($9.99). Hopeful but guarded; can't tell us from style-mimicry on a feature list.
- **Lever:** the **Voice Report** at `/insights` — niche, positioning, top patterns (content + multiplier), top posts.
- **Status: ✅ Gap #1 shipped.** Each top pattern now shows the user's own posts it was mined from + the engagement multiplier ("from these posts, ×2.4"), and the Voice Report is shareable as a public, branded card (`/share/{token}`). The depth is demonstrated, not claimed.

### 4. Onboarding (cold start) — "show me it gets me"
Connects X. Thin-history users risk generic output → bounce (Typefully's documented weakness).
- **Lever:** first-run **bootstrap**. `x/callback` → `/?connected=1` → `FirstRunAnalysis` → `POST /api/x/bootstrap` (timeline sync + full `runVoiceTuneup`), so session 1 shows real niche/patterns/top posts, no CSV. ✅ shipped (W5).
- **Status: ✅ hardened.** The bootstrap now returns a **voice-confidence** level (thin / building / good) from how many of the user's posts backed the tune; a thin-history result is flagged honestly and routed to a guided next step (import CSV / write a post) instead of a dead end. Confidence is also shown persistently on Voice Health.
- **MCP/API:** deliberate **N/A** — agents act on an already-connected account; first call is `whoami`.

### 5. Activation ("aha") — "yes, this sounds like me" ← the hinge
First generated/checked post or reply they recognize as their own voice. Relief, "finally."
- **Levers, all ✅ shipped:**
  - **Create in voice** — `/create`: one full post in view with **Regenerate** (optional one-off instruction; previous variations kept), each selected pattern shows its **actual content + engagement lift**, and each generated option lists the **patterns that shaped it**. MCP: `get_writing_context` (write it yourself, free) / `generate_post`. API: `POST /drafts/generate`.
  - **Optional voice-check** — the draft editor (`/drafts/[id]`) and `/reply` offer a one-click 0–100 voice score with a suggested edit, but **never block publishing**: every surface has a direct **Post** and a secondary **Voice-check first**. MCP: `check_draft` (separate, optional). API: `POST /voice/check`.
- **Status:** mechanically shipped; **fidelity is the bet.** The north-star metric (voice-check acceptance in session 1) is the post-launch test that this actually lands.

### 6. Habit — daily in-timeline use
Reply-finding (building stage) or drafting (distribution stage); voice-check before posting.
- **Reply-growth job (the C2 beachhead), ✅ shipped:** `/reply` and the **Chrome extension** find **only repliable** posts (server eligibility via `findReplyTargets`, audited reply-settings mapping + graceful publish-time 403 handling), ranked by traction; reply in the **reply-voice**; **optional** voice-check before send (Post reply / Voice-check & reply). MCP: `find_reply_posts` → `generate_reply` → `[check_draft]` → **handoff via the target's `intent_url`** (there is no reply-publish tool). API: `GET /search/reply-targets` → `POST /drafts/generate` → `[POST /voice/check]` → open `intent_url` + `&text=…` (`POST /publish/now` returns 410 for `X_REPLY`).
- **Status: ✅ Gap #3 + orphan shipped.** Account-safety is now surfaced as an explicit promise on `/reply` and in the extension picker ("human-approved, relevance-targeted, never auto-spam; only ever posts you can reply to"). The extension's Opportunity Score now uses the **canonical** weighted-engagement / age-decay formula — the same signal the server's `findReplyTargets` ranks by, so the number is consistent and improvable in one place.

### 7. Expansion — hits limits, upgrades, invests
Free 5/day → Pro; syncs analytics; `run_tuneup`; schedules. "Am I using it enough to justify it?"
- **Levers:** the flywheel keeps the loop fresh automatically (daily `daily-ops` loop-upkeep refreshes published-post metrics, re-ranks examples — a shipped post influences the pool within ~1 day, no CSV ✅ W1); the **persistent re-tune nudge** + **Next Best Action** orient the user (✅ W4).
- **Status: ✅ Gap #4 shipped.** **Outcome attribution** now compares AFX-assisted posts vs. the user's baseline (avg weighted engagement + lift %), on the dashboard and in `GET /analytics` for agents. It only shows a verdict once there's enough data, so it never over-claims.

### 8. Advocacy — shares results, recommends, (technical subset) wires an agent
Pride. Only happens if results are real and visible.
- **Lever:** make wins shareable (Voice Report / a results card) → ties back to Gap #1 and Gap #4. The **MCP** surface is where the automator subset lives — sold as the creator outcome, not plumbing.

---

## The loop underneath

The journey runs on one compounding loop — **insight → create-in-voice → check →
find/reply → ship → ingest → re-tune** — identical across dashboard, API, and MCP
because they share the same core libs (`findReplyTargets`, `runVoiceCheck`,
`posts-pool`, `prompt-assembler`). The "two products" risk is **closed**. For the
exact stage-by-stage surface mapping (and the two deliberate N/A cells), see the
[parity matrix](loop.md#parity-matrix).

---

## Alignment gaps — shipped

All gaps from the research ([BRIEF §9](../../research/icp-user-story/BRIEF.md),
[03-features §3.5](../../research/icp-user-story/03-features.md)) are now built.
Summary of what landed:

### ✅ Gap #1 — voice depth made *visible* (highest leverage; activation + GTM)
- **Pattern provenance.** The tune-up stores the user's own top posts each pattern
  was mined from (`extracted_patterns.source_post_examples`), and the Voice Report
  renders "Mined from N of your posts — including: …" with engagement, per pattern.
  Code: `src/lib/analysis/pattern-extract.ts`, `tuneup.ts`, `VoiceReport.tsx`.
- **Shareable card.** `POST /api/insights/share` mints an opt-in public token; the
  unauthenticated `/share/[token]` page renders a branded, screenshot-ready Voice
  Report (curated public fields only). Code: `src/lib/share/public-voice-report.ts`.
- **Surfaced at evaluation** via the cold-start bootstrap's "See your Voice Report".

### ✅ Cold-start hardened for thin-history accounts
- `POST /api/x/bootstrap` returns a **voice-confidence** level
  (`src/lib/analysis/voice-confidence.ts`); `FirstRunAnalysis` flags thin history
  honestly and routes to a guided next step (import CSV / write a post). Confidence
  is also a persistent badge on Voice Health.

### ✅ Gap #3 — account-safety surfaced
- An explicit safety promise on `/reply` and in the extension reply picker, leaning
  on the repliable-only filter (`findReplyTargets` / `search-mapping.ts`).

### ✅ Gap #4 — outcome attribution
- `getOutcomeAttribution` (`src/lib/analysis/attribution.ts`) compares AFX-assisted
  posts (now flagged `afx_assisted` at publish) vs. baseline; shown on the dashboard
  (`OutcomeAttributionCard`) and in `GET /api/v1/analytics` for agents.

### ✅ Opportunity Score unified + dead code cut
- The extension's local scorer now uses the canonical `weightedEngagement / ageHours`
  (the server's `tractionScore`) — one signal. Dead `/api/capture` removed; the
  voice-memo / BullMQ / niche-accounts paths were already gone (only stale copy
  remained, now fixed).

### ❌ Gap #2 — agency / multi-account tier (built, then cut)
- An **Agency** plan (`multiAccount`) with isolated per-client voice profiles shipped
  in 2026-06 and was **removed in the 2026-07 slim**: the module (`/agency`,
  `/api/agency/*`, `src/lib/agency/`), the `agency` plan tier, and the `multiAccount`
  feature flag are all gone. `PlanId` is now `free | pro | agent`. (The inert
  `agency_clients` migration is retained — migrations are append-only.) Multi-account
  is back on the backlog, not in the product.

### Out of scope / repel (anti-ICP)
Casual posters, mass-reply/autopost spammers, B2B brand teams, multi-platform
seekers, pure MCP devs expecting free. Don't build for them; repel them in copy.

---

## Cross-references
- Strategic verdict, wedge, positioning rules → [`BRIEF.md`](../../research/icp-user-story/BRIEF.md)
- Full journey table + user stories + activation metric → [`06-journey-stories.md`](../../research/icp-user-story/06-journey-stories.md)
- Feature→ICP→JTBD matrix + gap detail → [`03-features.md`](../../research/icp-user-story/03-features.md)
- ICP definitions & personas → [`05-icp.md`](../../research/icp-user-story/05-icp.md)
- Where each loop stage lives on each surface → [loop.md](loop.md)
