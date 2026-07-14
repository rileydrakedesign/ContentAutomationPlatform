/**
 * Draft text helpers shared by the single-shot generation and refine paths.
 *
 * These were extracted from the agentic post-pipeline when it was retired
 * (PRODUCT_SLIM_2026-07 §4 Tier 2) — /api/drafts/refine still needs them.
 */

// Sonnet 4.6 balances quality and latency for draft work and supports the
// basic server-side web_search tool. Kept separate from CLAUDE_MODELS so the
// draft path's model stays an explicit, independent choice.
export const DRAFT_MODEL = "claude-sonnet-4-6";

export type DraftType = "X_POST" | "X_THREAD";

/** Strip preamble/quotes/code fences the model occasionally wraps output in. */
export function cleanDraft(text: string): string {
  let t = text.trim();
  t = t.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
  if (t.length > 1 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

/** Split a thread draft on the explicit `---` delimiter, with sane fallbacks. */
export function splitThread(text: string): string[] {
  const byDelim = text
    .split(/\n\s*-{3,}\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byDelim.length > 1) return byDelim;
  const byBlank = text
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);
  return byBlank.length > 1 ? byBlank : [text.trim()];
}
