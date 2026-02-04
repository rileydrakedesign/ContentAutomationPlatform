import Anthropic from "@anthropic-ai/sdk";

export const claude = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

// Model mapping for Claude - using most powerful models
export const CLAUDE_MODELS = {
  // Fast model - using Sonnet for better quality
  fast: "claude-sonnet-4-20250514",
  // Standard model - using latest Sonnet (most capable)
  standard: "claude-sonnet-4-20250514",
} as const;
