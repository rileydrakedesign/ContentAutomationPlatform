# Generation (AI On-Ramps) — Source of Truth

> AI generation produces a *first draft* from a topic; the human then writes the post in the live-assistant editor. **Status (2026-06-26):** repositioned post-pivot as optional **on-ramps that seed the editor**, not the product centerpiece.

---

## 1. Role post-pivot (on-ramp, not hero)

The product pivoted to a real-time writing assistant ("Grammarly for tweets"). Generation no longer is the destination — it is a way to *seed* the editor when the user wants a starting point.

- The Create page's front door is the **Write** (compose) tab, not generation. A bare `/create` opens the live-assistant editor; only a URL that carries a generation intent (`?topic=` or `?inspiration=`) or an explicit `?tab=new` opens **AI Generate** (`src/components/create/CreatePage.tsx:86-104`).
- Every generation flow ends with the same handoff: **AI proposes a draft → the user clicks "Edit & Publish" → the draft seeds the editor** (`writePersistedValue("draft:new:seed", …)` then `/drafts/new`, `src/components/create/CreatePage.tsx:364`). Nothing is written to the DB at generation time — the post only becomes a draft row if the user explicitly saves it later (`src/app/drafts/new/page.tsx:9-17`).
- The on-screen copy frames it the same way: "Write your post with the live assistant — or generate a starting point" (`src/components/create/CreatePage.tsx:662-663`).

Metering reinforces the split: generation costs **daily quota slots** (`requireAiGeneration`, §5), whereas the live assistant is a **subscription entitlement** (`writingAssistant`, granted to every plan, never metered per-keystroke — `src/types/subscription.ts:14-20,49`).

---

## 2. Modes

All three modes share one voice context (the assembled system prompt, §4), a shared priority ladder (explicit instruction > inspiration > selected patterns > tuned voice), and the rate-limit + daily-quota guards. They differ in how much work they do.

> **Retired (2026-07): the agentic pipeline.** The multi-step research→draft→voice-check→iterate→read "Agent" mode is **gone** — `src/lib/ai/agentic/post-pipeline.ts`, `POST /api/drafts/generate-agentic` (SSE), the `POST /api/qstash/llm-job` worker, `src/lib/qstash/enqueue-llm.ts`, `GET /api/drafts/generation-jobs/[id]`, `AgenticChain.tsx`, the `AGENTIC_ASYNC` env var, and the Quick/Agent mode toggle on `/create`. Single-shot generation is the only generation path. The `generation_jobs` migration is kept (append-only, inert). Do not re-add it.

### Single-shot (`generate-from-topic`) — 1 slot

`src/app/api/drafts/generate-from-topic/route.ts`

- `POST /api/drafts/generate-from-topic`, `maxDuration = 60` (line 4).
- Guard order: `guardLlmRoute` (burst/IP/global) → `requireAiGeneration(user.id, "generate-from-topic")` = **1 slot** (lines 41-46).
- Inputs: `topic` (≥3 chars, line 78), `draftType`, `patternIds`, `generateCount` (default 1, clamped 1-10, line 76), optional `inspirationPost`, one-off `instructions`, `previousVariations` (lines 49-72).
- Patterns: only **explicitly selected** patterns are applied, filtered through `isGenerationApplicablePattern`; no default top-patterns are force-injected (lines 92-103, 119).
- Single user-prompt assembles the priority ladder + instruction/inspiration/pattern/format/prior-variation blocks (lines 124-180), asks for a JSON array.
- Model: `createChatCompletion({ provider: resolveProvider(ai_model), modelTier: "fast", … })` (lines 113, 188-210). Temperature `0.7` for a single first-gen (tighter voice), `0.85` for batches/steering (line 205). `maxTokens: 2000`.
- Output: JSON array parsed from the response text (regex `\[…\]`, lines 216-218); each option shaped `{ type, content, topic, applied_patterns, metadata }` and returned **in memory** — nothing saved (lines 228-242).

### Refine — lightweight single-pass revise

`src/app/api/drafts/refine/route.ts`

- `POST /api/drafts/refine`, `maxDuration = 60` (line 17). Costs **1 slot** (`requireAiGeneration(user.id, "drafts-refine")`, line 41).
- Takes an existing generated draft (`text`/`tweets`) plus `feedback`, and revises it in **a single Claude call** — no research, no chain.
- The feedback is treated as an explicit instruction that takes priority over default voice tendencies. Uses the scoped voice prompt (`includePatterns: false`), **`DRAFT_MODEL`**, `max_tokens: 1200`, through the gateway.
- Output cleaned via `cleanDraft` / `splitThread`, returned as `{ option }` with `metadata.generation_type = "refined"`.
- `cleanDraft`, `splitThread`, `DraftType`, and `DRAFT_MODEL` (formerly `PIPELINE_MODEL`) now live in **`src/lib/ai/draft-text.ts`** — the shared helpers that outlived the retired pipeline.

### Reply generation

`src/app/api/generate-reply/route.ts`

- `POST /api/generate-reply`. Dual-auth (Bearer token from the extension or cookie from the dashboard, `getDualAuthUser`, line 129). Costs **1 slot** (`requireAiGeneration(user.id, "generate-reply")`, line 144).
- Builds rich context from the post being replied to: parent, quoted tweet, link preview, media alt-text (`buildContextPrompt`, lines 79-124) plus an optional one-off `tone` ANGLE subordinate to the tuned voice (`getToneInstruction`, lines 59-74).
- Voice prompt from `getAssembledPromptForUser` (reply mode, default), falling back to `REPLY_SYSTEM_PROMPT` on failure (lines 168-175). `modelTier: "fast"`, `temperature: 0.7`, `maxTokens: 400`, `jsonResponse: true` (lines 198-210).
- Returns up to 3 replies labeled `["Punchy","Insight","Spicy"]`, cleaned of leaked meta-text and truncated to 280 chars (lines 250-281).

---

## 3. Seeding the editor (the on-ramp handoff)

This is where generation hands off to the assistant. It is deliberately a **client-side, DB-free** handoff.

- **Generate** (`runQuick`, `src/components/create/CreatePage.tsx:261`): POSTs to `/api/drafts/generate-from-topic`, takes `data.options[0]`, folds it into the variation history via `applyOption`. There is no mode picker — this is the only generation path.
- **Refine** (`handleRefine`, `CreatePage.tsx:321`): POSTs to `/api/drafts/refine`, appends the returned option as a new variation. **Regenerate** replays the exact last query as a new variation.
- **The on-ramp itself** (`handleUseDraft`, `CreatePage.tsx:364`): writes the chosen option to sessionStorage under `draft:new:seed` and routes to `/drafts/new`. **No DB write.** `src/app/drafts/new/page.tsx` reads the seed once on mount (`readPersistedValue(SEED_KEY)`) and renders `<DraftEditor draftId={null} initialContent={seed.content} …>`; the seed is cleared only after Save/publish succeeds (`onPersisted`). The manual compose tab uses the identical handoff.

---

## 4. Prompt assembly & model routing

### Prompt assembly — `getAssembledPromptForUser`

`src/lib/openai/prompts/prompt-assembler.ts:614-702`. One canonical tuned context, assembled in precedence order (lines 574-585): base scaffold → **precedence note** → voice controls → guardrails → niche/strategy → proven patterns → special notes → **voice examples** → inspiration → generation feedback. Token-budgeted per section.

- `voiceType` selects `post` vs `reply` base prompt and the matching examples/inspiration/feedback rows.
- `options.includePatterns` (default `true`): **generation and Refine both pass `false`** so the tuned voice stays the baseline and default patterns aren't force-injected — only patterns the user explicitly selected for that post are applied via the per-request user prompt (lines 119-122 of generate-from-topic; 69 of refine; assembler note at 619-624).
- Precedence within the prompt (`buildPrecedenceNote`, lines 161-170): the user's real examples are the strongest voice signal and are never overridden; patterns apply only where they fit the authentic voice.
- Pattern injection intensity follows the `optimization_authenticity` dial — a user who chose authenticity over engagement gets **no** pattern injection (lines 476-495).

### Model routing — `src/lib/ai/index.ts`

- Providers: `openai | claude | grok` (line 15). `ModelTier = "fast" | "standard" | "cheap"` (line 18) — **"cheap"** is the high-volume tier (structured extraction, voice chat), resolving to Haiku 4.5 on Claude (`CLAUDE_MODELS`, `src/lib/ai/providers/claude.ts:14-23`).
- **`CLAUDE_ONLY`** (`process.env.AI_CLAUDE_ONLY !== "false"`, line 26): while on, `resolveProvider(stored)` returns `"claude"` regardless of the stored `ai_model` picker — the multi-provider switching code stays intact but is bypassed (lines 33-36). Set `AI_CLAUDE_ONLY=false` to re-enable the picker.
- `CLAUDE_MODELS`: `fast` and `standard` → `claude-sonnet-4-6`; `cheap` → `claude-haiku-4-5` (`providers/claude.ts:14-23`). Claude client: `timeout: 45_000`, `maxRetries: 2` (line 7).
- Refine calls Claude **directly** at `DRAFT_MODEL` (`claude-sonnet-4-6`, `src/lib/ai/draft-text.ts:11`), not through `createChatCompletion`/the tier map — an explicit, independent model choice.

---

## 5. Metering & quota (`requireAiGeneration`, slots — vs the unmetered assistant)

`src/lib/stripe/gate.ts:42-66`. Generation is metered by **daily generation slots**, distinct from the assistant's `requireFeature` entitlement gate (lines 10-34).

- `requireAiGeneration(userId, endpoint, weight = 1)`: reads `checkAiGenerationLimit`, blocks with **HTTP 429** + `code: "AI_LIMIT"` unless `remaining >= weight`, then logs `weight` usage rows (lines 47-63).
- **Slot costs:** generation = 1, Refine = 1, Reply = 1. (`weight` still exists in the gate signature; nothing currently passes > 1 since the weight-3 agentic route was retired.)
- **Daily limits** (`src/types/subscription.ts`, `aiGenerationsPerDay`): Free = **5/day**; Pro / Agent = **Infinity**.
- `checkAiGenerationLimit` (`src/lib/stripe/subscription.ts:56-86`): `Infinity` plans short-circuit to unlimited; otherwise counts today's `ai_usage_log` rows for the user. `logAiGeneration` writes `weight` rows in one insert so a heavier action consumes multiple slots (lines 93-107). Effective plan falls back to Free when the subscription isn't active (`isSubscriptionActive`).
- **Contrast — the live assistant is *not* metered this way.** `writingAssistant` is a subscription entitlement (`requireFeature`), never a per-tick quota; the live loop can't tick a credit on every pause, and it's currently table-stakes (granted on every plan, `src/types/subscription.ts:14-20,49,77,106,131`).
- Client surfaces remaining quota via `useSubscription().aiLimitReached` / `<AiUsageCounter>`, disables the Generate button when reached, and `refetchSubscription()` after each run (`CreatePage.tsx:145,482,919-940`).

---

## 6. Key files

| Concern | Path |
| --- | --- |
| Generation route (1 slot) | `src/app/api/drafts/generate-from-topic/route.ts` |
| API/MCP generation route | `src/app/api/v1/drafts/generate/route.ts` |
| Refine (single-pass revise) | `src/app/api/drafts/refine/route.ts` |
| Shared draft helpers (`cleanDraft`, `splitThread`, `DRAFT_MODEL`) | `src/lib/ai/draft-text.ts` |
| Reply generation | `src/app/api/generate-reply/route.ts` |
| Generation feedback (like/dislike) | `src/app/api/generation-feedback/route.ts` |
| Prompt assembly | `src/lib/openai/prompts/prompt-assembler.ts` |
| AI provider routing / tiers / CLAUDE_ONLY | `src/lib/ai/index.ts` |
| Claude models (incl. "cheap"→Haiku) | `src/lib/ai/providers/claude.ts` |
| Quota gate (`requireAiGeneration`) | `src/lib/stripe/gate.ts` |
| Daily-limit logic | `src/lib/stripe/subscription.ts` |
| Plans / daily limits | `src/types/subscription.ts` |
| Create page (runQuick/handleRefine/handleUseDraft) | `src/components/create/CreatePage.tsx` |
| Editor seed handoff | `src/app/drafts/new/page.tsx` |

---

## 7. Current state & gaps

- **On-ramp framing is enforced in routing but not exclusive.** Generation still has a first-class tab ("AI Generate") with variation history, regenerate, and refine — a sizeable surface for an "optional" path (the mode picker is gone; single-shot is the only path). The editor is the default only for bare/no-intent `/create` (`CreatePage.tsx:86-104`).
- **Generation feedback is collected but only loosely closed-loop.** `generation-feedback` stores like/dislike (`route.ts`), and the assembler injects recent feedback into the prompt (`buildFeedbackSection`, assembler 343-396) — but only the most recent 10 rows, budget-capped (~400 tokens), with no scoring/decay.
- **Refine's model is hardcoded** (`DRAFT_MODEL = "claude-sonnet-4-6"`) and bypasses the tier map — intentional, but it ignores the `cheap`/Haiku tier entirely.
- **JSON parsing in generation is regex-based** (`responseText.match(/\[…\]/)`, generate-from-topic 216-218) rather than structured output; malformed output yields a 500 with no retry/repair.
- **The `generation_jobs` table survives with no writer.** The migration was intentionally kept (migrations are append-only) after the async generation worker was retired; nothing reads or writes it.

---

## 8. Related docs

- Voice engine & assembly internals: `docs/features/voice-engine.md`, `docs/voice-system.md`
- The live writing assistant (the post-pivot hero): `docs/features/writing-assistant.md`
- Plans, daily limits, and credits: `docs/features/billing-plans-and-credits.md`, `docs/api/credits.md`
