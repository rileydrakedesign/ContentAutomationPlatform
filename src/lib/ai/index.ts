/**
 * Unified AI Interface
 *
 * This module provides a unified interface for calling AI models,
 * abstracting the differences between OpenAI, Claude, and Grok APIs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import { getOpenAI, OPENAI_MODELS } from "./providers/openai";
import { getClaude, CLAUDE_MODELS } from "./providers/claude";
import { getGrok, GROK_MODELS } from "./providers/grok";
import { getGroq, GROQ_MODELS } from "./providers/groq";
import { getCerebras, CEREBRAS_MODELS } from "./providers/cerebras";
import { runThroughGateway, estimateChatTokens } from "./gateway";
import type { TokenUsage } from "./usage";

// "grok" = xAI; "groq" = Groq inference host; "cerebras" = Cerebras inference host.
export type AIProvider = "openai" | "claude" | "grok" | "groq" | "cerebras";
// "cheap" is the high-volume, cost-sensitive tier (structured extraction, voice
// chat) — on Claude it resolves to Haiku 4.5, the gpt-5.4-nano analog.
export type ModelTier = "fast" | "standard" | "cheap";

/**
 * All user-facing generation runs on Claude — the model picker is gone. The
 * multi-provider dispatch below stays for deliberate infra choices (callers
 * that pass an explicit provider, e.g. the live-read host override).
 */
export function resolveProvider(_stored?: string | null): AIProvider {
  return "claude";
}

/**
 * Resolve the provider for a user's generation calls. Always "claude" — the
 * stored `ai_model` preference is no longer consulted. Signature kept so
 * existing callers don't change.
 */
export async function getUserProvider(
  _supabase: SupabaseClient,
  _userId: string
): Promise<AIProvider> {
  return "claude";
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  provider: AIProvider;
  modelTier: ModelTier;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonResponse?: boolean;
  /**
   * A large, static instruction/grounding block that repeats across calls (e.g.
   * the live-read voice spec + example posts). On Claude this is sent as a cached
   * system block (Anthropic prompt caching), so repeated calls within the cache
   * TTL skip re-processing it — big latency + cost win for the always-on loop.
   * On other providers it's folded into the system message (no caching, same
   * result). Put ONLY text that's identical call-to-call here; keep the varying
   * part (the draft) in `messages`.
   */
  cachePrefix?: string;
  /** For reasoning models on OpenAI-compatible hosts (gpt-oss on Groq/Cerebras):
   *  cap the hidden chain-of-thought so it can't consume the whole max_tokens
   *  budget and return empty content. Ignored by the OpenAI/Claude/Grok paths. */
  reasoningEffort?: "low" | "medium" | "high";
  /** Optional attribution for token metering (see usage.ts). */
  route?: string;
  userId?: string;
}

export interface ChatCompletionResult {
  content: string;
  provider: AIProvider;
  model: string;
  /** Token usage as reported by the provider, when available. */
  usage?: TokenUsage;
}

/**
 * Unified chat completion that works with both OpenAI and Claude
 */
export async function createChatCompletion(
  options: ChatCompletionOptions
): Promise<ChatCompletionResult> {
  const {
    provider,
    modelTier,
    messages,
    temperature = 0.7,
    maxTokens = 4096,
    jsonResponse = false,
    cachePrefix,
    reasoningEffort,
    route,
    userId,
  } = options;

  const meta = { route, userId };

  if (provider === "openai") {
    // No prompt caching on this path — fold the static prefix into the system msg.
    return createOpenAICompletion({ modelTier, messages: foldCachePrefix(messages, cachePrefix), temperature, maxTokens, jsonResponse, meta });
  } else if (provider === "grok") {
    return createGrokCompletion({ modelTier, messages: foldCachePrefix(messages, cachePrefix), temperature, maxTokens, jsonResponse, meta });
  } else if (provider === "groq" || provider === "cerebras") {
    const client = provider === "groq" ? getGroq() : getCerebras();
    const model = (provider === "groq" ? GROQ_MODELS : CEREBRAS_MODELS)[modelTier];
    return createOpenAICompatibleCompletion(provider, client, model, {
      modelTier, messages: foldCachePrefix(messages, cachePrefix), temperature, maxTokens, jsonResponse, reasoningEffort, meta,
    });
  } else {
    return createClaudeCompletion({ modelTier, messages, temperature, maxTokens, jsonResponse, cachePrefix, meta });
  }
}

/**
 * Chat completion for OpenAI-compatible inference hosts (Groq, Cerebras) that run
 * open models with the standard `max_tokens` param (not gpt-5's max_completion_tokens).
 * Goes through the gateway for metering; admission only gates Claude, so these
 * pass through.
 */
async function createOpenAICompatibleCompletion(
  provider: AIProvider,
  client: OpenAI,
  model: string,
  options: ProviderCompletionOptions
): Promise<ChatCompletionResult> {
  const { messages, temperature, maxTokens, jsonResponse, reasoningEffort, meta } = options;
  const processed = [...messages];
  if (jsonResponse) {
    const sys = processed.findIndex((m) => m.role === "system");
    const note =
      "\n\nCRITICAL: respond with ONLY valid JSON — no prose, no markdown fences. Start with '{' and end with '}'.";
    if (sys !== -1) processed[sys] = { ...processed[sys], content: processed[sys].content + note };
  }

  const { value, usage } = await runThroughGateway({
    provider,
    model,
    estimatedTokens: estimateChatTokens(processed, maxTokens),
    meta,
    exec: async () => {
      const completion = await client.chat.completions.create({
        model,
        messages: processed,
        temperature,
        max_tokens: maxTokens,
        ...(reasoningEffort && { reasoning_effort: reasoningEffort }),
        ...(jsonResponse && { response_format: { type: "json_object" as const } }),
      });
      let content = completion.choices[0]?.message?.content?.trim() || "";
      if (jsonResponse && content && !content.startsWith("{")) {
        const m = content.match(/\{[\s\S]*\}/);
        if (m) content = m[0];
      }
      return {
        value: content,
        usage: {
          input: completion.usage?.prompt_tokens ?? 0,
          output: completion.usage?.completion_tokens ?? 0,
        },
      };
    },
  });

  return { content: value, provider, model, usage };
}

/** Prepend a static prefix onto the system message (or add one) — used for the
 *  providers that don't get a dedicated cached system block. */
function foldCachePrefix(messages: ChatMessage[], cachePrefix?: string): ChatMessage[] {
  if (!cachePrefix) return messages;
  const sysIndex = messages.findIndex((m) => m.role === "system");
  if (sysIndex === -1) return [{ role: "system", content: cachePrefix }, ...messages];
  return messages.map((m, i) =>
    i === sysIndex ? { ...m, content: `${cachePrefix}\n\n${m.content}` } : m
  );
}

interface ProviderCompletionOptions {
  modelTier: ModelTier;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  jsonResponse: boolean;
  cachePrefix?: string;
  reasoningEffort?: "low" | "medium" | "high";
  meta: { route?: string; userId?: string };
}

async function createOpenAICompletion(options: ProviderCompletionOptions): Promise<ChatCompletionResult> {
  const { modelTier, messages, temperature, maxTokens, jsonResponse, meta } = options;
  const model = OPENAI_MODELS[modelTier];

  const { value, usage } = await runThroughGateway({
    provider: "openai",
    model,
    estimatedTokens: estimateChatTokens(messages, maxTokens),
    meta,
    exec: async () => {
      const completion = await getOpenAI().chat.completions.create({
        model,
        messages,
        temperature,
        // gpt-5.4 family requires max_completion_tokens (max_tokens is rejected).
        max_completion_tokens: maxTokens,
        ...(jsonResponse && { response_format: { type: "json_object" } }),
      });
      const content = completion.choices[0]?.message?.content?.trim() || "";
      return {
        value: content,
        usage: {
          input: completion.usage?.prompt_tokens ?? 0,
          output: completion.usage?.completion_tokens ?? 0,
        },
      };
    },
  });

  return { content: value, provider: "openai", model, usage };
}

async function createGrokCompletion(options: ProviderCompletionOptions): Promise<ChatCompletionResult> {
  const { modelTier, messages, temperature, maxTokens, jsonResponse, meta } = options;
  const model = GROK_MODELS[modelTier];

  // For JSON responses, add explicit instruction to the system message
  const processedMessages = [...messages];
  if (jsonResponse) {
    const systemIndex = processedMessages.findIndex((m) => m.role === "system");
    if (systemIndex !== -1) {
      processedMessages[systemIndex] = {
        ...processedMessages[systemIndex],
        content: processedMessages[systemIndex].content +
          "\n\nCRITICAL: You must respond with ONLY valid JSON. No introduction, no explanation, no markdown code blocks. Start with '{' and end with '}'."
      };
    }
  }

  const { value, usage } = await runThroughGateway({
    provider: "grok",
    model,
    estimatedTokens: estimateChatTokens(processedMessages, maxTokens),
    meta,
    exec: async () => {
      const completion = await getGrok().chat.completions.create({
        model,
        messages: processedMessages,
        temperature,
        // grok-4.x is a reasoning model and requires max_completion_tokens.
        max_completion_tokens: maxTokens,
        // Grok supports response_format like OpenAI
        ...(jsonResponse && { response_format: { type: "json_object" as const } }),
      });

      let content = completion.choices[0]?.message?.content?.trim() || "";
      // Fallback JSON extraction if needed
      if (jsonResponse && content && !content.startsWith("{")) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) content = jsonMatch[0];
      }
      return {
        value: content,
        usage: {
          input: completion.usage?.prompt_tokens ?? 0,
          output: completion.usage?.completion_tokens ?? 0,
        },
      };
    },
  });

  return { content: value, provider: "grok", model, usage };
}

async function createClaudeCompletion(options: ProviderCompletionOptions): Promise<ChatCompletionResult> {
  const { modelTier, messages, temperature, maxTokens, jsonResponse, cachePrefix, meta } = options;
  const model = CLAUDE_MODELS[modelTier];

  // Claude uses a separate system parameter
  const systemMessage = messages.find((m) => m.role === "system");
  let nonSystemMessages = messages.filter((m) => m.role !== "system");

  // Build the system prompt, adding JSON instruction if needed
  let systemPrompt = systemMessage?.content || "";
  if (jsonResponse) {
    systemPrompt += "\n\nCRITICAL JSON REQUIREMENT: Your response must be ONLY a valid JSON object. Do not include ANY text before or after the JSON. Do not say 'Here is' or any introduction. Start your response with '{' and end with '}'. Nothing else.";

    // Also append reminder to the last user message
    const lastUserMsgIndex = nonSystemMessages.findLastIndex((m) => m.role === "user");
    if (lastUserMsgIndex !== -1) {
      nonSystemMessages = nonSystemMessages.map((m, i) =>
        i === lastUserMsgIndex
          ? { ...m, content: m.content + "\n\nRemember: Respond with ONLY valid JSON. No introduction or explanation text." }
          : m
      );
    }
  }

  // Prompt caching: send the static grounding prefix as its own cached system
  // block (everything up to it is reused across calls within the cache TTL); any
  // dynamic system text follows uncached. Falls back to a plain string when there
  // is no prefix.
  const systemParam = cachePrefix
    ? [
        { type: "text" as const, text: cachePrefix, cache_control: { type: "ephemeral" as const } },
        ...(systemPrompt ? [{ type: "text" as const, text: systemPrompt }] : []),
      ]
    : systemPrompt;

  const { value, usage } = await runThroughGateway({
    provider: "claude",
    model,
    estimatedTokens: estimateChatTokens(
      cachePrefix ? [...messages, { role: "system", content: cachePrefix }] : messages,
      maxTokens
    ),
    meta,
    exec: async () => {
      const response = await getClaude().messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemParam,
        messages: nonSystemMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      });

      // Extract text content from Claude's response
      const textBlock = response.content.find((block) => block.type === "text");
      let content = textBlock?.type === "text" ? textBlock.text.trim() : "";
      // If JSON response expected, try to extract JSON from the response
      if (jsonResponse && content && !content.startsWith("{")) {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) content = jsonMatch[0];
      }
      return {
        value: content,
        usage: {
          input: response.usage.input_tokens,
          output: response.usage.output_tokens,
        },
      };
    },
  });

  return { content: value, provider: "claude", model, usage };
}

// Re-export types and providers
export { OPENAI_MODELS } from "./providers/openai";
export { CLAUDE_MODELS } from "./providers/claude";
export { GROK_MODELS } from "./providers/grok";
export { GROQ_MODELS } from "./providers/groq";
export { CEREBRAS_MODELS } from "./providers/cerebras";
