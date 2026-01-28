/**
 * Token estimation utilities for prompt budgeting
 *
 * Uses character-based estimation (~4 chars per token for English).
 * For production, consider using tiktoken for exact counts.
 */

/**
 * Estimate token count from text
 * GPT-4/Claude average ~4 chars per token for English
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Estimate tokens with a safety margin
 */
export function estimateTokensWithMargin(text: string, margin: number = 1.1): number {
  return Math.ceil(estimateTokens(text) * margin);
}

/**
 * Format token count for display
 */
export function formatTokenCount(tokens: number): string {
  if (tokens < 1000) return tokens.toString();
  return `${(tokens / 1000).toFixed(1)}k`;
}

/**
 * Check if adding text would exceed budget
 */
export function wouldExceedBudget(
  currentTokens: number,
  textToAdd: string,
  budget: number
): boolean {
  return currentTokens + estimateTokens(textToAdd) > budget;
}
