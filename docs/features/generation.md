# Generation (AI On-Ramps) — Source of Truth

> AI generation produces a *first draft* from a topic; the human then writes the post in the live-assistant editor. **Status (2026-06-26):** repositioned post-pivot as optional **on-ramps that seed the editor**, not the product centerpiece.

---

## 1. Role post-pivot (on-ramp, not hero)

The product pivoted to a real-time writing assistant ("Grammarly for tweets"). Generation no longer is the destination — it is a way to *seed* the editor when the user wants a starting point.

- The Create page's front door is the **Write** (compose) tab, not generation. A bare `/create` opens the live-assistant editor; only a URL that carries a generation intent (`?topic=` or `?inspiration=`) or an explicit `?tab=new` opens **AI Generate** (`src/components/create/CreatePage.tsx:86-104`).
- Every generation flow ends with the same handoff: **AI proposes a draft → the user clicks "Edit & Publish" → the draft seeds the editor** (`writePersistedValue("draft:new:seed", …)` then `/drafts/new`, `src/components/create/CreatePage.tsx:554-565`). Nothing is written to the DB at generation time — the post only becomes a draft row if the user explicitly saves it later (`src/app/drafts/new/page.tsx:9-17`).
- The on-screen copy frames it the same way: "Write your post with the live assistant — or generate a starting point" (`src/components/create/CreatePage.tsx:662-663`).

Metering reinforces the split: generation costs **daily quota slots** (`requireAiGeneration`, §6), whereas the live assistant is a **subscription entitlement** (`writingAssistant`, granted to every plan, never metered per-keystroke — `src/types/subscription.ts:14-20,49`).

---

## 2. Modes

All four modes share one voice context (the assembled system prompt, §5), a shared priority ladder (explicit instruction > inspiration > selected patterns > tuned voice), and the rate-limit + daily-quota guards. They differ in how much work they do.

### Quick (`generate-from-topic`) — one-shot, 1 slot

`src/app/api/drafts/generate-from-topic/route.ts`

- `POST /api/drafts/generate-from-topic`, `maxDuration = 60` (line 4).
- Guard order: `guardLlmRoute` (burst/IP/global) → `requireAiGeneration(user.id, "generate-from-topic")` = **1 slot** (lines 41-46).
- Inputs: `topic` (≥3 chars, line 78), `draftType`, `patternIds`, `generateCount` (default 1, clamped 1-10, line 76), optional `inspirationPost`, one-off `instructions`, `previousVariations` (lines 49-72).
- Patterns: only **explicitly selected** patterns are applied, filtered through `isGenerationApplicablePattern`; no default top-patterns are force-injected (lines 92-103, 119).
- Single user-prompt assembles the priority ladder + instruction/inspiration/pattern/format/prior-variation blocks (lines 124-180), asks for a JSON array.
- Model: `createChatCompletion({ provider: resolveProvider(ai_model), modelTier: "fast", … })` (lines 113, 188-210). Temperature `0.7` for a single first-gen (tighter voice), `0.85` for batches/steering (line 205). `maxTokens: 2000`.
- Output: JSON array parsed from the response text (regex `\[…\]`, lines 216-218); each option shaped `{ type, content, topic, applied_patterns, metadata }` and returned **in memory** — nothing saved (lines 228-242).

### Agent (`generate-agentic`) — research→draft→voice-check→iterate→read, 3 slots, SSE + async QStash path

`src/app/api/drafts/generate-agentic/route.ts`

- `POST /api/drafts/generate-agentic`, `maxDuration = 300` (line 16).
- Guard order: `guardLlmRoute({ cost: 3 })` (the weight-3 burst cost caps the heavy chain, runs before the daily gate so a throttle doesn't burn slots — lines 32-38) → `requireAiGeneration(user.id, "generate-agentic", 3)` = **3 slots** (lines 40-43).
- Same inputs as Quick (lines 45-60). Patterns resolved identically; when no explicit selection, it falls back to top-3 enabled generation-applicable patterns (lines 66-86).
- **Two transports**, switched by `AGENTIC_ASYNC` (`process.env.AGENTIC_ASYNC === "true"`, line 12):
  - **Async (QStash)**: inserts a `generation_jobs` row (`status: "queued"`), enqueues via `enqueueLlmJob`, returns `{ jobId, mode: "async" }` with status **202** (lines 90-125). The worker `src/app/api/qstash/llm-job/route.ts` runs `runPostPipeline`, persisting coarse `progress` (steps/scores/research; `draft_delta` dropped as too chatty, `complete` becomes `result`) and flipping `status` to `done`/`failed` (lines 100-161). Client polls `GET /api/drafts/generation-jobs/[id]`.
  - **Sync (default, SSE)**: streams `runPostPipeline` events as `data: {…}\n\n` Server-Sent Events; `content-type: text/event-stream`, `X-Accel-Buffering: no` to flush immediately; always closes with `{ type: "end" }` (lines 128-165).

### Refine — lightweight single-pass revise

`src/app/api/drafts/refine/route.ts`

- `POST /api/drafts/refine`, `maxDuration = 60` (line 17). Costs **1 slot** (`requireAiGeneration(user.id, "drafts-refine")`, line 41).
- Mode-agnostic: takes an existing Quick *or* Agent draft (`text`/`tweets`) plus `feedback`, revises it in **a single Claude call** — does **not** run research or the pipeline (lines 23-26, 44-98).
- The feedback is treated as an explicit instruction that takes priority over default voice tendencies (lines 76-81). Uses the scoped voice prompt (`includePatterns: false`), `PIPELINE_MODEL`, `max_tokens: 1200`, through the gateway (lines 69, 84-98).
- Output cleaned via `cleanDraft` / `splitThread`, returned as `{ option }` with `metadata.generation_type = "refined"` (lines 100-116).

### Reply generation

`src/app/api/generate-reply/route.ts`

- `POST /api/generate-reply`. Dual-auth (Bearer token from the extension or cookie from the dashboard, `getDualAuthUser`, line 129). Costs **1 slot** (`requireAiGeneration(user.id, "generate-reply")`, line 144).
- Builds rich context from the post being replied to: parent, quoted tweet, link preview, media alt-text (`buildContextPrompt`, lines 79-124) plus an optional one-off `tone` ANGLE subordinate to the tuned voice (`getToneInstruction`, lines 59-74).
- Voice prompt from `getAssembledPromptForUser` (reply mode, default), falling back to `REPLY_SYSTEM_PROMPT` on failure (lines 168-175). `modelTier: "fast"`, `temperature: 0.7`, `maxTokens: 400`, `jsonResponse: true` (lines 198-210).
- Returns up to 3 replies labeled `["Punchy","Insight","Spicy"]`, cleaned of leaked meta-text and truncated to 280 chars (lines 250-281).

---

## 3. The agentic pipeline (`post-pipeline.ts`) — steps, events, models

`src/lib/ai/agentic/post-pipeline.ts`. A **code-orchestrated** workflow (not an open-ended agent): each step is a discrete, streamable unit so the UI renders the chain live (lines 10-13). `runPostPipeline` is an async generator yielding `PipelineEvent`s (lines 347-466).

**Model:** `PIPELINE_MODEL = "claude-sonnet-4-6"` (line 27) — Claude-only by construction, independent of the user's model picker. Every call goes through the gateway (admission gate + backoff + breaker + token metering); streaming calls gate up front (`gatewayAdmit`) and meter actual usage from the final message (`recordUsage`, lines 314-340).

**Steps (each emits `{type:"step", status:"running"|"done", label}`):**

1. **research** (lines 251-308, 353-362) — Claude + server-side web search (`web_search_20250305`, `max_uses: 4`); loops up to 5 turns handling `pause_turn`; writes a 3-6 bullet brief and dedupes sources (capped at 6). System prompt prioritizes recent/specific/credible facts and forbids editorializing (`RESEARCH_SYSTEM`, lines 86-90). Emits `{type:"research", sources, brief}`.
2. **draft** (lines 364-380) — streams the draft in the user's tuned voice (`getAssembledPromptForUser(..., "post", { includePatterns: false })`), grounded in the brief, via `buildDraftPrompt` (priority ladder + instruction/inspiration/pattern/format/research blocks, lines 172-222). Streams `{type:"draft_delta", text, iteration}`. `max_tokens: 1200`.
3. **voice_check** (lines 382-394) — `runVoiceCheck` scores 0-100 against the same scoped spec, told via `constraints` not to penalize the draft for following the user's explicit choices (`buildConstraints`, lines 105-115). Emits `{type:"voice_score", iteration, score, deviations, suggested_edit}`.
4. **iterate** (lines 396-429) — refine only when below `VOICE_TARGET` (75); a **second** pass only when still below `VERY_LOW` (55); `MAX_ITERATIONS = 2` (lines 32-34). So most drafts get **0 or 1** voice pass. Keeps the best-scoring draft (`buildRevisePrompt`, lines 224-244).
5. **read** (lines 431-449) — `runPrepublishRead` on the winning draft: resemblance to the user's top performers + how X's algorithm will treat it. **Best-effort and fully guarded** — a failure here never fails generation. Emits `{type:"read", read}`.

**Final:** `{type:"complete", option, voiceCheck, sources}` — `option` matches the one-shot shape, with `metadata.voice_score`, `metadata.sources`, and (when present) `metadata.prepublish_read` so the read survives a reload (lines 451-465). Full event union at lines 66-72.

---

## 4. Seeding the editor (the on-ramp handoff)

This is where generation hands off to the assistant. It is deliberately a **client-side, DB-free** handoff.

- **Quick** (`runQuick`, `src/components/create/CreatePage.tsx:402-419`): POSTs, takes `data.options[0]`, folds it into the variation history via `applyOption`.
- **Agent** (`runAgent`, lines 422-459): resets chain state, POSTs, then branches on `content-type` — `application/json` + `mode:"async"` → `consumeAgenticJob` polls the job every 1.5s up to 200 times (lines 265-290); otherwise reads the SSE stream via `consumeAgenticStream` (lines 294-368), driving the live `AgenticChain` view (steps, sources, live `draft_delta` text, voice scores, engagement read).
- **Refine** (`handleRefine`, lines 509-547): POSTs to `/api/drafts/refine`, appends the returned option as a new variation. **Regenerate** (`handleRegenerate`, lines 492-505) replays the exact last query in the same mode as a new variation.
- **The on-ramp itself** (`handleUseDraft`, lines 554-565): writes the chosen option to sessionStorage under `draft:new:seed` and routes to `/drafts/new`. **No DB write.** `src/app/drafts/new/page.tsx` reads the seed once on mount (`readPersistedValue(SEED_KEY)`) and renders `<DraftEditor draftId={null} initialContent={seed.content} …>`; the seed is cleared only after Save/publish succeeds (`onPersisted`, lines 30-69). The manual compose tab uses the identical handoff (`handleContinueCompose`, lines 624-649).

`AgenticChain` (`src/components/create/AgenticChain.tsx`) renders the live timeline: per-step status icons, research source links, the streaming draft with a cursor, voice-score progression, and the pre-publish "Engagement read" card with algorithm flags and a "How X treats this" disclosure.

---

## 5. Prompt assembly & model routing

### Prompt assembly — `getAssembledPromptForUser`

`src/lib/openai/prompts/prompt-assembler.ts:614-702`. One canonical tuned context, assembled in precedence order (lines 574-585): base scaffold → **precedence note** → voice controls → guardrails → niche/strategy → proven patterns → special notes → **voice examples** → inspiration → generation feedback. Token-budgeted per section.

- `voiceType` selects `post` vs `reply` base prompt and the matching examples/inspiration/feedback rows.
- `options.includePatterns` (default `true`): **Quick, Agent, and Refine all pass `false`** so the tuned voice stays the baseline and default patterns aren't force-injected — only patterns the user explicitly selected for that post are applied via the per-request user prompt (lines 119-122 of generate-from-topic; 368 of post-pipeline; 69 of refine; assembler note at 619-624).
- Precedence within the prompt (`buildPrecedenceNote`, lines 161-170): the user's real examples are the strongest voice signal and are never overridden; patterns apply only where they fit the authentic voice.
- Pattern injection intensity follows the `optimization_authenticity` dial — a user who chose authenticity over engagement gets **no** pattern injection (lines 476-495).

### Model routing — `src/lib/ai/index.ts`

- Providers: `openai | claude | grok` (line 15). `ModelTier = "fast" | "standard" | "cheap"` (line 18) — **"cheap"** is the high-volume tier (structured extraction, voice chat), resolving to Haiku 4.5 on Claude (`CLAUDE_MODELS`, `src/lib/ai/providers/claude.ts:14-23`).
- **`CLAUDE_ONLY`** (`process.env.AI_CLAUDE_ONLY !== "false"`, line 26): while on, `resolveProvider(stored)` returns `"claude"` regardless of the stored `ai_model` picker — the multi-provider switching code stays intact but is bypassed (lines 33-36). Set `AI_CLAUDE_ONLY=false` to re-enable the picker.
- `CLAUDE_MODELS`: `fast` and `standard` → `claude-sonnet-4-6`; `cheap` → `claude-haiku-4-5` (`providers/claude.ts:14-23`). Claude client: `timeout: 45_000`, `maxRetries: 2` (line 7).
- The agentic pipeline and Refine call Claude **directly** at `PIPELINE_MODEL` (`claude-sonnet-4-6`), not through `createChatCompletion`/the tier map — an explicit, independent model choice.

---

## 6. Metering & quota (`requireAiGeneration`, slots — vs the unmetered assistant)

`src/lib/stripe/gate.ts:42-66`. Generation is metered by **daily generation slots**, distinct from the assistant's `requireFeature` entitlement gate (lines 10-34).

- `requireAiGeneration(userId, endpoint, weight = 1)`: reads `checkAiGenerationLimit`, blocks with **HTTP 429** + `code: "AI_LIMIT"` unless `remaining >= weight`, then logs `weight` usage rows (lines 47-63).
- **Slot costs:** Quick = 1, Refine = 1, Reply = 1, **Agent = 3** (the pipeline is web search + draft + voice checks + refine, so it's weighted heavier).
- **Daily limits** (`src/types/subscription.ts`, `aiGenerationsPerDay`): Free = **5/day** (line 44); Pro / Agent / Agency = **Infinity** (lines 72, 99, 134).
- `checkAiGenerationLimit` (`src/lib/stripe/subscription.ts:56-86`): `Infinity` plans short-circuit to unlimited; otherwise counts today's `ai_usage_log` rows for the user. `logAiGeneration` writes `weight` rows in one insert so a heavier action consumes multiple slots (lines 93-107). Effective plan falls back to Free when the subscription isn't active (`isSubscriptionActive`).
- **Contrast — the live assistant is *not* metered this way.** `writingAssistant` is a subscription entitlement (`requireFeature`), never a per-tick quota; the live loop can't tick a credit on every pause, and it's currently table-stakes (granted on every plan, `src/types/subscription.ts:14-20,49,77,106,131`).
- Client surfaces remaining quota via `useSubscription().aiLimitReached` / `<AiUsageCounter>`, disables the Generate button when reached, and `refetchSubscription()` after each run (`CreatePage.tsx:145,482,919-940`).

---

## 7. Key files

| Concern | Path |
| --- | --- |
| Quick generation route (1 slot) | `src/app/api/drafts/generate-from-topic/route.ts` |
| Agent generation route (3 slots, SSE + async) | `src/app/api/drafts/generate-agentic/route.ts` |
| Agentic pipeline (research→draft→check→iterate→read) | `src/lib/ai/agentic/post-pipeline.ts` |
| Async QStash worker | `src/app/api/qstash/llm-job/route.ts` |
| Async job poll | `src/app/api/drafts/generation-jobs/[id]/route.ts` |
| Refine (single-pass revise) | `src/app/api/drafts/refine/route.ts` |
| Reply generation | `src/app/api/generate-reply/route.ts` |
| Generation feedback (like/dislike) | `src/app/api/generation-feedback/route.ts` |
| Prompt assembly | `src/lib/openai/prompts/prompt-assembler.ts` |
| AI provider routing / tiers / CLAUDE_ONLY | `src/lib/ai/index.ts` |
| Claude models (incl. "cheap"→Haiku) | `src/lib/ai/providers/claude.ts` |
| Quota gate (`requireAiGeneration`) | `src/lib/stripe/gate.ts` |
| Daily-limit logic | `src/lib/stripe/subscription.ts` |
| Plans / daily limits | `src/types/subscription.ts` |
| Create page (runQuick/runAgent/handleRefine/handleUseDraft) | `src/components/create/CreatePage.tsx` |
| Live chain view | `src/components/create/AgenticChain.tsx` |
| Editor seed handoff | `src/app/drafts/new/page.tsx` |

---

## 8. Current state & gaps

- **On-ramp framing is enforced in routing but not exclusive.** Generation still has a full first-class tab ("AI Generate") with mode picker, variation history, regenerate, and refine — a sizeable surface for an "optional" path. The editor is the default only for bare/no-intent `/create` (`CreatePage.tsx:86-104`).
- **`AGENTIC_ASYNC` is env-flagged**, not per-user/adaptive. Sync SSE is the default; the async/QStash path only activates when `AGENTIC_ASYNC === "true"`. Both paths share `runPostPipeline`, but the async poller drops `draft_delta` so the queued path has no live streaming-text preview (`qstash/llm-job/route.ts:126`).
- **Generation feedback is collected but only loosely closed-loop.** `generation-feedback` stores like/dislike (`route.ts`), and the assembler injects recent feedback into the prompt (`buildFeedbackSection`, assembler 343-396) — but only the most recent 10 rows, budget-capped (~400 tokens), with no scoring/decay.
- **Pipeline model is hardcoded** (`PIPELINE_MODEL = "claude-sonnet-4-6"`) and bypasses the tier map — intentional, but means the Agent path ignores the model picker and the `cheap`/Haiku tier entirely.
- **JSON parsing in Quick is regex-based** (`responseText.match(/\[…\]/)`, generate-from-topic 216-218) rather than structured output; malformed output yields a 500 with no retry/repair.
- **Sync `maxDuration = 300`** for the Agent route assumes the platform allows a 5-minute streaming function; the async path exists partly to avoid holding it open (route comment 10-11).

---

## 9. Related docs

- Voice engine & assembly internals: `docs/features/voice-engine.md`, `docs/voice-system.md`
- The live writing assistant (the post-pivot hero): `docs/features/writing-assistant.md`
- Plans, daily limits, and credits: `docs/features/billing-plans-and-credits.md`, `docs/api/credits.md`
