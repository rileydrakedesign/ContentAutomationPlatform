import OpenAI from "openai";

// Grok uses OpenAI-compatible API
export const grok = new OpenAI({
  apiKey: process.env.GROK_API_KEY,
  baseURL: "https://api.x.ai/v1",
});

// Model mapping for Grok
export const GROK_MODELS = {
  // Fast model for replies
  fast: "grok-3-fast",
  // Standard model for content generation
  standard: "grok-3",
} as const;
