import OpenAI from "openai";

/**
 * Cerebras (cerebras.ai) — wafer-scale inference, the fastest option (gpt-oss-120b
 * at ~3000 tok/s), OpenAI-compatible. Used for the writing-assistant live read
 * where output throughput is the bottleneck. Free tier: 30 RPM / 1M tokens/day.
 */
let _cerebras: OpenAI | null = null;

export function getCerebras(): OpenAI {
  if (!_cerebras) {
    _cerebras = new OpenAI({
      apiKey: process.env.CEREBRAS_API_KEY,
      baseURL: "https://api.cerebras.ai/v1",
      timeout: 45_000,
      maxRetries: 2,
    });
  }
  return _cerebras;
}

// Cerebras model ids omit the "openai/" prefix Groq uses.
export const CEREBRAS_MODELS = {
  fast: "gpt-oss-120b",
  standard: "gpt-oss-120b",
  cheap: "gpt-oss-120b",
} as const;
