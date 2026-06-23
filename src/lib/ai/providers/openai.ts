import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 2 });
  }
  return _openai;
}

// Model mapping for OpenAI. gpt-4o/gpt-4o-mini are legacy (off the current
// pricing page); migrated to the gpt-5.4 family. These default to
// reasoning.effort "none", so they behave like fast non-reasoning models, and
// they require max_completion_tokens (handled in the unified interface).
export const OPENAI_MODELS = {
  // Fast model for replies / lightweight analysis
  fast: "gpt-5.4-nano",
  // Standard model for content generation
  standard: "gpt-5.4-mini",
} as const;
