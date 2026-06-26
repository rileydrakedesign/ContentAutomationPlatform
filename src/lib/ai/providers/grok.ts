import OpenAI from "openai";

// Grok uses OpenAI-compatible API
let _grok: OpenAI | null = null;

export function getGrok(): OpenAI {
  if (!_grok) {
    _grok = new OpenAI({ apiKey: process.env.GROK_API_KEY, baseURL: "https://api.x.ai/v1", timeout: 45_000, maxRetries: 2 });
  }
  return _grok;
}

// Model mapping for Grok. grok-3 was retired; grok-4.3 is the current flagship
// (reasoning model — note it requires max_completion_tokens, handled in the
// unified interface).
export const GROK_MODELS = {
  // Fast model
  fast: "grok-4.3",
  // Standard model (most capable)
  standard: "grok-4.3",
  // Cheap tier (parity with the other providers' tier maps).
  cheap: "grok-4.3",
} as const;
