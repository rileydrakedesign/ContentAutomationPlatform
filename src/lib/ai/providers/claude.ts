import Anthropic from "@anthropic-ai/sdk";

let _claude: Anthropic | null = null;

export function getClaude(): Anthropic {
  if (!_claude) {
    _claude = new Anthropic({ apiKey: process.env.CLAUDE_API_KEY, timeout: 45_000, maxRetries: 2 });
  }
  return _claude;
}

// Model mapping for Claude. claude-sonnet-4-20250514 (Sonnet 4) was retired
// 2026-06-15; claude-sonnet-4-6 is its drop-in replacement.
export const CLAUDE_MODELS = {
  // Fast model - using Sonnet for better quality
  fast: "claude-sonnet-4-6",
  // Standard model - latest Sonnet (most capable balance of speed/quality)
  standard: "claude-sonnet-4-6",
} as const;
