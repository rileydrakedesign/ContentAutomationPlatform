# "Grammarly for Tweets" — Pivot Plan

**Status:** Plan parked for later (not in active build) · **Date:** 2026-06-24

**Decisions locked (2026-06-24):**
1. **Billing:** Tier-0 deterministic checks always free; live LLM checks (voice/performance/correctness) are a **subscription entitlement**, not per-call credits. Generation keeps its existing credit/slot model.
2. **Aggressiveness:** **Instant-free + debounced LLM** — Tier-0 runs on every keystroke; Tier-1/2 LLM checks auto-run ~3s after the user pauses (defended by hash-cache + rate cap). No "fully live" LLM-on-every-keystroke.
3. **Sequencing:** Plan only for now — revisit after current launch-readiness work ships. Phase 0 spike is the first build step when picked up.

**Owner:** Riley
**Deep UX spec:** see companion `GRAMMARLY_PIVOT_UX.md` (surfaces, highlight/score/badge taxonomy, hover-to-explain, cost/speed logic).

**One-line:** Flip the product so the **writer is the protagonist**. The user writes their own posts in a real-time assistant that underlines voice drift, algorithm risks, and missed patterns as they type — and offers one-click fixes. AI generation stays, demoted to an optional "starting point" on-ramp into that editor.

---

## 1. The core insight

You have already built the entire analysis engine. It is currently bolted onto the *output* of AI generation as post-hoc panels and buttons. The pivot is mostly **re-pointing the same signals at the user's cursor in real time**, not building new intelligence.

| Grammarly concept | What we already have | Where it lives |
|---|---|---|
| Correctness underlines | *(gap — see §6)* | — |
| "Sounds like you" | `runVoiceCheck()` → score + deviations + suggested edit | `src/lib/analysis/voice-check.ts:30` |
| Engagement / delivery | `computeAlgorithmFlags()` (deterministic) | `src/lib/analysis/prepublish-read.ts:126` |
| Performance score | `runPrepublishRead()` → resemblance + matched/missing patterns | `src/lib/analysis/prepublish-read.ts:210` |
| Tone/goals setup | 8 voice dials + guardrails | `prompt-assembler.ts:614` |
| Overall document score | voice score (0-100) + resemblance (0-100) | both above |
| Caching unchanged text | `voice_check_results` + `prepublish_reads` keyed by `draft_hash` | already persisted |

**Two things are genuinely missing**, and they define the real work:
1. **A decoration-capable editor.** Today the input is a plain `<textarea>` (`ComposeTextarea.tsx:46`) — HTML textareas physically cannot render inline underlines.
2. **Span anchoring.** Every analyzer today returns *prose strings* ("no reply hook", "drifts from your voice"). To underline, each finding must carry the **exact substring / character range** it refers to. This is the highest-leverage schema change in the whole project.

---

## 2. How Grammarly actually works (the model we're aligning to)

1. **Always-on, ambient.** It reads continuously as you type; you never "submit for review." Cheap checks fire on every keystroke; expensive ones are debounced to when you pause.
2. **Categorized underlines.** Issues are color-coded by class (correctness / clarity / engagement / delivery). The text stays fully editable underneath.
3. **Card per issue.** Each underline opens a card: what's wrong, *why*, a concrete suggested replacement, and **Accept** (one-click apply) / **Dismiss**.
4. **An overall score** that updates live and gives a sense of "is this good yet."
5. **Goals/tone** set the lens (audience, formality, intent) — Grammarly tunes suggestions to them.
6. **Tiered value.** Free = correctness; paid = the higher-judgment categories.

We mirror all six. The mapping to X:

| Underline class | Color | Source | Latency tier |
|---|---|---|---|
| **Correctness** (typos, grammar) | red | new (§6) | Tier 1 (debounced) |
| **Voice** (drifts from how you sound) | purple | voice-check deviations | Tier 2 |
| **Reach / Algorithm** (link penalty, no reply hook, engagement-bait, thread opportunity) | green | `computeAlgorithmFlags` | **Tier 0 (instant)** |
| **Performance / Patterns** (missing a high-lift pattern, low resemblance to your winners) | amber | prepublish-read | Tier 2 |
| **Clarity** (wordiness, weak hook, buried lede) | blue | deterministic lib + LLM | Tier 1/2 |

The "Goals/tone" pane is **the voice dials you already have** (`tone`, `energy`, `stance`, directness, humor, emoji, `optimization_authenticity`) — repositioned from a settings page into a contextual "Goals" affordance next to the editor.

---

## 3. Repositioning: from "generation tool" to "writing tool"

**Today:** `/create` opens on AI generation (Quick / Agent modes). The editor (`/drafts/new`) is a *handoff destination* you reach by clicking "Edit & Publish" on a generated draft.

**After:** The **editor is the home surface.** You land on a blank composer with the live assistant active. Generation becomes a set of **on-ramps that drop text into that editor**, never a separate destination:

- **"Start from a blank post"** (default) — just write; the assistant guides you.
- **"Give me a starting point"** — a lightweight, single-pass generation that *seeds the editor* with a draft you then own and refine. (Reuse `/api/drafts/generate-from-topic`, but the output lands as editable text under the live assistant, not as a card you approve.)
- **"Research a draft for me"** (power feature) — the existing agentic SSE pipeline (`post-pipeline.ts`), repositioned as "deep draft" rather than the centerpiece. Still streams the chain UI; on completion it *seeds the editor* instead of producing a final card.
- **"From an inspiration post"** — seed the editor with a draft modeled on a saved inspiration.

Mental model shift: **AI proposes a first draft; the human writes the post; the assistant keeps it on-voice and on-algorithm.** That is the defensible, "it sounds like me" wedge from your ICP research — and it's exactly where AI-generation tools feel hollow.

The `CLAUDE_ONLY` path, voice assembly, patterns, and credits all stay intact under the hood.

---

## 4. The new primary surface (information architecture)

```
┌─────────────────────────────────────────────┬──────────────────────┐
│  COMPOSER (decorated editor)                 │  ASSISTANT SIDEBAR    │
│                                              │                       │
│  > As you type, words get underlined ~~~~    │  Post Score   82      │
│    by class. Click an underline → card.      │  ───────────────────  │
│                                              │  ● Reach       1      │
│  [ 240/280 ]   [ 😊 ]  [ 🖼 ]  [ 📊 poll ]   │  ● Voice       2      │
│                                              │  ● Patterns    1      │
│  ┌── Starting points ──────────────────┐     │  ● Correctness 0      │
│  │ ✦ Blank   ✦ Seed draft   ✦ Research │     │                       │
│  │ ✦ From inspiration                  │     │  [stacked issue cards │
│  └─────────────────────────────────────┘     │   each: what/why +    │
│                                              │   Accept · Dismiss]   │
│  Goals: tone ▸ energy ▸ stance ▸ ...         │                       │
└─────────────────────────────────────────────┴──────────────────────┘
```

- **Post Score** = a blended, live headline number (weighting in §7). One number the user learns to push upward.
- **Category counts** mirror Grammarly's pill row; clicking filters the cards.
- **Cards** are the existing voice-check / read findings, re-rendered as actionable items with **Accept** wiring straight into the editor (we already have `applyVoiceEdit()` — generalize it to per-span replacements).
- Thread mode: same assistant, scored per-tweet plus a thread-level "hook strength / does tweet 1 earn the dwell" read.

Reuse, don't rebuild: `DraftEditor.tsx`, `CharCounter`, `EmojiPicker` (its cursor logic), `MediaUploader`, `PollEditor`, draft persistence, and the publish/schedule pipeline are unchanged. The swap is confined to the text-input layer + a new sidebar.

---

## 5. Editor architecture — the textarea problem

A `<textarea>` cannot render inline spans. Two paths:

| Option | What it is | Effort | Risk |
|---|---|---|---|
| **A — Highlight overlay (recommended for v1)** | Keep the `<textarea>` (transparent text), render a pixel-aligned `<div>` backdrop behind it with the same text + `<mark>` spans for underlines; scroll-sync the two. | Low–Med | Low — textarea keeps native cursor, IME, emoji-insert, a11y, undo |
| **B — contentEditable / TipTap** | Replace the textarea with a rich editor; underlines are real decorations. | Med–High (2–4 wks) | Higher — must re-solve cursor, emoji insertion, paste, mobile, thread reorder |

**Recommendation: ship A first.** The overlay technique (the same one most lightweight Grammarly-style libraries use) preserves every behavior you already have in `ComposeTextarea` and `EmojiPicker`, keeps `weightedTweetLength()` counting plain text untouched, and lets us validate the *product* before paying for an editor migration. Keep B on the roadmap only if v1 hits a real ceiling (e.g. overlapping multi-class underlines feel bad). Encapsulate behind a `<ComposeEditor>` so swapping A→B later doesn't touch callers.

**New shared module:** `src/lib/analysis/spans.ts` — utilities to map findings → `{ start, end, class, severity, cardId }` ranges, merge/resolve overlaps (priority: correctness > voice > reach > patterns), and apply a single-span replacement to the plain-text value (re-deriving offsets safely after each edit).

---

## 6. The check engine — three latency tiers

The art is making it feel instant and *not* cost a fortune per keystroke. Three tiers, gated by debounce and cost:

### Tier 0 — Instant, deterministic, free (every keystroke, <10ms)
Pure functions, no network. This is what makes it *feel* live.
- **Already built:** `computeAlgorithmFlags()` — link penalty, reply-hook presence, engagement-bait, dwell/length, media. Just needs to emit spans (the matched phrase) instead of whole-post flags.
- **Add (cheap):** weighted char count + over-limit (have it), thread-split suggestion at >280, ALL-CAPS/excess-emoji/hashtag-stuffing, banned `avoid_words` from guardrails (exact substring matches → instant underline), naive URL→"move to reply" nudge.
- **Local clarity:** pull in a deterministic prose linter (e.g. `retext`/`write-good`-style: weasel words, passive voice, "very/really" padding) for blue clarity underlines with zero LLM cost.

### Tier 1 — Debounced, cheap LLM, low cost (~1.2s after typing stops)
- **Correctness (grammar/spelling)** — the missing Grammarly-core category. One fast-model (Haiku-class) call returning **anchored** corrections `[{span, fix, reason}]`. Cache by `draft_hash`.

### Tier 2 — Debounced longer / on-pause, judgment LLM, metered (~3s)
- **Voice + Performance, consolidated into ONE call.** Today `runVoiceCheck` and `runPrepublishRead` are two separate LLM round-trips (3 credits each). For a live loop that's too slow and too expensive. **Merge them into a single "Live Read" call** that returns: voice score, voice deviations (anchored), resemblance score, matched/missing patterns, and a one-line summary. Deterministic algorithm flags come from Tier 0, not the LLM. One call, fast model, cached by hash.

**The schema change that unlocks everything:** extend `VoiceCheckResult.deviations` and the read's findings from `string[]` to:
```ts
type Finding = {
  span?: { quote: string; start: number; end: number }; // the exact text to underline
  class: "voice" | "reach" | "pattern" | "clarity" | "correctness";
  severity: "suggestion" | "warning" | "problem";
  message: string;        // what
  why: string;            // grounded reason (algorithm weight, your pattern multiplier)
  replacement?: string;   // one-click Accept payload
}
```
Have the judge LLM return `quote` (the verbatim substring); we resolve `start/end` locally (robust to the model miscounting). Keep the legacy `suggested_edit` whole-post rewrite as a "rewrite the whole thing" action.

**Caching is the cost lever.** Both result tables are already keyed by `draft_hash`. Add a hash check *before* any Tier 1/2 call so pauses on unchanged text are free, and only re-run the *changed* region when possible.

---

## 7. Scoring model

- **Post Score (headline)** = weighted blend, e.g. `0.45·voice + 0.35·resemblance + 0.20·algorithmFit`, where `algorithmFit` is computed deterministically from Tier-0 flags (start 100, subtract for penalty/caution, add for good). Tunable; surface as one 0–100 number with the same color thresholds already in `AgenticChain` (`80+ green, 60–79 amber, <60 red`).
- Category counts come straight from the findings list grouped by `class`.
- Anchor the headline number to your **canonical `weightedEngagement` ordering** so the assistant and the rest of the product tell one story.

---

## 8. Cost & business-model implication (decision needed)

Grammarly is a **flat subscription**, precisely because nobody can write with a meter ticking on every pause. Your current model charges **3 credits per voice check and per read**. A live assistant that calls the LLM every few seconds is incompatible with per-call credits.

**Decided (2026-06-24):**
- **Tier 0 (deterministic): always free, always on.** This already covers the highest-signal algorithm levers — a genuinely useful free product.
- **Tier 1/2 (LLM live checks): subscription entitlement**, not per-call credits. Live LLM checks **auto-run ~3s after the user pauses** (debounced, not on every keystroke), and are defended by: hash-cache (unchanged text = $0), a single merged call, a fast model, and a per-minute rate cap. Free tier gets Tier-0 + a small number of manual "deep checks"/day; paid tier gets the always-on (debounced) live LLM assistant.
- **Generation** keeps its existing credit/slot model (it's a discrete, willing-to-pay action).

---

## 9. Data model & API changes

- **No new tables required for v1.** `voice_check_results` and `prepublish_reads` already cache by hash.
- **Schema (code, not DB):** the `Finding` shape in §6 across `voice-check.ts`, `prepublish-read.ts`, and their API routes. Additive — keep old fields for back-compat with the agentic pipeline.
- **New endpoint:** `POST /api/live-read` — merged voice+performance, returns `Finding[]` + scores, hash-cached, fast model. (Or extend `/api/prepublish-read`.)
- **Keep:** `/api/drafts/generate-from-topic`, `/api/drafts/generate-agentic`, `/api/drafts/refine` — now feeding the editor as seeds.
- Optional later: a `dismissed_suggestions` store so "Dismiss" sticks across sessions per draft.

---

## 9b. Build status (2026-06-24 — first execution pass)

Shipped behind the `assistant` flag (`NEXT_PUBLIC_WRITING_ASSISTANT=1` or `localStorage.assistant="1"`). Full `next build` + 121 tests green.

- ✅ **Engine** `src/lib/analysis/assistant/` — pure, client-safe, 24 unit tests: `types`, `spans` (quote→offset anchoring, overlap→segments, apply-replacement), `tier0` (deterministic anchored findings + badges + reach score), `score` (blend + A–F grade), `merge`, `palette`.
- ✅ **Phase 0 editor** `HighlightedTextarea.tsx` — backdrop+textarea overlay, color-coded underlines, rect-based hover popover (`SuggestionPopover.tsx`).
- ✅ **Phase 1 panel** `AssistantPanel.tsx` + `ScoreDial.tsx` + `useAssistant.ts` — Post Score orb, Voice/Performance/Reach, badge row, Accept/Dismiss cards. Wired into `DraftEditor` behind the flag.
- ✅ **Phase 2 live read** `POST /api/live-read` + `runLiveRead` — ONE merged voice+performance call returning anchored findings; subscription-gated (not metered); debounced + hash-cached client hook with triviality/min-delta gates.
- ✅ **Phase 3 (functional core)** — generated drafts already seed `/drafts/new` → the assistant-powered editor.
- ✅ **Extension (surface A)** `chrome-extension/src/content/assistant-{engine,ui}.js` — vanilla Tier-0 port + score orb + panel + best-effort Range underlines; manifest + build wired; builds clean.

**Robustness pass (2026-06-25):**
- ✅ **Dashboard editor migrated to ProseMirror** — `HighlightedTextarea` now uses a minimal plain-text PM schema + real inline decorations (no overlay/alignment hack). Offset↔PM mapping is pure + unit-tested (`pm/model.ts`, 5 tests). Same props API; `next build` clean. (Replaces the brittle textarea-backdrop overlay.)
- ✅ **Single-source engine via esbuild** — the extension now bundles the *actual* TS engine (`chrome-extension/src/engine-entry.ts` → `dist/assistant-engine.js`); hand-port + parity test deleted (drift now impossible).
- ✅ **No score flicker** — `useAssistant` keeps the last Live Read's voice/performance while you type on (`stale` → "updating on pause").
- ✅ **Extension event-driven** — `MutationObserver` + rAF scroll repositioning replaced the 350ms poll (1s safety net remains).
- ✅ Filler-removal double-space fixed.

**Deferred / needs follow-up:** embedding-cosine Performance fast-path (no embeddings provider wired — Live Read uses the LLM); **in-X underlines still need live-page validation** (the dashboard editor is now solid; X's Draft.js box remains the fail-soft surface); landing-page IA repositioning (§3) and thread-level scoring (Phase 4).

## 10. Phased rollout

**Phase 0 — Spike (de-risk the editor) · ~2–3 days**
Build the `<ComposeEditor>` overlay (Option A) behind a flag. Prove pixel-aligned underlines + scroll sync + cursor/emoji/IME all survive. This is the only true unknown; validate before committing.

**Phase 1 — Free, instant assistant (Tier 0) · ~1 wk**
- `computeAlgorithmFlags` → spans; add the deterministic checks + local clarity linter.
- Sidebar with category counts + cards + Accept/Dismiss wired to span replacement.
- Live algorithm-fit sub-score. Ships a useful product with **zero LLM cost.**

**Phase 2 — Correctness + voice/performance live (Tier 1/2) · ~1.5 wks**
- Grammar/spelling pass. Merged `/api/live-read` with anchored findings. Debounce + hash-cache + rate cap. Full Post Score. Settle the subscription entitlement (§8).

**Phase 3 — Reposition generation as on-ramps · ~1 wk**
- Make the editor the landing surface; convert Quick/Agent/Inspiration into "seed the editor" actions; keep the agentic chain as "Research a draft."

**Phase 4 — Polish & thread intelligence · ongoing**
- Per-tweet thread scoring, hook-strength read on tweet 1, dismiss-persistence, onboarding ("set your goals"), and a decision on whether Option B (TipTap) is worth it.

---

## 11. Risks & open decisions

1. **Editor decoration (technical, highest):** does the overlay feel good with overlapping multi-class underlines? → Phase 0 spike answers this. Fallback: TipTap.
2. **Cost/business model (§8): DECIDED** — subscription entitlement for live LLM checks, debounced (~3s after pause), not per-call credits. Remaining work is implementing the entitlement gate + rate cap, not deciding the model.
3. **Span accuracy:** LLMs miscount character offsets. Mitigate by having the model return the *verbatim quote* and resolving offsets locally; skip/soft-fail unanchored findings to a sidebar-only card.
4. **Noise/over-flagging:** Grammarly's failure mode is nagging. Severity thresholds + "show fewer like this" + respecting `optimization_authenticity` (authenticity-first users get fewer algorithm nags) keep it calm.
5. **Latency perception:** Tier 0 must carry the "live" feel so Tier 2's ~3s debounce never feels like lag.
6. **Generation cannibalization:** repositioning, not removal — measure whether seeds→edits convert better than card-approval did.

## 12. Success metrics
- % of posts **written by the user** (vs accepted wholesale from generation) — the pivot's north star.
- Suggestion **Accept rate** per category; **Dismiss/"show fewer"** rate (noise proxy).
- Post Score **lift between first draft and publish** (is the assistant actually improving posts?).
- Activation: time-to-first-published-post; "sounds like me" survey (ties to ICP brief).
- Retention/WAU on the editor surface vs the old generation funnel.
```
