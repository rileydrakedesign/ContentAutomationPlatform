# Agents For X — Product Requirements (Master PRD)

> **The canonical product definition.** Forward-looking source of truth for *what* we are
> building and *why*. Engineering "how" lives in [`docs/features/`](../features/README.md);
> strategy/GTM lives in [`research/`](../../research/README.md); the original pivot design
> rationale lives in the root pivot specs (see [§13](#13-source-of-truth-pointers)).
>
> **Status:** Assistant-primary mode **live in production** (assistant on by default,
> editor is the front door of `/create`). · **Updated:** 2026-06-26 · **Owner:** Riley

---

## 1. The product in one paragraph

**Agents For X is a real-time writing assistant for X (Twitter).** You write your own posts
and replies, and as you type, the assistant shows you where the post **drifts from your
voice** and where it will **lose to the algorithm** — grounded in *your own top-performing
posts* and *how X actually ranks* — then fixes both in one click. AI generation still
exists, but it is demoted to an optional **on-ramp** that seeds the editor with a first
draft you then own and refine. The human always keeps the pen.

**Frame of reference (internal shorthand):** *"It's Grammarly, but instead of grammar it
checks whether your post sounds like you and whether the algorithm will actually show it."*
Use the Grammarly analogy only as a comprehension shortcut in dense channels — never as the
public tagline (see `research/marketing-positioning/00-positioning-and-pivot.md`).

## 2. The problem — the two opacities

Everything we sell resolves to lifting **two fogs** between a creator and growth on X:

1. **Voice opacity** — you can't tell if what you wrote sounds like *you* or like a machine
   until a reader sneers or the post falls flat. Raw ChatGPT made this worse: confident,
   clean, soulless.
2. **Algorithm opacity** — you can't tell why one post hit 50K and the next got 200 views.
   Ranking is a black box; growth advice is folklore; analytics show numbers, never *lessons*.

The product **collapses both fogs into the moment of writing** — a heads-up display for the
two invisible forces that decide whether a post lands. Every underline cites the real X
mechanism (e.g. *a reply ≈ 27× a like*) or *your* pattern multiplier (*your "question hook"
→ 2.3×*). We don't just claim the black box is open — we show you inside it as you type.

## 3. Positioning & category

We sell a **"real-time writing assistant for X,"** not an "AI content generator." This is a
deliberate category move: "AI generator" triggers the market's #1 fear (AI slop);
"writing assistant" triggers trust. It also reframes the competitive set away from the
crowded "X growth AI" bucket (Tweet Hunter, Postwise, Hypefury) into a category of one.

**Canonical positioning statement** (everything inherits this):

> For the solo founder, operator, or ghostwriter who grows on X and is anxious about
> sounding like generic AI, **Agents For X** is a real-time writing assistant that, as you
> type your own posts and replies, shows you where they drift from your voice and where
> they'll lose to the algorithm — and fixes both in one click. Unlike AI ghostwriters that
> hand you a generic draft to approve (and unlike analytics tools that just *show* you
> numbers after the fact), it keeps **you** the author and grounds every suggestion in the
> X algorithm's real mechanics and your own top-performing posts.

**The three nouns the brand owns:** *your voice · the algorithm · your patterns.*

## 4. Who it's for (ICP)

Full detail in `research/icp-user-story/`. In brief:

| Tier | Who | Why |
|---|---|---|
| **Primary** | Build-in-Public Founder / Operator (solo, 500–50K followers) | Cheapest CAC, perfect feature fit |
| **Secondary** | Scaling Ghostwriter / Small Agency | Highest WTP; "voice drift across clients" *is* our wedge |
| **Channel/future** | Creator-who-automates (MCP) | Distribution wedge, not the buyer |

**Anti-ICP (repel in copy):** casual posters, mass-reply/autopost spammers, B2B brand teams,
multi-platform seekers, free-expecting MCP devs.

## 5. Surfaces — one engine, many skins

One backend, one voice context, one currency, one engine — exposed through:

- **Web app** — the primary surface. Dashboard (analytics home) + **the assistant editor**
  (`/create` Write tab, `/drafts/*`).
- **Chrome extension** — injects the assistant into X's own compose/reply boxes.
- **MCP server + v1 REST API** — the agent/integration surface (write + check loop).

The check engine is identical everywhere; only presentation density changes.
See [`docs/features/`](../features/README.md) for each.

## 6. The core experience

**Mental model:** *AI proposes a first draft (optional); the human writes the post; the
assistant keeps it on-voice and on-algorithm.*

**Primary flow (the editor is the front door):**
1. User lands in the **assistant editor** (blank or seeded). The assistant is live.
2. As they type: **instant** deterministic underlines (links, bait, reply-hook, length) +
   a live **Reach** sub-score (Tier 0, free, every keystroke).
3. On a typing pause (~1s): **Voice Match** + **Performance** scores fade in (embeddings,
   cheap, unmetered).
4. On demand (panel open / low score+idle / "why?"): an LLM **Live Read** returns anchored
   **voice-drift** findings, **missing-pattern** chips, and rewrites.
5. Each finding is a card: *what · why (grounded) · Accept (one-click fix) · Dismiss.*
6. A single **Post Score** (blend of voice + performance + reach) the user learns to push up.

**On-ramps (generation, demoted):** "Start blank," "Give me a starting point" (single-shot
generation), "From an inspiration post" — each **seeds the editor**, never a separate
destination. (The multi-step "Research a draft" agentic chain was retired in 2026-07.)

## 7. Feature scope

Each subsystem has an engineering source-of-truth doc in [`docs/features/`](../features/README.md):

| Area | Doc |
|---|---|
| Real-time writing assistant (L0–L3 engine) ⭐ | [writing-assistant.md](../features/writing-assistant.md) |
| Generation on-ramps (single-shot / Refine) | [generation.md](../features/generation.md) |
| Voice engine (dials, examples, patterns, niche, tune-up) | [voice-engine.md](../features/voice-engine.md) |
| Analytics & insights (sync, attribution, X-algorithm model) | [analysis-and-insights.md](../features/analysis-and-insights.md) |
| Publishing & scheduling | [publishing-and-scheduling.md](../features/publishing-and-scheduling.md) |
| Reply finder & reply engine | [reply-finder.md](../features/reply-finder.md) |
| Billing, plans, quota & credits | [billing-plans-and-credits.md](../features/billing-plans-and-credits.md) |
| Chrome extension | [chrome-extension.md](../features/chrome-extension.md) |
| MCP & public API | [mcp-and-public-api.md](../features/mcp-and-public-api.md) |
| X integration (OAuth, sync, media) | [x-integration.md](../features/x-integration.md) |

## 8. Money model

| Mechanism | What | How |
|---|---|---|
| **Tier-0 deterministic checks** | Always free, always on | Pure client-side JS, $0 |
| **Live LLM assistant (L2/L3)** | Subscription entitlement, **unmetered** | `requireFeature("writingAssistant")` — never consumes generation quota |
| **Generation** | Metered, daily quota slots | `requireAiGeneration` (1 slot per generation); Free 5/day, paid unlimited |
| **API/MCP surface** | Monthly credits | `CREDIT_COSTS` ledger |

Plans: **Free · Pro $29 · Agent $79** (the Agency tier was removed with the agency module, 2026-07). Detail + the one open lever
(`writingAssistant` is currently `true` on *all* plans incl. free; gating free to Tier-0-only
is available but not pulled) in [billing-plans-and-credits.md](../features/billing-plans-and-credits.md).

## 9. The wedge / moat

**The closed own-analytics voice loop:** engagement-weighted pattern extraction from the
user's *own* analytics → grounding both generation and the assistant → account-safe
publishing → re-tune. No competitor closes it. The pivot makes the wedge **demonstrated and
live** (every underline cites your data / the real mechanism) instead of claimed. Buyers
can't tell analytics-driven from $9.99 mimicry on a feature list — so depth must be *shown*,
and the live assistant *is* the demonstration.

## 10. Success metrics

- **North star:** % of published posts **written by the user** (vs accepted wholesale from
  generation) — the pivot's protagonist-inversion made measurable.
- **Activation:** *time-to-first-"sounds-like-me"* — % of new users who produce ≥1 accepted,
  voice-checked post in session 1 (target >50%).
- Suggestion **Accept rate** per category; **Dismiss / "show fewer"** rate (noise proxy).
- **Post Score lift** between first draft and publish (is the assistant improving posts?).
- Retention/WAU on the editor surface vs the old generation funnel.

## 11. Current state (2026-06-26)

**Shipped & live (assistant-primary mode is on):**
- Four-layer engine (L0 deterministic · L2 embeddings · L3 on-demand LLM) behind a
  now-default-on flag; ProseMirror decorated editor; panel/orb/hover cards.
- Editor is the front door of `/create`; generation seeds the editor as an on-ramp.
- Assistant endpoints unmetered (`requireFeature`); embeddings + calibration loop live.
- Extension shares the real TS engine via esbuild bundle (single source of truth).

**Deferred / open (see feature docs §"Current state & gaps"):**
- Plan-gating of free to Tier-0-only (lever exists, not pulled).
- L1 local WASM grammar/clarity; thread-level scoring; in-X fuzzy underlines hardening.
- MCP tool-catalog reframing (research has the positioning; the catalog lags).
  Landing surfaces were rewritten to the assistant story (2026-07-04).
- App root `/` is the analytics dashboard **by decision** (2026-07-04): nav is
  Write-first and onboarding ends in the editor, but returning users land on the
  dashboard. Revisit post-launch if editor WAU says otherwise.
- Seams closed 2026-07-04: URL detection unified (one `LINKED_TLDS`/`findLinks`
  in `tweet-text.ts` for counting, underlines, and billing); boost-opportunity
  scoring reconciled onto canonical `weightedEngagement`; reply finder rebuilt
  on the live assistant (in-app metered voice-check removed). Still open &
  intentional: in-app publish not metered (only v1/MCP is).

## 12. Non-goals

Multi-platform (X-only is a feature: "Built for X. Nothing else."); "10× volume" framing
(attracts churn, invites the AI-mush fear); brand/marketing-team voice; selling generation
as the hero; an always-on frontier LLM on every keystroke (cadence/cost discipline is core).

## 13. Source-of-truth pointers

- **Strategy / positioning / ICP / copy:** [`research/`](../../research/README.md) (maintained; do not duplicate).
- **Pivot design rationale (historical):** repo-root `GRAMMARLY_PIVOT_PLAN.md`,
  `GRAMMARLY_PIVOT_UX.md`, `GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md` — kept at root
  because `research/` references them by path. The handoff doc's bug/TODO list is **stale**
  (that work shipped); this PRD + the feature docs reflect current reality.
- **Engineering per-subsystem:** [`docs/features/`](../features/README.md).
- **Economics:** [`docs/business/`](../business/).
- **Plans/credits in code:** `src/types/subscription.ts`, `src/lib/billing/credits.ts`.
