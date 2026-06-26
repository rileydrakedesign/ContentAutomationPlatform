/**
 * Unified AI Interface
 *
 * This module provides a unified interface for calling AI models,
 * abstracting the differences between OpenAI, Claude, and Grok APIs.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAI, OPENAI_MODELS } from "./providers/openai";
import { getClaude, CLAUDE_MODELS } from "./providers/claude";
import { getGrok, GROK_MODELS } from "./providers/grok";
import { runThroughGateway, estimateChatTokens } from "./gateway";
import type { TokenUsage } from "./usage";

export type AIProvider = "openai" | "claude" | "grok";
// "cheap" is the high-volume, cost-sensitive tier (structured extraction, voice
// chat) — on Claude it resolves to Haiku 4.5, the gpt-5.4-nano analog.
export type ModelTier = "fast" | "standard" | "cheap";

/**
 * Force all post/reply generation onto Claude while keeping the multi-provider
 * switching code (openai/claude/grok) intact and selectable in the DB. The
 * model picker still writes `ai_model`; this just overrides the resolved
 * provider at read time. Set AI_CLAUDE_ONLY=false to re-enable the picker.
 */
export const CLAUDE_ONLY = process.env.AI_CLAUDE_ONLY !== "false";

/**
 * Map a stored `ai_model` preference to the provider we actually call. While
 * CLAUDE_ONLY is on, every path resolves to "claude" regardless of the stored
 * value — the switching machinery below stays in place but is bypassed.
 */
export function resolveProvider(stored?: string | null): AIProvider {
  if (CLAUDE_ONLY) return "claude";
  return (stored as AIProvider) || "openai";
}

/**
 * Resolve the user's selected AI provider from their voice settings.
 * Centralizes the ai_model -> provider mapping so every generation path
 * honors the model picker in settings (subject to the CLAUDE_ONLY override).
 */
export async function getUserProvider(
  supabase: SupabaseClient,
  userId: string
): Promise<AIProvider> {
  const { data } = await supabase
    .from("user_voice_settings")
    .select("ai_model")
    .eq("user_id", userId)
    .maybeSingle();
  return resolveProvider(data?.ai_model as string | null);
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
    route,
    userId,
  } = options;

  const meta = { route, userId };

  if (provider === "openai") {
    return createOpenAICompletion({ modelTier, messages, temperature, maxTokens, jsonResponse, meta });
  } else if (provider === "grok") {
    return createGrokCompletion({ modelTier, messages, temperature, maxTokens, jsonResponse, meta });
  } else {
    return createClaudeCompletion({ modelTier, messages, temperature, maxTokens, jsonResponse, meta });
  }
}

interface ProviderCompletionOptions {
  modelTier: ModelTier;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  jsonResponse: boolean;
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
  const { modelTier, messages, temperature, maxTokens, jsonResponse, meta } = options;
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

  const { value, usage } = await runThroughGateway({
    provider: "claude",
    model,
    estimatedTokens: estimateChatTokens(messages, maxTokens),
    meta,
    exec: async () => {
      const response = await getClaude().messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
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
