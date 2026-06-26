# Writing Assistant — Source of Truth

> A real-time "Grammarly for tweets": you write, and the assistant flags voice drift, algorithm/reach risk, and missing high-lift patterns as you type, each with a one-click fix. One pure engine renders into three skins (dashboard editor, `/create` Write tab, Chrome extension).
> **Status (2026-06-26):** **ON by default.** The flag (`src/lib/assistant/flag.ts`) flipped from opt-in to opt-out on 2026-06-26 — the editor is now the front door of `/create`, and generation is an optional on-ramp. Shipped: L0 deterministic checks, L2 embedding scores, L3 LLM read, calibration loop, ProseMirror underlines, extension parity. Deferred: L1 local WASM grammar, thread-level scoring, in-X live-page underline hardening, and actually charging for it (the entitlement is granted to every plan today).

## 1. Role in the product

The product pivoted from "AI post generator" to a writing assistant. Generation answers "make me a post"; the assistant answers the question users actually live in: "is *this* — the thing I just wrote — good, and why not?"

It exists to close the **two opacities** a writer on X can't see:

- **Voice** — "does this still sound like *me*?" After tuning a voice profile, every draft silently drifts from it. The assistant scores voice match (L2) and points at the exact spans that drift (L3).
- **Algorithm / reach** — "will X actually show this?" Reach levers (replies ≫ retweets > likes, dwell wins, external links and engagement-bait are demoted) are invisible while typing. The assistant surfaces them deterministically and for free (L0), grounded in X's open-sourced heavy-ranker weights (`src/lib/analysis/x-algorithm.ts`).

Design rule that shapes everything: **underlines are always "fix this span" (a warning).** Positive/state signals are Badges; missing things are Chips; holistic qualities (voice, performance, post score) are Scores. Never a green underline. (`src/lib/analysis/assistant/types.ts:8`)

## 2. The four-layer engine (L0–L3)

| Layer | Trigger / cadence | Engine | Marginal cost | Produces |
|---|---|---|---|---|
| **L0** Tier-0 | every keystroke (sync, in-process) | pure TS, no network (`tier0.ts`) | $0 | link/bait/avoid-word/filler **findings** (underlines), state **badges**, nudge **chips**, deterministic **Reach** sub-score |
| **L1** correctness/clarity | *(deferred)* on ~600ms pause | local WASM grammar (Harper/`nlprule`) | ~$0 | spelling/grammar/clarity underlines |
| **L2** voice/performance | ~1s after a pause | OpenAI embeddings + cosine vs cached centroids (`vectors.ts`) | ~$0.00002, ~10–50ms | **Voice Match** (0–100) + **resemblance** (→ Performance grade) |
| **L3** Live Read | rare / on-demand (panel open, low-score idle, explicit "why?") | fast-tier LLM (`live-read.ts`) | one cheap LLM call, cached by `draft_hash` | anchored **voice-drift findings** + rewrites + **missing-pattern chips** + calibration voice score |

**L0 — Tier-0 (the "live feel").** Pure and client-safe, so the identical code runs in the dashboard and is bundled into the extension. It underlines each external link (`reach`, severity `problem`, ~30–50% demotion), each engagement-bait phrase (`reach`, `warning`), each guardrail avoid-word (`voice`, `warning`), and each filler word (`clarity`, `suggestion`, deletes on accept). It emits badges for reply-hook present / media / dwell-worthy / over-limit, and a `computeReachScore` 0–100 (`tier0.ts:234`). `REPLY_DRIVING`/`ENGAGEMENT_BAIT` are imported from `x-algorithm.ts` — one source of truth shared with the pre-publish read, pinned equal by a parity test, so the deterministic layers can't drift. `optimization_authenticity > 70` quiets the *soft* reach nags (no reply hook) but never the hard penalties (link, bait).

**L1 — local correctness/clarity (deferred).** The missing Grammarly-core category. Planned as a client-side WASM checker on a ~600ms debounce, emitting `correctness`/`clarity` findings with no network. Until it ships, `tier0.ts` keeps a tiny conservative filler-word list as the placeholder (over-flagging is the failure mode of a writing assistant). (`GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md` §8)

**L2 — embedding scores (the always-on loop).** "Does this sound like me / my winners?" is a *similarity* question, so it's answered by embeddings (~100–1000× cheaper than an LLM judgment), which is what lets the loop be unmetered. `scoreDraft` embeds the draft once (`text-embedding-3-small`, 1536-d, `src/lib/ai/embeddings.ts`), normalizes, and takes cosine against the user's `voice_centroid` and `winners_centroid`; `mapCosineToScore` turns each cosine into 0–100. On cold start (no centroid) it returns neutral scores (`voice 70 / resemblance 50`) and the route kicks a background `refreshVoiceVectors`. Embeddings use OpenAI directly — **not** the Claude chat path (`CLAUDE_ONLY` governs chat only).

**L3 — Live Read (LLM, demoted).** The LLM is reduced to what only it can do: explain and rewrite. Given the user's assembled voice spec, top/median posts, and enabled patterns, it returns up to 4 voice deviations — each a **verbatim `quote`** plus an approximate `index`, an issue, a grounded why, and an optional span rewrite — plus matched/missing pattern ids and a one-line summary. It also returns a `voice_score` used **only** to calibrate L2, never displayed. Read-first cached on `assistant_live_reads` by `(user, draft_hash, voice_type)`; persistence is `Promise.allSettled` so a write rejection can't turn a good read into a 500. (`live-read.ts:62`)

## 3. Data flow

```
keystroke ──► L0 runTier0 (sync) ──► underlines + badges + Reach sub-score      [every render]
   │
   ├─ pause ~1s ──► POST /api/assistant/score ──► scoreDraft (embed + cosine)
   │                     └─► Voice Match (0–100) + Performance grade            [always-on, unmetered]
   │
   └─ idle ~6s, low score, material change ──► POST /api/live-read
        OR explicit "Deep check" button       └─► voice-drift findings + rewrites + missing-pattern chips
```

The client brain is `useAssistant.ts`. Cadences (`useAssistant.ts:34`): L2 debounces `L2_DEBOUNCE_MS = 1000` once text ≥ 5 chars; L3 auto-fires only after `L3_IDLE_MS = 6000` idle **and** the draft moved ≥ `L3_MIN_DELTA_CHARS = 12` **and** L2 voice or resemblance is below `L3_SCORE_THRESHOLD = 65` — i.e. it never spends an LLM call on a high-scoring or trivially-changed draft. `runDeepCheck()` bypasses the gate for the explicit button / reply-box on-demand path. Both layers are **hash-cached client-side and server-side**, so unchanged text never re-spends. Results are merged by `mergeReport` (`merge.ts`): L0 findings/badges always; L2 fills scores; L3 adds findings/chips; every span is re-anchored against the *current* text, so a finding that lands a beat late degrades to a panel card rather than underlining a stale offset. The UI keeps showing the last scores marked `stale` ("updating on pause") instead of flickering to "—".

**Calibration loop.** Each Live Read calls `recordCalibrationSample(text, llmVoiceScore)` fire-and-forget (`live-read.ts:251`). It embeds the draft, computes its cosine to the voice centroid, and folds the `(cosine, LLM-score)` pair into per-user online least-squares accumulators (`accumulateCalibration`, `vectors.ts:103`, with exponential forgetting past n=200). Once ≥ 8 pairs exist, `mapCosineToScore` switches from the default affine map to the user's fitted line — so the cheap L2 number tracks the rarer L3 judgment over time. Centroids themselves are rebuilt by `refreshVoiceVectors` (on cold start, after a tune-up via `/api/assistant/vectors/refresh`, or nightly via the cron) and preserve calibration across rebuilds.

## 4. Core types

All in `src/lib/analysis/assistant/types.ts` — dependency-free and client-safe by design.

- **`Finding`** → an **underline**. `class` ∈ `correctness | clarity | voice | reach`; `severity` ∈ `suggestion | warning | problem`; `title` (what), `why` (grounded reason), optional `span`, optional `replacement` (one-click accept), `source` ∈ `tier0 | live`. A Finding with no `span` degrades to a panel-only card.
- **`FindingSpan`** = `{ quote, start, end }`. **Span-anchoring rule: the LLM returns the verbatim `quote`, never offsets (models miscount); offsets are resolved locally** by searching for that quote (`spans.ts:23`, `resolveQuote`). If the quote isn't found verbatim → no span → panel card, never an underline at a guessed position.
- **`Badge`** → a discrete **state** (`good | caution | info`): reply-hook present, has media, over-limit. Never an underline.
- **`SuggestionChip`** → something **missing / a nudge** (`missing_pattern | nudge`), optional `insert` and engagement `multiplier`. Never a span.
- **`Scores`** = `{ post, postProvisional, voice, performance, reach }`. `voice` (0–100) and `performance` (letter grade) are `null` until a Live Read/L2 score lands; `reach` is always present (free). `post` blends `0.45·voice + 0.35·performance + 0.20·reach`, **renormalized over present components** and flagged `provisional` until L2 fills the rest (`score.ts`). Performance is a letter grade (A–F via `resemblanceToGrade`) on purpose — a grade avoids false precision on a fuzzy signal.
- **`AssistantReport`** = `{ findings, badges, chips, scores, charInfo }` — the single payload every surface renders at its own density.

**Class taxonomy & overlap.** `FINDING_CLASS_META` (`types.ts:116`) sets priority `correctness(4) > voice(3) > reach(2) > clarity(1)`; on a contested character the higher-priority class wins the underline (`buildSegments`). Color = class, underline style = severity (`palette.ts`: dotted/wavy/double; portable hex so the extension works on X's pages where our CSS tokens don't exist).

## 5. Surfaces

One engine, three skins — all consuming `AssistantReport`:

1. **Dashboard editor** (`DraftEditor.tsx`) — ProseMirror editor (`HighlightedTextarea.tsx`) where underlines are **real inline decorations** (`pm/decorations.ts`), never a pixel-aligned overlay backdrop, so they can't drift out of alignment with the glyphs. `pm/model.ts` maps plain-text offsets ↔ PM positions (newline = paragraph). Hover a span → `SuggestionPopover` (category · what · why · Accept · Dismiss). A 300px sidebar `AssistantPanel` shows the Post-Score `ScoreDial` orb + Voice Match + Performance + Reach, a badge row, the suggestion cards, and a "Deep voice + performance check" button. `useAssistant({ autoLiveRead: true })`.
2. **`/create` Write tab** (`CreatePage.tsx:1234`) — the same `HighlightedTextarea` + `AssistantPanel` two-column layout, gated on `composeType === "X_POST" && assistantOn`. With the flag on this is the **default front door** of compose; subtitle: "The assistant flags voice drift and reach risks as you type." Falls back to a plain textarea for threads / when disabled.
3. **Chrome extension** (`chrome-extension/`) — `engine-entry.ts` bundles the **real TS engine** via esbuild into `dist/assistant-engine.js` and exposes `window.AFXAssistant` (replacing the old hand-ported copy + its parity test). `content/assistant-ui.js` injects a bottom-right score **orb** (Reach + finding-count dot) into X's composer, a click-to-open panel of badges + Tier-0 suggestions, and best-effort inline underlines for exact-match findings. The orb/panel need only the text; the in-X underlines are the one fragile part and **fail soft** ("no underline / no orb" rather than interfering with typing). Extension = L0 only (no L2/L3).

## 6. Endpoints & gating

Both writing-assistant routes are **subscription-gated via `requireFeature(user.id, "writingAssistant")`** and **never metered** — an always-on writing loop can't tick a credit on every pause, and consuming a generation slot would 429 a user mid-sentence and block their real generation (locked decision).

| Route | Layer | Method | Gating | Caching | Notes |
|---|---|---|---|---|---|
| `/api/assistant/score` | L2 | POST | `requireFeature` | client + (cold-start excluded) | embed + cosine; cold start → neutral + background refresh (`route.ts:22`) |
| `/api/live-read` | L3 | POST | `requireFeature` | read-first by `draft_hash` (server) + client | LLM read; `maxDuration = 60` |
| `/api/assistant/vectors/refresh` | L2 setup | POST | `requireFeature` | — | rebuild caller's centroids on demand / post-tuneup |
| `/api/cron/assistant-vectors` | L2 setup | GET | `CRON_SECRET` bearer | — | nightly batch refresh for users with recent analytics; service-role, best-effort per user |

**Gating mechanics** (`src/lib/stripe/gate.ts`): `requireFeature` looks up the user's plan, falls back to `free` if the subscription isn't active, and 403s `PLAN_LIMIT` if the entitlement is false. `writingAssistant` is a boolean entitlement key in `src/types/subscription.ts:20`. **Today it is `true` on every plan including `free`** (table-stakes) — flip `free → false` to make it paid (see §8).

## 7. Key files

| Path | What |
|---|---|
| `src/lib/analysis/assistant/types.ts` | Finding/Badge/Chip/Scores/AssistantReport + `FINDING_CLASS_META` |
| `src/lib/analysis/assistant/tier0.ts` | L0 deterministic engine (`runTier0`, reach score) |
| `src/lib/analysis/assistant/spans.ts` | `resolveQuote` / `resolveFindings` / `buildSegments` / `applyReplacement` |
| `src/lib/analysis/assistant/score.ts` | `composeScores`, `resemblanceToGrade`, bands |
| `src/lib/analysis/assistant/merge.ts` | `mergeReport` (L0+L2+L3 → final report) |
| `src/lib/analysis/assistant/vectors.ts` | **server-only** L2: centroids, `scoreDraft`, `refreshVoiceVectors`, calibration math |
| `src/lib/analysis/assistant/palette.ts` | portable hex palette (class color, severity style, bands) |
| `src/lib/analysis/assistant/index.ts` | pure client-safe barrel (deliberately excludes `vectors.ts`) |
| `src/lib/ai/embeddings.ts` | `embedText`, `EMBED_MODEL`/`EMBED_DIMS` (OpenAI, 1536-d) |
| `src/lib/analysis/live-read.ts` | L3 LLM read (`runLiveRead`) |
| `src/lib/analysis/x-algorithm.ts` | ranker weights, `REPLY_DRIVING`, `ENGAGEMENT_BAIT`, caveat |
| `src/lib/assistant/flag.ts` | `isAssistantEnabled` (on by default; localStorage / env hatches) |
| `src/components/assistant/useAssistant.ts` | client brain: cadences, caches, accept/dismiss |
| `src/components/assistant/{AssistantPanel,ScoreDial,SuggestionPopover}.tsx` | dashboard UI |
| `src/components/compose/HighlightedTextarea.tsx` + `pm/{model,decorations}.ts` | ProseMirror editor + underline decorations |
| `src/components/drafts/DraftEditor.tsx`, `src/components/create/CreatePage.tsx` | wiring (two surfaces) |
| `src/app/api/assistant/score/route.ts`, `src/app/api/live-read/route.ts` | L2 / L3 endpoints |
| `src/app/api/assistant/vectors/refresh/route.ts`, `src/app/api/cron/assistant-vectors/route.ts` | centroid refresh (on-demand / cron) |
| `supabase/migrations/20260625_assistant_vectors.sql` | `user_assistant_vectors`, `assistant_live_reads` (+ RLS) |
| `src/lib/stripe/gate.ts`, `src/types/subscription.ts` | `requireFeature` + `writingAssistant` entitlement |
| `chrome-extension/src/engine-entry.ts`, `chrome-extension/src/content/assistant-ui.js` | extension engine bundle + in-X UI |

## 8. Current state, gaps & deferred

**Live / shipped:**
- L0 deterministic engine on every keystroke, both web surfaces + extension (one bundled engine, no ports).
- L2 embedding scores (`text-embedding-3-small`), cosine vs cached centroids, cold-start handling, on-demand + nightly centroid refresh.
- L3 LLM Live Read with verbatim-quote span anchoring, read-first `draft_hash` cache, rewrites, missing-pattern chips.
- Calibration loop (LLM voice score → per-user cosine→score fit).
- ProseMirror real-decoration underlines + hover popover + sidebar panel; flag ON by default.
- Both runtime routes subscription-gated and unmetered.

**Deferred / gaps:**
- **L1 local WASM grammar/clarity** not built — `tier0.ts`'s small filler list is the placeholder for the Grammarly-core correctness category.
- **Thread-level scoring** — threads fall back to a plain textarea on `/create`; no per-tweet or "does tweet 1 earn the dwell" thread read yet.
- **In-X (extension) underlines** are best-effort/fail-soft against X's Draft.js box and still need live-page hardening; the orb + panel are solid, the in-box underlines are the fragile part.
- **No real plan gating yet** — `writingAssistant` is `true` on every plan (free included). Making it paid is a one-line flip (`free.limits.writingAssistant = false`); the `requireFeature` plumbing already returns the 403.
- The design docs (`GRAMMARLY_*_*.md`) list metering and embeddings as TODO — that bug list is **stale**: embeddings (L2) and the unmetered-entitlement model have shipped; trust the code.

## 9. Related docs

- `docs/features/voice-engine.md` — the voice profile / patterns / posts pool the assistant scores against.
- `docs/features/generation.md` — the (now optional) generation on-ramp.
- `docs/features/billing-plans-and-credits.md` — plans, entitlements vs metered credits, why this is an entitlement.
- `docs/features/chrome-extension.md` — the in-X surface and engine bundling.
- Design rationale (intent, partly stale — defer to code): root `GRAMMARLY_PIVOT_PLAN.md`, `GRAMMARLY_PIVOT_UX.md`, `GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md`.
