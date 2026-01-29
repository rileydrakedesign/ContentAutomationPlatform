import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Model mapping for Claude equivalents
export const CLAUDE_MODELS = {
  // Fast model (equivalent to gpt-4o-mini)
  fast: "claude-3-haiku-20240307",
  // Standard model (equivalent to gpt-4-turbo-preview)
  standard: "claude-3-5-sonnet-20241022",
} as const;
