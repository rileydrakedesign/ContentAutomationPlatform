import OpenAI from "openai";

/**
 * Groq (groq.com) — ultra-fast LPU inference for open models, OpenAI-compatible.
 * NOTE: this is "groq" (the inference host), NOT "grok" (xAI's model in grok.ts) —
 * different companies, one letter apart. Used for the writing-assistant live read
 * where output throughput dominates (Groq runs gpt-oss-120b at ~500 tok/s).
 */
let _groq: OpenAI | null = null;

export function getGroq(): OpenAI {
  if (!_groq) {
    _groq = new OpenAI({
      apiKey: process.env.GROQ_API_KEY,
      baseURL: "https://api.groq.com/openai/v1",
      timeout: 45_000,
      maxRetries: 2,
    });
  }
  return _groq;
}

// gpt-oss-120b: OpenAI's open-weight flagship, strong at structured extraction.
export const GROQ_MODELS = {
  fast: "openai/gpt-oss-120b",
  standard: "openai/gpt-oss-120b",
  cheap: "openai/gpt-oss-120b",
} as const;
