/**
 * Unified AI Interface
 *
 * This module provides a unified interface for calling AI models,
 * abstracting the differences between OpenAI, Claude, and Grok APIs.
 */

import { getOpenAI, OPENAI_MODELS } from "./providers/openai";
import { getClaude, CLAUDE_MODELS } from "./providers/claude";
import { getGrok, GROK_MODELS } from "./providers/grok";

export type AIProvider = "openai" | "claude" | "grok";
export type ModelTier = "fast" | "standard";

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
}

export interface ChatCompletionResult {
  content: string;
  provider: AIProvider;
  model: string;
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
  } = options;

  if (provider === "openai") {
    return createOpenAICompletion({
      modelTier,
      messages,
      temperature,
      maxTokens,
      jsonResponse,
    });
  } else if (provider === "grok") {
    return createGrokCompletion({
      modelTier,
      messages,
      temperature,
      maxTokens,
      jsonResponse,
    });
  } else {
    return createClaudeCompletion({
      modelTier,
      messages,
      temperature,
      maxTokens,
      jsonResponse,
    });
  }
}

async function createOpenAICompletion(options: {
  modelTier: ModelTier;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  jsonResponse: boolean;
}): Promise<ChatCompletionResult> {
  const { modelTier, messages, temperature, maxTokens, jsonResponse } = options;
  const model = OPENAI_MODELS[modelTier];

  const completion = await getOpenAI().chat.completions.create({
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
    ...(jsonResponse && { response_format: { type: "json_object" } }),
  });

  const content = completion.choices[0]?.message?.content?.trim() || "";

  return {
    content,
    provider: "openai",
    model,
  };
}

async function createGrokCompletion(options: {
  modelTier: ModelTier;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  jsonResponse: boolean;
}): Promise<ChatCompletionResult> {
  const { modelTier, messages, temperature, maxTokens, jsonResponse } = options;
  const model = GROK_MODELS[modelTier];

  // For JSON responses, add explicit instruction to the system message
  let processedMessages = [...messages];
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

  const completion = await getGrok().chat.completions.create({
    model,
    messages: processedMessages,
    temperature,
    max_tokens: maxTokens,
    // Grok supports response_format like OpenAI
    ...(jsonResponse && { response_format: { type: "json_object" as const } }),
  });

  let content = completion.choices[0]?.message?.content?.trim() || "";

  // Fallback JSON extraction if needed
  if (jsonResponse && content && !content.startsWith("{")) {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
  }

  return {
    content,
    provider: "grok",
    model,
  };
}

async function createClaudeCompletion(options: {
  modelTier: ModelTier;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  jsonResponse: boolean;
}): Promise<ChatCompletionResult> {
  const { modelTier, messages, temperature, maxTokens, jsonResponse } = options;
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
    // Try to find JSON object in the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      content = jsonMatch[0];
    }
  }

  return {
    content,
    provider: "claude",
    model,
  };
}

// Re-export types and providers
export { OPENAI_MODELS } from "./providers/openai";
export { CLAUDE_MODELS } from "./providers/claude";
export { GROK_MODELS } from "./providers/grok";
