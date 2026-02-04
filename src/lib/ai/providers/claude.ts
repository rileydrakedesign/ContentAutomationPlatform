import Anthropic from "@anthropic-ai/sdk";

let _claude: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (!_claude) {
    _claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY });
  }
  return _claude;
}

// Model mapping for Claude - using most powerful models
export const CLAUDE_MODELS = {
  // Fast model - using Sonnet for better quality
  fast: "claude-sonnet-4-20250514",
  // Standard model - using latest Sonnet (most capable)
  standard: "claude-sonnet-4-20250514",
} as const;
