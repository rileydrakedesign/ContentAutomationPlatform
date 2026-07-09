# Refactor Handoff — Reply-First Growth Coach (2026-07)

> Give this file to a fresh agent to begin the refactor. It is self-contained: it tells you what the product is now, which docs are the source of truth, the exact first slice of code to touch (with `file:line` anchors), the acceptance gates, and the hard constraints.

---

## 0. Before you write any code — repo setup

The planning docs are canonical on **`origin/main`** (PR #8 merged 2026-07-09).

⚠️ **The local `main` is diverged and dirty** — it has 2 unpushed commits and ~166 uncommitted working-tree changes from a prior session. **Do not build on top of that state.** Start clean:

```bash
git fetch origin main
git switch -c refactor/reply-first-phase0 origin/main   # fresh branch off the REMOTE main
```

If the local tree's uncommitted work matters, that's a separate reconciliation the owner (Riley) must resolve first — do not clobber it. Confirm you're based on `origin/main` before proceeding (`git log --oneline -1` should show PR #8, "…product focus & core PRD (#8)").

---

## 1. What the product is now (read this first)

The product pivoted to a **reply-first growth coach for X**, resolved into three pillars connected by one loop:

```
① RADAR    — watches (topic / custom / account) → one ranked, bounded daily queue + real-time alerts
② COMPOSER — one assistant, one check bar (Algorithm • Voice • AI-sound), the user keeps the pen
      ↓ compliant handoff to X (intent prefill → extension assist → copy fallback)  — NEVER the API for replies
③ RESULTS  — per-reply outcomes (engage-back, profile clicks, impressions)
      → feeds back into Radar ranking and the voice rubric
```

**Why this shape (non-negotiable framing):** X killed automated replies at the API + enforcement level (Feb-2026), audiences punish AI-sounding text, and the open-source ranker favors replies the author engages with (~150× a like) and LLM-judges replies for slop. So the defensible lane is: **automate the *finding*, the human keeps the *writing*.** Any feature that auto-writes or auto-sends replies is anti-wedge and out of scope, permanently.

---

## 2. Source-of-truth docs (all on `origin/main`)

Read in this order:

| Doc | Why you need it |
|---|---|
| **`PRD_CORE_2026-07.md`** | The true PRD. Three pillars, numbered requirements (R1.x–R3.x), data-model delta (§6), UX skeleton (§9), 13-week rollout (§11), risks (§12). This is what you build against. |
| **`REPLY_RADAR_SCOPE.md`** | **Your primary engineering doc.** Real `file:line` references. Current-state inventory (§2), the gap list **G1–G8** with exact locations, Opportunity Score 2.0 (§4.3), data model (§4.2), phasing (§7 — Phase 0 hygiene → Phase 3). |
| **`PRODUCT_FOCUS_2026-07.md`** | Decision record — add/change/keep/drop (§6), the **C1–C6 change list** and Wk1–2 plumbing that define the first slice. |

**Architecture donor docs** (also on main — the existing systems you extend, do not rebuild):
- `GRAMMARLY_PIVOT_PLAN.md` — the existing **3-tier check engine** (§6) and Ship Score (§7) the check bar sits on.
- `GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md`, `GRAMMARLY_PIVOT_UX.md`
- `docs/architecture/voice-system.md` — voice construction the composer simplifies (§4.3 of the PRD).

**Evidence layer** (cite-only, don't need for coding): `research/market-scan/2026-07-pmf-validation.md`, `2026-07-true-signal-addendum.md`, `2026-07-reddit-signal.md`, `2026-07-direct-competitor-scan.md`.

---

## 3. Your first slice — Phase 0 hygiene

Per `REPLY_RADAR_SCOPE.md §7 Phase 0` and `PRODUCT_FOCUS §8 Wk 1–2`. These are **small, self-contained, no schema changes, shippable behind flags** — the correct entry point before the Radar sweep pipeline. Do them in this order; each has an acceptance test.

### Task A — G5: Unify the Opportunity Score (start here; highest-confidence)
There are **two divergent implementations** of the reply-opportunity score, despite docs claiming they're unified:
- Extension: `chrome-extension/src/content/content.js:120-127` → `likes×3 / rt×4 / replies×5`
- Server (canonical): `src/lib/utils/engagement.ts:26-40` → `likes×1 / rt×3 / replies×10`

**Do:** make the extension consume the **server-canonical** weights. Follow the *same "one source of truth + parity test" pattern already used for the engagement-bait lists* in `src/lib/analysis/x-algorithm.ts` (shared constant + a parity test that fails if the two drift). Also clears BACKLOG **EXT-8 / EXT-9** (rolling-normalization issues) while you're in there.
**Acceptance:** extension pill ordering === server ranking ordering on the same post set; a parity test guards it.

### Task B — G6: Make the extension assistant reply-aware
`chrome-extension/src/content/assistant-ui.js` mounts inside X's reply composer but never applies reply voice/context. The dashboard side already supports it (`/api/live-read`, `live-read/route.ts:49`, `voice_type:"reply"`).
**Do:** wire `voice_type:"reply"` + parent-post context into `assistant-ui.js` when it's mounted in a reply composer.
**Acceptance:** the live assistant in X's reply composer applies reply voice and reads the parent post.

### Task C — G7: Already-replied dedup
`findReplyTargets` (`src/lib/x-api/reply-targets.ts`) can resurface posts the user already replied to.
**Do:** filter out targets the user has already replied to from the results (discovery half of G7; the queue-state half comes in Phase 1).
**Acceptance:** a post the user has replied to never reappears in results.

### Task D — C1: Reply handoff v1 (intent prefill + copy fallback)
Per `PRD_CORE §4.4`. Replies **cannot** use the API. Implement the default + fallback tiers now (extension-assist tier is Wk 3–6):
1. **Intent prefill (default):** open `x.com/intent/post?in_reply_to=<target_id>&text=<reply>` — verified against official X Web Intents docs; zero API surface.
2. **Copy fallback:** copy composed text + open the post (covers the known mobile-app intent bug).
Persist a **handoff record** `{user, target_post_id, composed_text, watch_id, ts}` — this is the attribution key for Pillar ③ later.
Then **audit remaining API post/thread paths** for the Feb-2026 unsolicited-mention rule (flag, don't necessarily fix yet).
**Acceptance:** card → composed reply → X composer opens prefilled on the post; a handoff record is written; **zero** reply-publish API calls in telemetry.

---

## 4. Ship gates for Phase 0 (from the scope doc)

- Extension pill and server ranking **agree on ordering** (parity test green).
- Live assistant in the X reply composer **applies reply voice**.
- Repeat targets **don't resurface**.
- Handoff: reply reaches X's composer prefilled with **zero API reply-publish attempts** in telemetry.
- `tsc --noEmit` clean, existing test suite green, extension bundle builds.

## 5. Hard constraints — do not violate

1. **No auto-writing or auto-sending replies. Ever.** The human writes; we only automate finding + timing. This is the wedge.
2. **Replies never publish via the X API** — handoff (intent → extension → copy) only. Non-reply posts may still use the API *only where the Feb-2026 mention/quote rules permit* (audit required).
3. **Extend, don't rebuild.** The 3-tier check engine, voice system (`prompt-assembler.ts`), niche model (`niche-analyze.ts`), and `engagement.ts` already exist — build on them.
4. **One check bar, shared component** across dashboard + extension, guarded by a parity test (same pattern as the engagement-bait lists). Don't fork logic between surfaces.
5. **Open compliance item — do not code past it in later phases:** pooled/app-level reads vs X ToS (`REPLY_RADAR_SCOPE.md §4.5, §11.1`) is the **#1 unresolved question and gates any Radar sweep-pipeline (Phase 1) work.** Phase 0 above does not touch it, but flag it loudly before starting Phase 1.

## 6. What NOT to do in this session

- Don't start the Radar **sweep pipeline / schema** (`sweep_units`, `candidate_posts`, `user_target_queue`) — that's Phase 1, and it's blocked on the compliance read (§5.5).
- Don't redesign the voice-construction UI yet (that's the Wk 3–6 trait-card work).
- Don't reconcile the diverged local `main` — leave that to the owner.
- Don't delete the voice-memo/transcript pipeline yet (scheduled for a later cleanup PR, UI-first).

## 7. When you're done

Open a PR titled something like `feat(reply): Phase 0 hygiene — score unification + reply-aware assistant + handoff v1`, list which of Tasks A–D landed, paste the acceptance-gate results, and note anything you deferred. Branch off `origin/main`; do not force-push over the owner's local commits.
