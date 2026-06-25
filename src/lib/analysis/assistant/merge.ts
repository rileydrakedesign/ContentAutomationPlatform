/**
 * Merge the deterministic Tier-0 report with the two on-pause layers into the
 * final AssistantReport the surfaces render.
 *
 *   Tier-0 (L0, sync)     — reach/link/bait/avoid-word/clarity findings, badges,
 *                           reach sub-score.
 *   L2 scores (embeddings)— the Voice Match (0-100) + resemblance (→ Performance
 *                           grade), from /api/assistant/score. Cheap, unmetered.
 *   L3 findings (LLM)     — anchored voice-drift findings + missing-pattern chips
 *                           + rewrites, from /api/live-read. Rare, on-demand.
 *
 * Scores come from L2; findings from L3. Either may be null (e.g. before the first
 * score lands, or when L3 hasn't run). All spans are re-resolved against the
 * *current* text here, so a finding that lands a beat after the user kept typing
 * never draws an underline at a stale offset (it degrades to a panel card — UX §8).
 */

import type { AssistantReport, Finding, SuggestionChip } from "./types";
import { composeScores } from "./score";
import { resolveFindings } from "./spans";

/** L2 embedding scores — the cheap, unmetered voice/performance numbers. */
export interface AssistantScores {
  /** 0-100 voice match (cosine vs the user's voice centroid, calibrated). */
  voice_score: number;
  /** 0-100 resemblance to the user's top performers (→ Performance grade). */
  resemblance_score: number;
}

/** L3 LLM output — explanations and rewrites only (scores live in L2). */
export interface AssistantFindings {
  /** Anchored voice-drift findings (quote-based; offsets resolved here). */
  voice_findings: Finding[];
  /** Missing high-lift patterns → suggestion chips. */
  missing_pattern_chips: SuggestionChip[];
  /** One-line "why it scored that way + biggest lever". */
  summary?: string;
  /** Optional LLM voice score — used ONLY to calibrate L2, never displayed. */
  voice_score?: number;
}

/**
 * Combine a fresh Tier-0 report (computed against `text`) with the optional L2
 * scores and L3 findings. Pass both null for the free, deterministic-only report.
 */
export function mergeReport(
  text: string,
  tier0: AssistantReport,
  scores: AssistantScores | null,
  findings: AssistantFindings | null
): AssistantReport {
  // Re-anchor any live voice findings against the current text; unanchorable ones
  // keep their card but lose the underline.
  const liveFindings = findings ? resolveFindings(text, findings.voice_findings) : [];
  const allFindings = resolveFindings(text, [...tier0.findings, ...liveFindings]);
  const chips = findings ? [...tier0.chips, ...findings.missing_pattern_chips] : tier0.chips;

  const composed = composeScores({
    reach: tier0.scores.reach,
    voice: scores ? scores.voice_score : null,
    resemblance: scores ? scores.resemblance_score : null,
  });

  return {
    findings: allFindings,
    badges: tier0.badges,
    chips,
    scores: composed,
    charInfo: tier0.charInfo,
  };
}
