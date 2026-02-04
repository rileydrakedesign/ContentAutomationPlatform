import OpenAI from "openai";

// Grok uses OpenAI-compatible API
let _grok: OpenAI | null = null;

export function getGrok(): OpenAI {
  if (!_grok) {
    _grok = new OpenAI({ apiKey: process.env.GROK_API_KEY, baseURL: "https://api.x.ai/v1" });
  }
  return _grok;
}

// Model mapping for Grok - using most powerful models
export const GROK_MODELS = {
  // Fast model - using Grok 3 for better quality
  fast: "grok-3",
  // Standard model - using Grok 3 (most capable)
  standard: "grok-3",
} as const;
