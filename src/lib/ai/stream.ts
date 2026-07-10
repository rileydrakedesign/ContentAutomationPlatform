/**
 * Streaming completions for the live-read SSE path so findings render the moment
 * they're generated (industry pattern: Cursor/Grammarly stream incrementally).
 * Yields text deltas instead of a single string, and goes through the gateway's
 * admission check (gatewayAdmit) + post-hoc metering (recordUsage).
 *
 * `streamText` dispatches by provider: Claude (prompt-cached system blocks) vs the
 * OpenAI-compatible hosts (OpenAI, Groq, Cerebras). Grok/unknown providers aren't
 * streamed here — the caller falls back to the one-shot path.
 */

import OpenAI from "openai";
import { getClaude, CLAUDE_MODELS } from "./providers/claude";
import { getOpenAI, OPENAI_MODELS } from "./providers/openai";
import { getGroq, GROQ_MODELS } from "./providers/groq";
import { getCerebras, CEREBRAS_MODELS } from "./providers/cerebras";
import { gatewayAdmit } from "./gateway";
import { recordUsage } from "./usage";
import type { AIProvider, ModelTier } from "./index";

export interface StreamTextOptions {
  provider: AIProvider;
  modelTier: ModelTier;
  /** Static prefix — cached as a system block on Claude, folded into the system
   *  message on OpenAI-compatible hosts (no caching there). */
  cachePrefix?: string;
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
  /** For reasoning models on OpenAI-compatible hosts (gpt-oss on Groq/Cerebras):
   *  cap the hidden chain-of-thought. Without this, gpt-oss can spend the ENTIRE
   *  max_tokens budget reasoning and emit zero content (finish_reason "length",
   *  content null). Ignored by the Claude path. */
  reasoningEffort?: "low" | "medium" | "high";
  route?: string;
  userId?: string;
}

/** Providers `streamText` can stream. Others → caller uses the one-shot path. */
export const STREAMABLE_PROVIDERS: ReadonlySet<AIProvider> = new Set<AIProvider>([
  "claude",
  "openai",
  "groq",
  "cerebras",
]);

/** Dispatch a streamed completion by provider. */
export async function* streamText(opts: StreamTextOptions): AsyncGenerator<string> {
  if (opts.provider === "claude") {
    yield* streamClaudeText(opts);
    return;
  }
  if (opts.provider === "openai" || opts.provider === "groq" || opts.provider === "cerebras") {
    yield* streamOpenAICompatibleText(opts);
    return;
  }
  throw new Error(`streamText: unsupported provider ${opts.provider}`);
}

function oaiCompatTarget(provider: AIProvider, tier: ModelTier): { client: OpenAI; model: string } {
  switch (provider) {
    case "openai":
      return { client: getOpenAI(), model: OPENAI_MODELS[tier] };
    case "groq":
      return { client: getGroq(), model: GROQ_MODELS[tier] };
    case "cerebras":
      return { client: getCerebras(), model: CEREBRAS_MODELS[tier] };
    default:
      throw new Error(`oaiCompatTarget: not OpenAI-compatible: ${provider}`);
  }
}

/** Stream from an OpenAI-compatible host (OpenAI / Groq / Cerebras). No prompt
 *  caching there — the prefix is folded into a system message. */
export async function* streamOpenAICompatibleText(opts: StreamTextOptions): AsyncGenerator<string> {
  const { client, model } = oaiCompatTarget(opts.provider, opts.modelTier);
  const maxTokens = opts.maxTokens ?? 800;
  const systemText = [opts.cachePrefix, opts.system].filter(Boolean).join("\n\n");
  const messages = systemText
    ? [{ role: "system" as const, content: systemText }, ...opts.messages]
    : opts.messages;
  const estIn = Math.ceil((systemText.length + opts.messages.reduce((n, m) => n + m.content.length, 0)) / 4);
  // Best-effort admission — a gateway/Redis outage must not break the live read.
  try {
    await gatewayAdmit(opts.provider, estIn + maxTokens); // no-op for non-Claude
  } catch (e) {
    console.error("streamOpenAICompatibleText admit (continuing):", e);
  }

  const stream = await client.chat.completions.create({
    model,
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: maxTokens,
    ...(opts.reasoningEffort && { reasoning_effort: opts.reasoningEffort }),
    stream: true,
    stream_options: { include_usage: true },
  });

  let usage: { prompt_tokens?: number; completion_tokens?: number } | undefined;
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
    if (chunk.usage) usage = chunk.usage;
  }

  try {
    await recordUsage({
      provider: opts.provider,
      model,
      route: opts.route,
      userId: opts.userId,
      input: usage?.prompt_tokens ?? 0,
      output: usage?.completion_tokens ?? 0,
    });
  } catch {
    // metering is best-effort
  }
}

export interface StreamClaudeOptions {
  modelTier: ModelTier;
  /** Static, cacheable system prefix (Anthropic prompt caching). */
  cachePrefix?: string;
  /** Additional (dynamic) system text, appended uncached after the prefix. */
  system?: string;
  messages: { role: "user" | "assistant"; content: string }[];
  temperature?: number;
  maxTokens?: number;
  route?: string;
  userId?: string;
}

/** Yield text deltas from a streamed Claude completion; meters usage at the end. */
export async function* streamClaudeText(opts: StreamClaudeOptions): AsyncGenerator<string> {
  const model = CLAUDE_MODELS[opts.modelTier];
  const maxTokens = opts.maxTokens ?? 800;
  const estIn = Math.ceil(
    ((opts.cachePrefix?.length ?? 0) + opts.messages.reduce((n, m) => n + m.content.length, 0)) / 4
  );
  // Admission is best-effort protection for the live read — never let a gateway /
  // Redis outage break the user-facing stream (fail open).
  try {
    await gatewayAdmit("claude", estIn + maxTokens);
  } catch (e) {
    console.error("streamClaudeText admit (continuing):", e);
  }

  const system = opts.cachePrefix
    ? [
        { type: "text" as const, text: opts.cachePrefix, cache_control: { type: "ephemeral" as const } },
        ...(opts.system ? [{ type: "text" as const, text: opts.system }] : []),
      ]
    : opts.system ?? "";

  const stream = getClaude().messages.stream({
    model,
    max_tokens: maxTokens,
    temperature: opts.temperature ?? 0.2,
    system,
    messages: opts.messages,
  });

  for await (const event of stream) {
    if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
      yield event.delta.text;
    }
  }

  try {
    const final = await stream.finalMessage();
    await recordUsage({
      provider: "claude",
      model,
      route: opts.route,
      userId: opts.userId,
      input: final.usage.input_tokens,
      output: final.usage.output_tokens,
    });
  } catch {
    // metering is best-effort — never fail the stream on it
  }
}
