# Writing Assistant — Source of Truth

> A real-time "Grammarly for tweets": you write, and the assistant flags voice drift, X-native correctness problems, algorithm/reach risk, and missing high-lift patterns as you type, each with a one-click fix — plus a forward-looking "next step". One pure engine renders into three skins (dashboard editor, `/create` Write tab, Chrome extension).
> **Status (2026-07-04):** **Always on — the flag is gone.** (`src/lib/assistant/flag.ts` deleted; no env/localStorage hatch.) The editor is the front door of `/create`, generation an optional on-ramp; the `/reply` composer runs the same assistant in the reply voice; **threads run it per tweet** (`ThreadTweetEditor`). Shipped: L0 deterministic checks (reach + X-native correctness), L2 embedding scores, L3 **streamed** LLM read (voice drift + **algorithm** + correctness + missing patterns + next-step), **findings-coupled scoring** (voice and algorithm co-equal 0.40 pillars; every open finding deducts, so accepts always move the score), calibration loop, ProseMirror underlines, provider-pluggable L3 (Claude Haiku / Cerebras / Groq), accept/retain telemetry, extension parity. Deferred: L1 local WASM grammar, thread-level aggregate scoring, in-X underline hardening, real plan-gating.

## 1. Role in the product

The product pivoted from "AI post generator" to a writing assistant. Generation answers "make me a post"; the assistant answers the question users actually live in: "is *this* — the thing I just wrote — good, and why not?"

It closes the opacities a writer on X can't see:

- **Voice** — "does this still sound like *me*?" The assistant scores voice match (L2) and points at the exact spans that drift (L3).
- **Algorithm / reach** — "will X actually show this?" Reach levers (replies ≫ retweets > likes, dwell wins, external links / engagement-bait / hashtag spam / leading @mentions are demoted) are surfaced deterministically and for free (L0), grounded in X's open-sourced heavy-ranker weights (`src/lib/analysis/x-algorithm.ts`).
- **Correctness (X-native)** — "is this objectively wrong *for X*?" Not spelling/grammar (the browser does that) — markdown that renders literally on X (L0), plus unsupported claims / hook-promise mismatch / self-contradiction (L3).

Design rule that shapes everything: **underlines are always "fix this span" (a warning).** Positive/state signals are Badges; missing things are Chips; the single highest-leverage improvement is the **Next step**; holistic qualities (voice, performance, post score) are Scores. Never a green underline. (`src/lib/analysis/assistant/types.ts`)

## 2. The four-layer engine (L0–L3)

| Layer | Trigger / cadence | Engine | Marginal cost | Produces |
|---|---|---|---|---|
| **L0** Tier-0 | every keystroke (sync, in-process) | pure TS, no network (`tier0.ts`) | $0 | reach findings (link/bait/hashtag/leading-@mention), wall-of-text dwell caution, **X-native correctness** (markdown-won't-render), clarity (filler), voice (avoid-words), state **badges**, nudge **chips**, deterministic **Algorithm** sub-score |
| **L1** local grammar/clarity | *(deferred)* on ~600ms pause | local WASM grammar (Harper/`nlprule`) | ~$0 | spelling/grammar underlines |
| **L2** voice/performance | **~400ms** after a pause | OpenAI embeddings + cosine vs cached centroids (`vectors.ts`) | ~$0.00002, ~10–50ms | **Voice Match** (0–100) + **resemblance** (→ Performance grade) |
| **L3** Live Read | **settle-event + signal-movement + rate-limit** (see §3); or explicit deep check (an Accept **rebases locally** — no re-read) | **streamed** LLM (`live-read.ts` → `runLiveReadStream`), provider-pluggable | one cheap/fast LLM call, cached by `draft_hash` | anchored **voice-drift** + **algorithm** + **correctness** findings + guarded rewrites + **missing-pattern chips** + **next-step** + calibration voice score |

**L0 — Tier-0 (the "live feel").** Pure and client-safe, so the identical code runs in the dashboard and is bundled into the extension. It underlines: each external link (`reach`/`problem`, ~30–50% demotion, **removable**), each engagement-bait phrase (`reach`/`warning`, **removable**), the **3rd+ hashtag** (`reach`/`suggestion`, removable), a **leading @mention** (`reach`/`warning`, card only — X treats it like a reply), each guardrail **avoid-word** (`voice`/`warning`), each **filler word** (`clarity`/`suggestion`, removable), and **markdown that won't render on X** (`correctness`/`warning` — `**bold**`, `__`, backticks, `[label](url)`, `# heading`; stripped on accept). It emits badges (reply-hook / media / dwell / **wall-of-text** / over-limit) and `computeReachScore` 0–100 (link −25, bait −20, leading-mention −18, hashtag-spam −8, over-limit −12, wall-of-text −5, reply-hook +18…). `REPLY_DRIVING`/`ENGAGEMENT_BAIT` come from `x-algorithm.ts` (one source of truth, parity-tested). `avoidWords` + `authenticity` are fetched per-editor via `useVoiceGuardrails` (authenticity is `100 − optimization_authenticity`); `authenticity > 70` quiets the *soft* reach nags, never the hard penalties.

**L1 — local grammar (deferred).** Client-side WASM spell/grammar on a ~600ms debounce is still unbuilt. Note the **Correctness class is no longer a placeholder** — it's redefined as X-native (L0 markdown + L3 claim/promise/contradiction), which is the product-aligned version of "correctness". Generic spell-check (what a browser already does) is what L1 would add.

**L2 — embedding scores (the always-on loop).** "Does this sound like me / my winners?" is a *similarity* question, answered by embeddings (~100–1000× cheaper than an LLM judgment), which lets the loop be unmetered. `scoreDraft` embeds the draft once (`text-embedding-3-small`, 1536-d, `src/lib/ai/embeddings.ts`), normalizes, and cosines against the user's `voice_centroid` and `winners_centroid`; `mapCosineToScore` → 0–100. Cold start → neutral (`voice 70 / resemblance 50`) + background `refreshVoiceVectors`; **stale centroids (>7 days) also trigger a background rebuild**. Embeddings are OpenAI-only (not the Claude path). **Display resilience:** the score dial shows a pending "–" until the full blend lands (no half-computed number that jumps); if the L2 service is unavailable (e.g. embeddings quota), it **falls back to the deterministic Reach score** rather than hanging blank (`scoreUnavailable`). Per-draft vectors go through a **content-hash Redis cache** (`embedOneCached`, ~6h TTL, best-effort) so the L3 calibration sample and any re-score of the same text reuse the embedding instead of re-calling the API.

**L3 — Live Read (streamed LLM).** The LLM is reduced to what only it can do: explain, rewrite, and look ahead — across **both opacities, voice AND algorithm**. Its grounding includes a compact rendering of the heavy-ranker weights (from `x-algorithm.ts`) so algorithm findings cite real mechanisms. Given the user's assembled voice spec, top/median posts, patterns, and the ranking weights, it returns (NDJSON, one item per line): up to 4 **voice** drifts + up to 3 **algorithm** findings (`{"t":"algo"}` → class `reach`, signal `algorithm_fit` — weak hook, nothing inviting a reply, vague where specific wins, buried lede; explicitly told NOT to duplicate the deterministic checks) + up to 3 **correctness** issues (each a **verbatim `quote`** + approx `index` + terse issue/why + optional span rewrite), matched/missing pattern ids, a **`next_edit`** (imperative label + one-line detail), a one-line summary, and a `voice_score` used **only** to calibrate L2. Algorithm fixes are instructed to stay in the user's voice — never trade voice for reach. Findings stream to the client and render the moment each resolves. Read-first cached on `assistant_live_reads` by `(user, draft_hash, voice_type)`; persistence is `Promise.allSettled`. **Failed reads never enter the cache:** a mid-stream failure rethrows (skipping persistence; relayed as an SSE `error` event, which the client also refuses to cache — partial findings stay visible, uncached), and the one-shot path throws on an unparseable model response instead of persisting an empty result. Prompt rules keep issue/why ≤12 words and forbid flagging a reasonable phrasing; on top, every LLM rewrite passes a **deterministic minimal-edit guardrail** (`guardedFix`, `spans.ts`) — the fix is stripped (finding kept, one-click removed) if its quote never anchored (it would replace the *whole draft* via `applyReplacement`), it's a no-op restating the quote, it balloons past ~2.5× the quote length, or the quote covers >80% of the draft. This is the standard deterministic counter to LLM overcorrection. (`live-read.ts`)

**L3 provider is pluggable** (`LIVE_READ_PROVIDER` env — `openai | claude | grok | groq | cerebras`; unset = normal resolution → Claude). Default tier is `cheap`:
- **Claude** → `claude-haiku-4-5` (streamed via `messages.stream`, with a cached system prefix — see caching note).
- **Cerebras / Groq** → `gpt-oss-120b` (OpenAI-compatible, streamed). **These are ~4× faster to first finding** (measured: ~3.3s vs Haiku's ~13s on findings-heavy drafts, quality comparable) and are why the read feels snappy. Currently `LIVE_READ_PROVIDER=cerebras`. **gpt-oss is a reasoning model** — its hidden chain-of-thought spends from the same `max_tokens` budget *before* any content, so the live read passes `reasoningEffort: "low"` + a 2000-token budget (at 950, reasoning consumed everything → `finish_reason: "length"`, zero content, and an empty read got cached). It also returns scores on a 0–1 scale despite the 0–100 spec; `clamp()` normalizes fractional scores so calibration isn't poisoned. A stream that ends with **zero parseable NDJSON lines throws** instead of persisting an empty read.
- **Streaming is generalized** (`src/lib/ai/stream.ts`: `streamText` dispatches Claude vs OpenAI-compatible); a non-streamable provider (grok) falls back to the one-shot `runLiveRead`.
- **Prompt caching** (`cachePrefix` on Claude): measured **no-op for short-form** — Haiku 4.5 only caches a prefix ≥ ~4096 tokens and our grounding is ~3000–3500, so caching doesn't engage (the wiring is kept; it auto-helps any future large-grounding user). `warmLiveRead` (route `{warm:true}`) primes the prefix on settle — likewise a no-op for short-form.

## 3. Data flow

```
keystroke ──► L0 runTier0 (sync) ──► underlines + badges + Reach sub-score      [every render]
   │
   ├─ pause ~400ms ──► POST /api/assistant/score ──► scoreDraft (embed + cosine)
   │                     └─► Voice Match (0–100) + Performance grade            [always-on, unmetered]
   │
   └─ SETTLE (idle after a sentence boundary) + score low/dropped + rate-limit
        ──► POST /api/live-read {stream:true}  (SSE, NDJSON)
        └─► voice + correctness findings + rewrites + missing-pattern chips + next-step
        (or via explicit deep check; an Accept rebases locally — never a forced re-read)
```

The client brain is `useAssistant.ts`. **Cadences:** L2 debounces `L2_DEBOUNCE_MS = 400` (min 5 chars), and is also re-run immediately on Accept so an applied fix visibly moves the score. **L3 is event-driven, not a poll:** it fires a beat after the writer *settles* — `L3_SETTLE_MS = 1200` at a sentence boundary/newline, `L3_IDLE_MS = 3500` mid-sentence — **and** the cheap L2 score is low (< `L3_SCORE_THRESHOLD = 65`) OR dropped ≥ `L3_DROP_DELTA = 6` since the last read, **and** the draft moved ≥ `L3_MIN_DELTA_CHARS = 12`, hard-capped to one read per `L3_MIN_INTERVAL_MS = 9000` (latest-wins). `lastL3Text` is stamped at the *start* of a read so the material-change gate suppresses re-fires while it's in flight, and a `L3_WATCHDOG_MS = 30000` watchdog aborts any stalled read so "Reading…" can't hang. **On Accept: rebase, don't re-infer** (the Grammarly suggestion-lifecycle pattern) — the accepted finding and any live finding whose span overlaps the edited range are invalidated; every other live finding survives and re-anchors by quote against the new text on the next render (no LLM round-trip; a span-less whole-draft accept clears all live findings). `runDeepCheck()` bypasses the gate. Both layers are **hash-cached client + server**. `mergeReport` (`merge.ts`) re-anchors every span against the *current* text with two invalidation rules: a live finding that **was** anchored and whose quote disappeared is **dropped** (the user fixed it themselves — never nag about fixed text), while a never-anchored finding stays a panel-only card. It also runs **cross-layer arbitration**: a live finding whose span overlaps a Tier-0 finding is dropped (deterministic wins — free, instant, guaranteed-safe fix; no two competing suggestions on the same characters).

**Streaming consumer.** `doFindings` requests `{stream:true}`, reads the SSE, and accumulates events (`finding` / `chip` / `next` / `summary`, or a single `full` on cache-hit/one-shot) into the report incrementally, pushing a fresh snapshot on each so underlines appear progressively. Any stream failure falls back to the one-shot JSON read.

**Accept/retain telemetry — now a closed loop.** Accept/Dismiss (and, 15s later, whether the accepted change was **retained**) are logged fire-and-forget to `POST /api/assistant/telemetry` → `assistant_suggestion_events`. The read side: `GET /api/assistant/telemetry` aggregates the user's last 500 events into **suppressed signals** — any `signal` dismissed ≥3 times with zero accepts/retains stops being shown (soft severities only; a hard `problem` like the link penalty states a fact and always shows). `useAssistant` fetches this once per mount and filters the report. Dismissals themselves **persist across sessions** (localStorage, content-stable keys, capped at 300) — a closed nag stays closed on reload.

**Calibration loop.** Each Live Read calls `recordCalibrationSample(text, llmVoiceScore)` fire-and-forget. It embeds the draft, cosines it to the voice centroid, and folds the `(cosine, LLM-score)` pair into per-user online least-squares accumulators (`accumulateCalibration`, exponential forgetting past n=200). After ≥ 8 pairs, `mapCosineToScore` switches from the default affine map to the user's fitted line, so the cheap L2 number tracks the rarer L3 judgment. Centroids are rebuilt by `refreshVoiceVectors` (cold start, staleness, tune-up, or cron) and preserve calibration across rebuilds.

## 4. Core types

All in `src/lib/analysis/assistant/types.ts` — dependency-free and client-safe.

- **`Finding`** → an **underline**. `class` ∈ `correctness | clarity | voice | reach`; `severity` ∈ `suggestion | warning | problem`; `title`, `why`, optional `span`, optional `replacement` (one-click accept), `source` ∈ `tier0 | live`. No `span` → panel-only card.
- **`FindingSpan`** = `{ quote, start, end }`. **The LLM returns the verbatim `quote`, never offsets; offsets are resolved locally** (`spans.ts`, `resolveQuote`). Quote not found verbatim → no span → card, never a guessed underline.
- **`Badge`** → a discrete **state** (`good | caution | info`). **`SuggestionChip`** → **missing / a nudge** (`missing_pattern | nudge`), optional `insert`/`multiplier`.
- **`NextStep`** = `{ label, detail }` — the forward-looking "do this next" from the Live Read (rendered as a prominent card, not an underline).
- **`Scores`** = `{ post, postProvisional, voice, performance, reach }`. `voice` (0–100) and `performance` (A–F) are `null` until L2 lands; `reach` (the **Algorithm** sub-score) is always present. `post` = `0.40·voice + 0.40·reach + 0.20·performance` — **voice and algorithm are co-equal pillars** (the two opacities), performance is the personal-winners signal — renormalized over present components, `provisional` until L2 fills the rest (`score.ts`).
- **Findings-coupled deductions (`FINDING_DEDUCTIONS`, `scorePenalties`)** — the invariant that accepting (or dismissing) *any* suggestion visibly moves the headline. Every open finding holds points out of the score: live voice drift −6 and guardrail avoid-word −4 from the Voice sub-score; live algorithm finding −7 from the Algorithm sub-score (tier-0 reach findings are priced directly in `computeReachScore`); correctness −5 and clarity −1 (capped −4) from the blended post. Hidden (dismissed/suppressed) findings are filtered *inside* `mergeReport` (`isHidden` param) so their deductions release immediately. The displayed sub-scores are the post-deduction values — the numbers the user sees are the numbers the blend uses. Invariant pinned by the "findings-coupled scoring" test suite (`assistant.test.ts`).
- **`AssistantReport`** = `{ findings, badges, chips, scores, charInfo, nextStep }` — the single payload every surface renders.

**Class taxonomy & overlap.** `FINDING_CLASS_META` priority `correctness(4) > voice(3) > reach(2) > clarity(1)`; higher priority wins a contested character (`buildSegments`). Color = class, underline **style = severity** (`palette.ts`, now **dotted / solid** — the old wavy/double squiggles were replaced with clean thin underlines; portable hex so the extension works on X's pages).

## 5. Surfaces

One engine, three skins — all consuming `AssistantReport`:

1. **Dashboard editor** (`DraftEditor.tsx`) — ProseMirror editor (`HighlightedTextarea.tsx`) where underlines are **real inline decorations** (`pm/decorations.ts`), never a pixel overlay. Hover a span → `SuggestionPopover`. The readout is split: **`AssistantScorePanel`** (score readout — `ScoreDial` + Voice / Performance / Algorithm + badges) sits **inline beside the editor, vertically centered**, and **`AssistantSuggestionList`** flows **full-width below**, grouped into co-equal sections (**Voice**, **Algorithm & reach**, **Correctness**, **Proven patterns**, **Clarity**) with the **Next step** card on top. `useVoiceGuardrails` feeds avoid-words + authenticity. There is **no** separate "voice-check" button or publish gate (the live assistant replaced it). **Threads** (`XThreadEditor`) render a **`ThreadTweetEditor`** per tweet: every tweet gets Tier-0 underlines + its own L2 score (`isThread: true`); the **focused** tweet alone auto-runs L3 and shows the inline score panel + suggestion list ("Tweet n of m").
2. **`/create` Write tab** (`CreatePage.tsx`) — the same inline score + suggestions-below layout for single posts; the thread branch uses the same per-tweet `ThreadTweetEditor`. The default front door of compose; the assistant is always on (no flag).
3. **Chrome extension** (`chrome-extension/`) — `engine-entry.ts` bundles the **real TS engine** into `dist/assistant-engine.js` (`window.AFXAssistant`). Injects a bottom-right score readout + finding count into X's composer, a panel of Tier-0 suggestions, and best-effort inline underlines (fail-soft). Extension = L0 only.

## 6. Endpoints & gating

Writing-assistant runtime routes are **subscription-gated via `requireFeature(user.id, "writingAssistant")`** and **never metered**.

| Route | Layer | Method | Gating | Notes |
|---|---|---|---|---|
| `/api/assistant/score` | L2 | POST | `requireFeature` | embed + cosine; cold start / stale → neutral + background refresh |
| `/api/live-read` | L3 | POST | `requireFeature` | **streams SSE** when `{stream:true}`; `{warm:true}` primes the prompt cache; `maxDuration = 60` |
| `/api/assistant/telemetry` | — | POST | `requireFeature` | logs accept/dismiss/retain → `assistant_suggestion_events` (best-effort, no model call) |
| `/api/assistant/telemetry` | — | GET | `requireFeature` | aggregates recent events → `suppressed_signals` (≥3 dismisses, 0 accepts) for per-user suggestion suppression |
| `/api/assistant/vectors/refresh` | L2 setup | POST | `requireFeature` | rebuild caller's centroids on demand / post-tuneup |
| `/api/cron/assistant-vectors` | L2 setup | GET | `CRON_SECRET` | nightly batch refresh |

`writingAssistant` is a boolean entitlement (`src/types/subscription.ts`), **`true` on every plan today** (table-stakes). Flip `free → false` to make it paid; `requireFeature` already returns the 403.

## 7. Key files

| Path | What |
|---|---|
| `src/lib/analysis/assistant/types.ts` | Finding/Badge/Chip/**NextStep**/Scores/AssistantReport + `FINDING_CLASS_META` |
| `src/lib/analysis/assistant/tier0.ts` | L0 deterministic engine (reach + markdown correctness + reach score) |
| `src/lib/analysis/assistant/spans.ts` | `resolveQuote` / `resolveFindings` (incl. self-fix invalidation) / `guardedFix` (minimal-edit guardrail) / `buildSegments` / `applyReplacement` |
| `src/lib/analysis/assistant/score.ts` | `composeScores`, `resemblanceToGrade`, bands |
| `src/lib/analysis/assistant/merge.ts` | `mergeReport` (L0+L2+L3 → report, incl. `nextStep`) |
| `src/lib/analysis/assistant/vectors.ts` | **server-only** L2: centroids, `scoreDraft`, `refreshVoiceVectors`, staleness, calibration |
| `src/lib/analysis/assistant/palette.ts` | portable hex palette (class color; severity = dotted/solid) |
| `src/lib/ai/embeddings.ts` | `embedText` + `embedOneCached` (content-hash Redis cache) (OpenAI `text-embedding-3-small`, 1536-d) |
| `src/lib/analysis/live-read.ts` | L3: `runLiveRead` (one-shot) + `runLiveReadStream` (NDJSON) + `warmLiveRead`; `LIVE_READ_PROVIDER` override |
| `src/lib/ai/stream.ts` | streaming dispatch (`streamText`, `streamClaudeText`, `streamOpenAICompatibleText`, `STREAMABLE_PROVIDERS`) |
| `src/lib/ai/providers/{groq,cerebras}.ts` | OpenAI-compatible clients + `gpt-oss-120b` model maps |
| `src/lib/ai/index.ts` | `AIProvider` (`openai\|claude\|grok\|groq\|cerebras`), dispatch, `cachePrefix`, `createOpenAICompatibleCompletion` |
| `src/lib/analysis/x-algorithm.ts` | ranker weights, `REPLY_DRIVING`, `ENGAGEMENT_BAIT` |
| `src/components/assistant/useAssistant.ts` | client brain: cadences, streaming consumer, accept/retain, watchdog, warm |
| `src/components/assistant/useVoiceGuardrails.ts` | fetch avoid-words + authenticity for the editor |
| `src/components/assistant/{AssistantPanel,ScoreDial,SuggestionPopover}.tsx` | dashboard UI (`AssistantScorePanel` + `AssistantSuggestionList`) |
| `src/components/compose/HighlightedTextarea.tsx` + `pm/{model,decorations}.ts` | ProseMirror editor + underline decorations |
| `src/app/api/assistant/{score,telemetry}/route.ts`, `src/app/api/live-read/route.ts` | L2 / telemetry / L3 endpoints |
| `supabase/migrations/20260625_assistant_vectors.sql`, `20260626_assistant_suggestion_events.sql` | `user_assistant_vectors`, `assistant_live_reads`, `assistant_suggestion_events` (+ RLS) |

## 8. Current state, gaps & deferred

**Live / shipped:**
- L0 deterministic engine on every keystroke (reach: link/bait/hashtag/leading-@mention/wall-of-text; X-native correctness: markdown-won't-render; clarity: filler; voice: avoid-words), both web surfaces + extension.
- L2 embedding scores + calibration; score display gated + Reach fallback on outage; staleness refresh.
- **L3 streamed** Live Read with verbatim-quote anchoring, voice + **algorithm** + correctness findings, missing-pattern chips, **next-step prediction**, read-first cache; grounding includes the heavy-ranker weights so algorithm findings cite real mechanics.
- **Findings-coupled score** (2026-07-04): `post = 0.40·voice + 0.40·algorithm + 0.20·performance`; every open finding holds a deduction (`FINDING_DEDUCTIONS`), so any accept/dismiss visibly moves the headline — invariant pinned in tests.
- **Per-tweet thread assistant** (2026-07-04): `ThreadTweetEditor` in both thread editors — Tier-0 + L2 on every tweet, L3 + panel on the focused tweet.
- **Provider-pluggable L3** (`LIVE_READ_PROVIDER`): Claude Haiku default, **Cerebras/Groq `gpt-oss-120b`** for ~4× lower first-finding latency (currently Cerebras).
- **Event-driven trigger** (settle + signal-movement + rate-limit + watchdog); **accept rebases locally** (invalidate-overlapping, quote re-anchor, no forced re-read); accept/retain telemetry **with the loop closed** (per-user signal suppression via `GET /api/assistant/telemetry`; dismissals persist in localStorage).
- **Suggestion hygiene** (best-practices alignment, 2026-07-04): self-fix invalidation (edited-away quotes drop their finding), cross-layer arbitration (Tier-0 wins overlapping spans), deterministic minimal-edit guardrails on LLM rewrites (`guardedFix`).
- Resilience: SSE teardown guarded against client-abort; gateway/Redis admission fails open; read watchdog; **failed/partial reads are never cached** (server or client); per-draft embeddings deduped via content-hash Redis cache.
- Both runtime routes subscription-gated + unmetered; voice-check button + publish gate removed.

**Deferred / gaps:**
- **L1 local WASM grammar** (generic spell/grammar) not built.
- **Thread-level aggregate scoring** — per-tweet assistant is live; a whole-thread score (hook-tweet strength, arc across tweets) is not.
- **In-X (extension) underlines** best-effort/fail-soft; still need live-page hardening.
- **No real plan gating** — `writingAssistant` is `true` on every plan; one-line flip to make it paid.
- **Prompt caching** is a no-op for short-form grounding (Haiku's ~4096-token cache floor) — kept wired for future long-form users.
- **Fine-tuned/distilled small model** for L3 (industry frontier) — future.

**Infra dependencies to watch:** L2 score + calibration depend on the **OpenAI embeddings** account (a 429 there disables the score → Reach fallback). Metering/rate-limiting depend on **Upstash Redis** (now fails-open for the live read). The live read depends on the **Cerebras/Groq** account behind `LIVE_READ_PROVIDER`. **Data note:** with Cerebras/Groq active, drafts leave to a third party — confirm no-training/retention terms + add as subprocessors before enabling for real users.

## 9. Related docs

- `docs/reference/model-call-index.md` — every model call incl. the live-read provider/tier.
- `docs/features/voice-engine.md` — the voice profile / patterns / posts pool the assistant scores against.
- `docs/features/billing-plans-and-credits.md` — entitlements vs metered credits.
- Design rationale (intent, partly stale — defer to code): root `GRAMMARLY_PIVOT_PLAN.md`, `GRAMMARLY_PIVOT_UX.md`, `GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md`.
