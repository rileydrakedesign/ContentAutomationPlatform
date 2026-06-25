# Writing Assistant — Architecture Optimization Handoff

**Date:** 2026-06-25 · **Status:** Ready to execute · **Audience:** the engineer/agent implementing this
**Companions:** `GRAMMARLY_PIVOT_PLAN.md` (product plan), `GRAMMARLY_PIVOT_UX.md` (UX spec). Read those for product intent; this doc is the *technical* re-architecture.

---

## 0. Mission (TL;DR)

The "Grammarly for tweets" writing assistant is built and working behind a flag, but its **Live Read fires one holistic LLM call on every typing pause**, which (a) is metered against the AI-generation quota — wrong, this is table-stakes and must be **unmetered** — and (b) is the wrong engine for an always-on loop.

**Re-architect into four layers on separate engines/cadences** so the always-on experience is cheap/free and the LLM is reserved for what only it can do:

| Layer | Trigger | Engine | Marginal cost | Produces |
|---|---|---|---|---|
| **L0 deterministic** | every keystroke | pure JS (exists) | $0 | links, bait, reply-hook, length, reach sub-score |
| **L1 correctness/clarity** | on pause | local WASM grammar | ~$0 | spelling/grammar/clarity underlines |
| **L2 voice + performance** | on pause (~1s) | **embeddings vs cached centroid** | fraction of a ¢ | live Voice Match (0–100) + Performance grade |
| **L3 explanations + rewrites** | on-demand / rare | cheap LLM | subscription-funded | anchored voice-drift findings, missing-pattern chips, rewrites |

The trigger (debounce-on-pause) is correct and is how Grammarly works. The mistake is running a frontier-ish LLM judgment on that trigger. **L2 (embeddings) is the core change**: "does this sound like me / like my winners?" is a *similarity* question embeddings answer ~100–1000× cheaper and in ~10–50ms. The LLM (L3) only *explains and rewrites*, on demand. This makes the live loop unmetered without sacrificing quality.

**Do Workstream A first (gating/metering fix) — it's small and unblocks shipping.** Then B (embeddings L2) is the heart. C demotes the LLM. D/E are follow-ups.

---

## 1. Current status (what exists today)

Feature flag: `NEXT_PUBLIC_WRITING_ASSISTANT=1` or `localStorage.assistant="1"` (`src/lib/assistant/flag.ts`). Off by default.
Validation baseline: `npx tsc --noEmit` clean; `npx vitest run` green (126 tests); `npm run build` clean.

**Engine (pure, client-safe, unit-tested) — `src/lib/analysis/assistant/`:**
- `types.ts` — `Finding` (class: correctness|clarity|voice|reach, severity, span{quote,start,end}, replacement, source), `Badge`, `SuggestionChip`, `Scores` (post, postProvisional, voice|null, performance:Grade|null, reach), `AssistantReport`, `FINDING_CLASS_META`.
- `tier0.ts` — `runTier0(input)` → the L0 deterministic engine (anchored findings + badges + chips + reach sub-score). **Keep; this is L0.**
- `spans.ts` — `resolveQuote`, `resolveFindings` (quote→offset anchoring; unanchorable → no underline), `buildSegments` (overlap→render segments), `applyReplacement`.
- `score.ts` — `composeScores`, `resemblanceToGrade` (0–100→A–F), `scoreBand`, `gradeBand`.
- `merge.ts` — `mergeReport(text, tier0, live)` + `LiveReadResult` type. **Will change** (L2 scores come from embeddings, not the LLM read).
- `palette.ts` — portable hex colors (shared with extension).
- `index.ts` — barrel. `assistant.test.ts` — 24 tests.

**Server:**
- `src/lib/analysis/live-read.ts` — `runLiveRead()` = the merged voice+performance LLM judge (ONE call). **Will be refactored into L3** (explanations/rewrites only; scores leave it).
- `src/app/api/live-read/route.ts` — POST endpoint. **Re-gate (Workstream A).**

**Client:**
- `src/components/assistant/useAssistant.ts` — the brain: L0 every render + debounced LLM read. **Major changes** (split L2/L3, fix gates).
- `src/components/assistant/{AssistantPanel,ScoreDial,SuggestionPopover}.tsx` — panel, orb, hover card.
- `src/components/compose/HighlightedTextarea.tsx` — **ProseMirror** editor (real inline decorations). `src/components/compose/pm/{model,decorations}.ts` (offset↔PM mapping, unit-tested) + `model.test.ts` (5 tests).

**Wiring:** `src/components/drafts/DraftEditor.tsx` (post editor) and `src/components/create/CreatePage.tsx` (Compose tab) both call `useAssistant` behind the flag. `src/app/globals.css` has `.afx-pm-editor` styles. `src/lib/x-api/tweet-text.ts` added `findUrls`.

**Extension:** `chrome-extension/src/content/assistant-ui.js` (orb + best-effort underlines on X) + `src/engine-entry.ts` (esbuild-bundles the **real TS engine** → `dist/assistant-engine.js`; single source of truth). `build.js`/`manifest.json` wired.

---

## 2. The problem & root cause

**Symptom:** every pause = one LLM call, metered → it can 429 a user mid-sentence and block their real generation; free users get it until quota. This violates the design's "subscription-gated, NOT metered" intent.

**Root cause:** we collapsed *always-on cheap analysis* and *on-demand generation* into a single per-pause LLM call. Grammarly keeps these strictly separate. The fix is engine/cadence decomposition (§3), not a billing tweak.

**Open review findings to fold into this work** (full detail in the session's `/code-review` output; summarized):

| # | File | Issue | Fixed by |
|---|---|---|---|
| 1 | `api/live-read/route.ts:31` | `requireAiGeneration` **meters** every read (consumes a daily AI-gen slot via `gate.ts:63 logAiGeneration`) | Workstream A |
| 2 | `useAssistant.ts:166` | min-delta gate is a dead no-op (empty `if`, no `return`) | Workstream A |
| 3 | `CreatePage.tsx:~143` | `useAssistant` not gated on the Compose tab being active → spends on hidden tab | Workstream A |
| 4 | `pm/model.ts:14` | PM schema has no `hard_break` + no `clipboardTextParser` → paste mangles/collapses newlines | Workstream E |
| 5 | `live-read.ts:159` | `resolveQuote` w/o hint → repeated quotes anchor to first occurrence → Accept rewrites wrong span | Workstream E |
| 6 | `tier0.ts:~95` (via `tweet-text` URL_REGEX) | email/bare-domain (`me@google.com`) flagged as external-link penalty | Workstream E |
| 7 | `HighlightedTextarea.tsx:106` | `mousemove` closure captures stale `active` (always null) → popover never closes on move-off | Workstream E |
| 8 | `live-read.ts:186` | best-effort persistence `await Promise.all` w/o `.catch` → a write rejection turns success into HTTP 500 | Workstream C |
| 9 | `tier0.ts:47` vs `prepublish-read.ts:103` | engagement-bait lists duplicated **and already drifted** ('tag 3' vs '👇 follow') | Workstream E |
| 10 | `assistant-ui.js:147` | extension drops `authenticity` → authenticity-first users nagged on X but not dashboard | Workstream E |

---

## 3. Target architecture (detail)

### Cadence & trigger rules
- **L0** — synchronous in `useAssistant` `useMemo` on every text change. Already correct.
- **L1** — debounced ~600ms after a pause; local WASM, no network. (Phase D; optional for v1.)
- **L2** — debounced ~1000ms after a pause; one POST `/api/assistant/score`. Cheap; hash-cached; **unmetered**. Drives the Voice Match number + Performance grade.
- **L3** — runs **only** when one of: (a) the assistant panel is open, (b) Voice/Performance is below a threshold AND the user has been idle ≥ ~6s AND text changed materially, or (c) explicit "deep check" / hover "why?". Hash-cached read-first. Produces anchored drift findings + missing-pattern chips + rewrites. **Unmetered** (subscription entitlement).

### Why L2 keeps quality
General embeddings capture topic better than *style*, so:
1. Anchor on the **user's own posts** (relative similarity is robust to model idiosyncrasies).
2. Blend embedding-cosine with the deterministic style signals already tracked (length mode, emoji mode, question rate, tone/energy/stance dials in `user_voice_settings`).
3. **Calibration loop:** whenever L3's LLM runs and returns a voice score, persist it (already have `voice_check_results`); periodically fit the per-user `cosine → 0–100` mapping to those LLM scores so the cheap live number tracks the expensive judgment.

### Data flow
```
keystroke ─► L0 (sync) ─► underlines + reach + badges (instant)
  pause 1s ─► L2 /api/assistant/score ─► embed draft, cosine vs cached centroids ─► Voice + Performance (cheap)
  panel-open / low+idle / "why?" ─► L3 /api/live-read ─► LLM ─► drift findings + chips + rewrites (rare)
```

---

## 4. Reusable building blocks already in the repo (don't re-implement)

- `getAssembledPromptForUser(supabase, userId, voiceType)` — `src/lib/openai/prompts/prompt-assembler.ts`. Returns the assembled voice spec string. Used by L3.
- `getAnalyzablePosts(supabase, userId)` — `src/lib/analysis/posts-pool.ts`. Returns `AnalyzablePost[]` with `.text`, `.engagement_score`. **Use to build L2 centroids** (top performers + voice corpus).
- `weightedEngagement` — `src/lib/utils/engagement.ts`. Canonical scoring; **do not** invent another. (Memory: all engagement scoring goes through this.)
- `runVoiceCheck` / `runPrepublishRead` — `src/lib/analysis/{voice-check,prepublish-read}.ts`. L3 should share their prompt-assembly/JSON-parse rather than the current hand-merged copy in `live-read.ts` (review reuse finding).
- `computeAlgorithmFlags`, `X_ALGORITHM_WEIGHTS` — `src/lib/analysis/{prepublish-read,x-algorithm}.ts`. **Move the shared `REPLY_DRIVING`/`ENGAGEMENT_BAIT` constants here and import from both** `tier0.ts` and `prepublish-read.ts` (fixes finding #9).
- Gating — `src/lib/stripe/gate.ts`: `requireFeature(userId, feature)` = **plan check, NO metering** (use this for the assistant); `requireAiGeneration(userId, endpoint, weight)` = **consumes quota** (do NOT use for the always-on loop). Add an assistant feature key to `PLANS.*.limits` in `src/types/subscription.ts`.
- Tables: `voice_check_results`, `prepublish_reads` (both keyed by `draft_hash`), `user_voice_examples`, `extracted_patterns`, `user_voice_settings`, `user_niche_profile`, `user_analytics`, `captured_posts`.
- Supabase MCP rule (memory): `apply_migration` = DDL only; `execute_sql` = DML.

---

## 5. Workstream A — fix gating & metering (DO FIRST, small)

Goal: the assistant never consumes generation quota and never runs invisibly.

1. **Subscription gate, not quota.** In `src/types/subscription.ts` add a `writingAssistant` (or `liveRead`) boolean to each plan's `limits`. In `src/app/api/live-read/route.ts` replace `requireAiGeneration(user.id, "live-read")` with `requireFeature(user.id, "writingAssistant")`. Do the same for the new `/api/assistant/score` route. No `logAiGeneration`. Update the route comment to match reality.
2. **Fix the dead min-delta gate** (`useAssistant.ts:166`): either implement it (add the `return`) or delete the block + `MIN_DELTA_CHARS` + `lastReadText` ref. (With L2 cheap, prefer a simple hash-cache + a real idle/threshold trigger for L3.)
3. **Gate on the active surface** (`CreatePage.tsx`): pass `enabled: assistantOn && composeType === "X_POST" && activeTab === "compose"` (find the tab state; `TabsContent` unmounts but the hook lives at page scope). Same principle anywhere the hook is mounted but not visible.

Acceptance: typing in the editor for a minute issues **zero** AI-generation quota writes; switching away from the Compose tab stops reads.

---

## 6. Workstream B — L2 embeddings voice/performance (the core)

### B1. Pick an embeddings provider (DECISION — see §9)
Default recommendation: **OpenAI `text-embedding-3-small`** (1536-d, ~$0.02/1M tokens, fast) or **Voyage `voyage-3-lite`**. Note: `CLAUDE_ONLY` (`src/lib/ai/index.ts`) governs **chat** generation only — embeddings are a separate concern and provider; do not route them through the Claude path. Add an `embedText(texts: string[]): Promise<number[][]>` helper (new `src/lib/ai/embeddings.ts`) wrapping the chosen provider, with the model id + dims as constants.

### B2. Centroid storage + refresh job
- **Migration** (`supabase/migrations/`): table `user_assistant_vectors` — `user_id` (pk), `voice_centroid` (float[] / pgvector if available, else `jsonb`), `winners_centroid` (same), `dims int`, `model text`, `sample_count int`, `calibration jsonb` (per-user cosine→score fit), `updated_at timestamptz`. (Check `list_extensions` for `vector`; if absent, store `jsonb` arrays and do cosine in JS — fine at this scale.)
- **Refresh function** `refreshVoiceVectors(supabase, userId)` (`src/lib/analysis/assistant/vectors.ts`):
  - voice corpus = `user_voice_examples` (pinned + recent) ∪ `getAnalyzablePosts` originals; winners = top-N analyzable posts by `engagement_score`.
  - `embedText` each, average into two centroids (L2-normalize), upsert with `sample_count`.
  - Trigger it from: the existing tune-up path (`run_tuneup` / wherever patterns/voice refresh), a new `POST /api/assistant/vectors/refresh`, and a cron (there are cron routes under `src/app/api/cron/`). Cold-start: if no vectors yet, kick a refresh and have L2 fall back to a neutral score until ready.

### B3. Score endpoint (the per-pause call)
- `POST /api/assistant/score` (`requireFeature`, **not** metered). Body `{ text, draft_type }`. 
- `scoreDraft(supabase, userId, text)` (`vectors.ts`): hash-cache check (`draft_hash` in a small `assistant_scores` table or reuse `prepublish_reads`); else `embedText([text])`, cosine vs `voice_centroid` and `winners_centroid`; map cosine→0–100 via the per-user `calibration` (default affine map if uncalibrated, e.g. clamp/scale cosine 0.55–0.85 → 40–95); blend with deterministic style signals from `user_voice_settings` (small weighted nudge). Return `{ voice_score, resemblance_score }`.
- Latency target < 150ms p50. Single in-flight + client hash-cache (already in `useAssistant`).

### B4. Wire L2 into `useAssistant`
- Replace the per-pause `/api/live-read` call for **scores** with `/api/assistant/score` on a ~1s debounce. Feed `voice`/`resemblance` into `composeScores` (already supports it). Keep the `stale` UX.
- `mergeReport` / `LiveReadResult`: split into "scores" (from L2) and "findings" (from L3). Update `merge.ts` so scores come from the L2 result and findings from the (optional) L3 result.

### B5. Calibration loop
- When L3 runs (Workstream C) and returns an LLM voice score, store it (`voice_check_results` already does). Periodically (in the refresh job) fit `calibration` (e.g. linear regression of cosine→LLM-score over recent pairs) and persist on `user_assistant_vectors`. Until enough pairs, use the default map.

Acceptance: Voice Match + Performance update within ~1s of a pause, cost ≈ one small embedding per materially-changed draft, no LLM, no quota.

---

## 7. Workstream C — demote the LLM to L3 (on-demand)

- Refactor `runLiveRead` → focus on **anchored voice-drift findings + missing-pattern chips + rewrites** (drop score-of-record duty; L2 owns scores, though L3 may still return a voice score for calibration). Share prompt-assembly with `voice-check.ts`/`prepublish-read.ts` (extract a `buildJudgeContext`/`parseJudgeJson` helper) instead of the hand-merged copy.
- **Trigger** from `useAssistant` only on: panel open, low-score+idle≥6s+material change, or explicit deep-check/"why?". Never on every pause.
- **Read-first cache:** SELECT `prepublish_reads`/`voice_check_results` by `(user_id, draft_hash)` and short-circuit before calling the LLM (fixes the write-only "cache").
- **Persistence safety (finding #8):** wrap the best-effort inserts so a write rejection can never fail the request — `Promise.allSettled`, or `.catch` on each, never a bare `await Promise.all([...])`.
- Gate with `requireFeature` (unmetered).

Acceptance: a normal compose session makes **0–2** L3 LLM calls (not one per pause); an L3 write failure never 500s the read.

---

## 8. Workstream D — L1 local correctness/clarity (optional for v1, high value)

- Add a client-side grammar/clarity checker — **Harper** (WASM, built for this) or `nlprule`/`retext`. Produce `Finding[]` with `class:"correctness"|"clarity"`, anchored spans, on a ~600ms debounce, no network.
- Feed into the same `merge`/`buildSegments` pipeline. This is the real "Grammarly core" and is $0 marginal.
- If deferred, keep the existing tiny filler list in `tier0.ts` as a placeholder.

---

## 9. Workstream E — correctness fixes from review (fold in)

- **#4 paste/newlines:** add a `hard_break` node to the `pm/model.ts` schema and a `clipboardTextParser` (or split pasted text on `\n` into paragraphs/hard_breaks) so pasted multi-line drafts survive. Add round-trip tests for paste.
- **#5 wrong-instance anchoring:** have L3 return an approximate `index` or a few words of surrounding context per finding; pass it as the `hint` to `resolveQuote` (already supports a hint). 
- **#6 email/bare-domain false positive:** tighten link detection used by the assistant — require a scheme, or in `findUrls` reject a bare-domain match whose preceding char is `@` (email) — without breaking `tweetLengthInfo`/billing. Consider a dedicated `findLinks` for the assistant vs the counter's `findUrls`.
- **#7 stale `active` closure:** store `active`/hover state in a ref (or attach the `mousemove` handler outside the create-once effect) so the move-off path sees current state.
- **#9 bait/reply-hook drift:** export `REPLY_DRIVING` + `ENGAGEMENT_BAIT` from one module (e.g. `x-algorithm.ts`) and import in both `tier0.ts` and `prepublish-read.ts`; add a test pinning them equal.
- **#10 extension authenticity:** pass the user's `optimization_authenticity` to the extension's `runTier0` (fetch it via the background/status call) so X and dashboard score identically.
- Also remove dead code surfaced in review (`void errors` + the empty top-level `scroll` listener in `assistant-ui.js`, unused `rows` prop, `gradeBand` detour).

---

## 10. Decisions needed before/while building

1. **Embeddings provider** — OpenAI `text-embedding-3-small` (default), Voyage, or self-hosted. Affects cost, the new `OPENAI_API_KEY`/`VOYAGE_API_KEY` env, and dims.
2. **pgvector vs jsonb** — run `list_extensions`; if `vector` is enabled, use it (faster cosine, future kNN); else `jsonb` float arrays + JS cosine (fine at current scale).
3. **L3 auto-trigger threshold/idle** — default: Voice or Performance below ~65 AND idle ≥ 6s AND ≥ ~12 chars changed since last L3. Tune from telemetry.
4. **Plan gating** — which plans get the live assistant (free = L0–L2? paid = L3 too?). Reflect in `PLANS.*.limits`.
5. **Style-signal blend weight** in the L2 score (start small, e.g. 0.15) — tune against the calibration loop.

---

## 11. Testing & acceptance

- Unit: `vectors.ts` cosine + calibration map (pure, table-driven); `findLinks` email/bare-domain cases; bait-list parity test; `pm/model` paste round-trips.
- Integration: `/api/assistant/score` returns scores < 150ms p50 with a warm centroid; cold-start returns neutral + triggers refresh; `/api/live-read` reads cache-first and never 500s on write failure.
- Cost/behavior: a 2-minute compose session ⇒ 0 AI-generation quota writes, N embedding calls ≈ materially-changed drafts, 0–2 L3 LLM calls.
- Regression: `npx tsc --noEmit` clean, `npx vitest run` green, `npm run build` clean, extension `node build.js` + `node --check`.
- Manual: dashboard `/create` Compose tab + `/drafts/new` with the flag — scores feel live and unmetered; underlines correct; paste preserves lines; hover closes on move-off.

---

## 12. Constraints & gotchas

- `CLAUDE_ONLY` (`src/lib/ai/index.ts`) is for **chat generation only**; embeddings use a separate provider/path.
- Engine modules under `src/lib/analysis/assistant/*` must stay **pure + client-safe** (no node/supabase imports) — they're bundled into the extension via `chrome-extension/src/engine-entry.ts` (esbuild). Server-only logic (embeddings, supabase, LLM) lives in `live-read.ts`/`vectors.ts`/routes, never in the engine.
- Keep the **single-source engine**: don't re-introduce a hand-port; the extension consumes the bundled TS engine.
- `tsconfig` includes `**/*.ts`, so `chrome-extension/src/engine-entry.ts` is typechecked by the app — keep it clean.
- Memory rule: all engagement scoring goes through `weightedEngagement`; don't introduce divergent weights.
- This sandbox can't reach Supabase (DNS blocked) — validate DB paths on a real environment.

---

## 13. Out of scope (note, don't do here)

Landing-page IA repositioning (generation→editor, `GRAMMARLY_PIVOT_PLAN.md §3`); thread-level scoring; the extension's in-X underline fragility (separate hardening); the pre-existing `weightedTweetLength` space-counting question (predates this feature — verify separately before touching, it backs the live char counter).

---

### Suggested execution order
A (gating, ~½ day) → B (embeddings L2, ~2–3 days) → C (demote L3 + cache, ~1 day) → E (review fixes, ~1 day) → D (local grammar, optional). Ship A immediately; it removes the metering harm even before B lands.
