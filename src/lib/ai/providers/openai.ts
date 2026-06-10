import OpenAI from "openai";

let _openai: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 45_000, maxRetries: 2 });
  }
  return _openai;
}

// Model mapping for OpenAI
export const OPENAI_MODELS = {
  // Fast model for replies
  fast: "gpt-4o-mini",
  // Standard model for content generation
  standard: "gpt-4-turbo-preview",
} as const;
