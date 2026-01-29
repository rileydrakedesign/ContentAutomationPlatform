import OpenAI from "openai";

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Model mapping for OpenAI
export const OPENAI_MODELS = {
  // Fast model for replies
  fast: "gpt-4o-mini",
  // Standard model for content generation
  standard: "gpt-4-turbo-preview",
} as const;
