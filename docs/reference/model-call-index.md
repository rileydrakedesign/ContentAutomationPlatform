# Model call index

Every AI model call in the app — which model it hits, with what settings, and what
governs it. Sourced from `src/lib/ai/` and the route/lib call sites below; verified
against the code on **2026-07-04**. This is reference — when you change a call site,
update the row here.

For the gateway internals (admission, breaker, retries, metering) see
[`src/lib/ai/gateway.ts`](../../src/lib/ai/gateway.ts); for the unified interface see
[`src/lib/ai/index.ts`](../../src/lib/ai/index.ts).

## TL;DR

- **Chat/generation is Claude-only in production.** `CLAUDE_ONLY` (default on; set
  `AI_CLAUDE_ONLY=false` to disable) forces every provider-resolved path to Claude
  regardless of the stored `ai_model`. The OpenAI/Grok switching code stays wired but
  dormant.
- **Embeddings are OpenAI** (`text-embedding-3-small`) and intentionally bypass the
  gateway — Anthropic has no embeddings API. It powers the writing-assistant L2 score;
  an OpenAI 429 there disables the score (UI falls back to the deterministic Reach score).
- **The writing-assistant Live Read (L3) is provider-pluggable via `LIVE_READ_PROVIDER`**
  (`openai | claude | grok | groq | cerebras`; unset → normal resolution → Claude). It's
  the one steady-state path deliberately *not* Claude-only — currently `cerebras`
  (`gpt-oss-120b`), for ~4× lower first-finding latency. It **streams** (SSE/NDJSON).
- **Two exceptions to CLAUDE_ONLY:** the Live Read (above), and `POST /api/v1/drafts/generate`
  which reads the raw stored `ai_model`. See [Caveats](#caveats).

## Tiers → models

Defined in [`src/lib/ai/providers/claude.ts`](../../src/lib/ai/providers/claude.ts)
(and the parallel `openai.ts` / `grok.ts` / `groq.ts` / `cerebras.ts` maps). `ModelTier` is `fast | standard | cheap`.

| Tier | Claude (effective) | OpenAI (dormant) | Grok (dormant) | Groq / Cerebras | Use |
| --- | --- | --- | --- | --- | --- |
| `fast` | `claude-sonnet-4-6` | `gpt-5.4-nano` | `grok-4.3` | `gpt-oss-120b` | Generation, voice/resemblance checks |
| `standard` | `claude-sonnet-4-6` | `gpt-5.4-mini` | `grok-4.3` | `gpt-oss-120b` | Insights Q&A, inspiration analysis |
| `cheap` | `claude-haiku-4-5` | `gpt-5.4-nano` | `grok-4.3` | `gpt-oss-120b` | High-volume structured extraction, voice editor, **Live Read** |
| — (hardcoded) | `claude-sonnet-4-6` (`PIPELINE_MODEL`) | — | — | — | Agentic post pipeline + refine |
| — (embeddings) | n/a | `text-embedding-3-small` | — | — | Writing-assistant voice/performance vectors |

`fast` and `standard` both resolve to Sonnet 4.6 today; `cheap` is the Haiku 4.5 tier
for cost-sensitive, high-volume JSON tasks. **Groq/Cerebras** (`groq.ts` id `openai/gpt-oss-120b`,
`cerebras.ts` id `gpt-oss-120b`) are OpenAI-compatible inference hosts used only by the
Live Read via `LIVE_READ_PROVIDER`; `createOpenAICompatibleCompletion` handles the one-shot
path (`max_tokens`, not gpt-5's `max_completion_tokens`).

## What the gateway gives every Claude call

All chat calls funnel through `createChatCompletion` → `runThroughGateway` (or
`gatewayAdmit` for streaming): a global RPM + token-per-minute admission gate, exponential
backoff with jitter on 429/529/5xx, a Redis-backed per-provider circuit breaker, and token
metering (`recordUsage`). **`admit()` only gates `provider === "claude"`** — non-Claude
providers pass straight through ungoverned, which is why keeping generation on Claude
matters. The `route` argument is the metering attribution label; rows below marked `—`
record usage without a route tag. **The streaming helpers (`stream.ts`) wrap `gatewayAdmit`
in try/catch (fail-open)** so a Redis/Upstash outage can't break the user-facing Live Read.

## Generation (post / reply / draft)

| Endpoint | Source | Tier → model | temp | max_tokens | Response | Metering route | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /api/generate-reply` | [`generate-reply/route.ts:198`](../../src/app/api/generate-reply/route.ts) | `fast` → Sonnet 4.6 | 0.7 | 400 | JSON `{replies:[]}` | `generate-reply` | 3 reply options (punchy/insight/spicy). `resolveProvider` → Claude. |
| `POST /api/drafts/generate-from-topic` | [`drafts/generate-from-topic/route.ts:188`](../../src/app/api/drafts/generate-from-topic/route.ts) | `fast` → Sonnet 4.6 | 0.7–0.85 | 2000 | JSON array | `generate-from-topic` | Draft(s) from topic + optional inspiration/patterns. Higher temp when multi-option/instructed. |
| `POST /api/v1/drafts/generate` | [`v1/drafts/generate/route.ts:165`](../../src/app/api/v1/drafts/generate/route.ts) | `fast` | 0.8 | 2000 | JSON array | — | ⚠️ Reads raw `ai_model \|\| "openai"` — **does not honor CLAUDE_ONLY**. See [Caveats](#caveats). |
| `POST /api/drafts/refine` | [`drafts/refine/route.ts:90`](../../src/app/api/drafts/refine/route.ts) | `PIPELINE_MODEL` → Sonnet 4.6 | default | 1200 | Plain text | `drafts/refine` | Direct `getClaude().messages.create` wrapped in `runThroughGateway`. Single-call revise; no research/pipeline. |
| `POST /api/drafts/generate-agentic` (SSE)<br>`POST /api/qstash/llm-job` (bg) | [`ai/agentic/post-pipeline.ts`](../../src/lib/ai/agentic/post-pipeline.ts) | `PIPELINE_MODEL` → Sonnet 4.6 | default | 1500 / 1200 | Streamed text | `…:research`, `…:draft` | Multi-call pipeline — see below. |

### Agentic post pipeline (`runPostPipeline`)

The richest path: **research → draft → voice-check → iterate**, all on Sonnet 4.6
(`PIPELINE_MODEL`). Multiple model calls per request:

1. **`research()`** — `messages.create` with the **`web_search_20250305` server tool**
   (`max_uses: 4`), looped up to 5 turns to handle `pause_turn`. Through `runThroughGateway`,
   route `drafts/generate-agentic:research`.
2. **`streamDraftText()`** — streaming (`messages.stream`); can't use `runThroughGateway`, so
   it calls `gatewayAdmit("claude", …)` up front and `recordUsage` from the final message.
   Route `drafts/generate-agentic:draft`. Runs once for the draft, again per refine iteration.
3. **Voice-check per iteration** — calls `runVoiceCheck` (see Analysis table), up to
   `MAX_ITERATIONS`, keeping the highest-scoring draft. Most drafts get 0–1 refine passes.

## Voice editor

| Endpoint | Source | Tier → model | temp | max_tokens | Response | Metering route | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `POST /api/voice/chat` | [`voice/chat/route.ts`](../../src/app/api/voice/chat/route.ts) ×6 (516, 557, 620, 744, 827, 904) | `cheap` → Haiku 4.5 | 0.7–0.8 | default | JSON object | `voice/chat` | Multi-turn voice-config conversation. Handlers: `handleVoiceDescription`, `handleChangesModification`, `handleAcceptChanges`, `handleGuardrailsComplete`, `handleSubmitSampleInput`, `handleSampleFeedback`. |
| `POST /api/voice/preview` | [`voice/preview/route.ts:127`](../../src/app/api/voice/preview/route.ts) | `cheap` → Haiku 4.5 | 0.8 | 200 | Plain text | `voice/preview` | Sample post/reply demoing current voice settings. |

## Analysis & writing assistant

| Endpoint / caller | Source | Tier → model | temp | max_tokens | Response | Metering route | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `voice-check` (`/api/voice/check`, `/api/v1/voice/check`, agency check, agentic pipeline, MCP) | [`analysis/voice-check.ts:77`](../../src/lib/analysis/voice-check.ts) | `fast` → Sonnet 4.6 | 0.2 | 1000 | JSON object | — | Strict 0–100 voice score. Note: the compose/editor button + publish gate were **removed** — the live assistant replaced them; this core still powers generation/MCP/agency. |
| `live-read` (`/api/live-read`, streamed) | [`analysis/live-read.ts`](../../src/lib/analysis/live-read.ts) (`runLiveReadStream` / `runLiveRead` / `warmLiveRead`) | `cheap` → **`LIVE_READ_PROVIDER`** (dflt Cerebras `gpt-oss-120b`; else Claude Haiku 4.5) | 0.2 | 800 | **NDJSON, streamed (SSE)** | `live-read` | Writing-assistant L3: voice drift + **correctness** + missing patterns + **next-step**. Cheap tier; provider via `LIVE_READ_PROVIDER`. `{warm:true}` primes the Claude prompt cache. Falls back to one-shot for non-streamable providers. |
| `prepublish-read` (`/api/prepublish-read`, pipeline) | [`analysis/prepublish-read.ts:267`](../../src/lib/analysis/prepublish-read.ts) | `fast` → Sonnet 4.6 | 0.1 | 800 | JSON object | — | Resemblance score vs top performers before publish. |
| `pattern-extract` (`/api/patterns/extract`, tuneup) | [`analysis/pattern-extract.ts:86`](../../src/lib/analysis/pattern-extract.ts) | `cheap` → Haiku 4.5 | 0.3 | 2000 | JSON **array** | `patterns/extract` | `jsonResponse` intentionally **off** (object-mode would fight the array contract). |
| `niche-analyze` (`/api/niche/analyze`, tuneup) | [`analysis/niche-analyze.ts:123`](../../src/lib/analysis/niche-analyze.ts) | `cheap` → Haiku 4.5 | 0.3 | 2000 | JSON object | `niche/analyze` | Clusters top 100 posts → pillars + positioning. |
| `analyze-inspiration` (`/api/inspiration`, `/api/inspiration/[id]`, `/api/v1/inspiration`, `/api/captured/[id]/promote`) | [`openai/analyze-inspiration.ts:59`](../../src/lib/openai/analyze-inspiration.ts) | `standard` → Sonnet 4.6 | 0.3 | default | JSON object | — | Extracts voice + format traits from an inspiration post. Callers pass `getUserProvider` → Claude; the `provider="openai"` default param is dead under CLAUDE_ONLY. |
| `POST /api/insights-chat` | [`insights-chat/route.ts:220`](../../src/app/api/insights-chat/route.ts) | `standard` → Sonnet 4.6 | 0.3 | 600 | JSON `{answer, sources_used}` | `insights-chat` | User-facing analytics Q&A (Pro). Hardcoded `provider: "claude"`; on Sonnet for answer quality. |

## Embeddings (OpenAI — off the gateway)

| Function | Source | Model | Dims | Consumers |
| --- | --- | --- | --- | --- |
| `embedText` | [`ai/embeddings.ts`](../../src/lib/ai/embeddings.ts) | `text-embedding-3-small` | 1536 | [`analysis/assistant/vectors.ts`](../../src/lib/analysis/assistant/vectors.ts) only |

`vectors.ts` builds the writing-assistant L2 voice/performance vectors (cosine-similarity
scoring). Consumed by `/api/assistant/vectors/refresh`, `/api/assistant/score`, the
`assistant-vectors` and `daily-ops` crons, `tuneup.ts`, and `live-read.ts`. These calls hit
OpenAI directly (no admission gate, no breaker, no token metering) by design — documented at
`embeddings.ts:10`. **Do not** route embeddings through the Claude gateway.

## Provider-switching machinery (dormant)

The multi-provider code is intact; most paths are bypassed while `CLAUDE_ONLY` is on, but
the Live Read opts out via its own override:

- `resolveProvider(stored)` / `getUserProvider(...)` return `"claude"` regardless of the
  stored `ai_model` ([`index.ts`](../../src/lib/ai/index.ts)).
- **`AIProvider` = `openai | claude | grok | groq | cerebras`.** `OPENAI_MODELS` / `GROK_MODELS`
  / `GROQ_MODELS` / `CEREBRAS_MODELS` and the dispatch branches stay wired; the picker re-enables
  with `AI_CLAUDE_ONLY=false`.
- **`LIVE_READ_PROVIDER`** (`live-read.ts` `liveReadProvider`) overrides resolution *only* for the
  Live Read, so it can run on Cerebras/Groq while everything else stays Claude. Groq/Cerebras keys:
  `GROQ_API_KEY` / `CEREBRAS_API_KEY`.
- The MCP server (`mcp/`) makes **no** direct model calls — it forwards an optional
  `ai_model` to the v1 REST API.

## Caveats

- **`POST /api/v1/drafts/generate` ignores CLAUDE_ONLY.** Unlike `generate-reply` and
  `generate-from-topic` (which use `resolveProvider`), it reads
  `voiceSettings?.ai_model || "openai"` directly ([`v1/drafts/generate/route.ts:106`](../../src/app/api/v1/drafts/generate/route.ts)).
  So an agent caller whose stored `ai_model` is `openai`/`grok` — or who has no voice
  settings — gets OpenAI/Grok, ungoverned by the admission gate. The fix is to route it
  through `resolveProvider` for parity. Flag before relying on "100% of generation is Claude."
- **Unattributed metering.** Rows with `—` in the metering column still record token usage,
  but without a `route` tag: `voice-check`, `prepublish-read`, `analyze-inspiration`, and
  `v1/drafts/generate`. (`live-read` now tags route `live-read`.) Add a `route` to attribute them.
- **Streaming bypasses `runThroughGateway`.** Both the agentic draft stream and the Live Read
  (`stream.ts`) gate via `gatewayAdmit` + manual `recordUsage` instead — and the Live Read
  wraps `gatewayAdmit` in try/catch (fail-open) so infra outages can't break it. Same
  governance, different entry point — keep in sync if the gateway changes.
- **Live Read leaves Anthropic when `LIVE_READ_PROVIDER` is non-Claude.** With Cerebras/Groq,
  user drafts are sent to a third-party inference host — confirm no-training/retention terms
  and add as subprocessors before enabling for real users.
