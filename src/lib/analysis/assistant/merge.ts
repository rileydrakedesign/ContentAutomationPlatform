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

import type { AssistantReport, Finding, NextStep, SuggestionChip } from "./types";
import { composeScores, scorePenalties } from "./score";
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
  /** Anchored X-native correctness findings (claim hygiene, hook/body mismatch,
   *  contradiction) — NOT spelling/grammar. Optional for back-compat with cached
   *  reads written before this field existed. */
  correctness_findings?: Finding[];
  /** Anchored algorithm findings (weak hook, no reply-driver, vague where
   *  specific wins, dwell-killing format) — class "reach", source "live".
   *  Optional for back-compat with cached reads written before this field. */
  reach_findings?: Finding[];
  /** Missing high-lift patterns → suggestion chips. */
  missing_pattern_chips: SuggestionChip[];
  /** The single highest-leverage next improvement (forward-looking). */
  next_edit?: NextStep | null;
  /** The post's core idea in one line, as the read understood it (C of the
   *  churn fix). Pinned client-side per session and sent back with later reads
   *  so every suggestion serves the same north star. */
  core_idea?: string;
  /** One-line "why it scored that way + biggest lever". */
  summary?: string;
  /** Optional LLM voice score — used ONLY to calibrate L2, never displayed. */
  voice_score?: number;
}

/**
 * Combine a fresh Tier-0 report (computed against `text`) with the optional L2
 * scores and L3 findings. Pass both null for the free, deterministic-only report.
 */
/** True when two [start,end) spans share at least one character. */
function spansOverlap(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start < b.end && a.end > b.start;
}

export function mergeReport(
  text: string,
  tier0: AssistantReport,
  scores: AssistantScores | null,
  findings: AssistantFindings | null,
  /** Findings the user dismissed/suppressed. Filtered HERE (not after merging)
   *  so their score deductions are released the moment they're hidden. */
  isHidden?: (f: Finding) => boolean
): AssistantReport {
  // Re-anchor against the current text. Live findings that once anchored but no
  // longer do are invalidated (the user fixed them); never-anchored ones stay
  // panel-only cards (see resolveFindings).
  const liveFindings = findings
    ? [
        ...findings.voice_findings,
        ...(findings.correctness_findings ?? []),
        ...(findings.reach_findings ?? []),
      ]
    : [];
  const resolvedTier0 = resolveFindings(text, tier0.findings);
  let resolvedLive = resolveFindings(text, liveFindings);

  // Cross-layer arbitration (rule-ID pattern from the hybrid-GEC playbook): when
  // the deterministic layer already covers a span, it wins — it's free, instant,
  // recomputed every keystroke, and its fix is guaranteed-safe. Dropping the live
  // duplicate prevents two competing suggestions on the same characters.
  const tier0Spans = resolvedTier0.filter((f) => f.span).map((f) => f.span!);
  if (tier0Spans.length) {
    resolvedLive = resolvedLive.filter(
      (f) => !f.span || !tier0Spans.some((s) => spansOverlap(f.span!, s))
    );
  }

  let allFindings = [...resolvedTier0, ...resolvedLive];
  if (isHidden) allFindings = allFindings.filter((f) => !isHidden(f));
  const chips = findings ? [...tier0.chips, ...findings.missing_pattern_chips] : tier0.chips;

  // Findings-coupled scoring: every visible finding holds points out of the
  // score (score.ts), so accepting or dismissing one always moves the headline.
  const composed = composeScores({
    reach: tier0.scores.reach,
    voice: scores ? scores.voice_score : null,
    resemblance: scores ? scores.resemblance_score : null,
    penalties: scorePenalties(allFindings),
  });

  return {
    findings: allFindings,
    badges: tier0.badges,
    chips,
    scores: composed,
    charInfo: tier0.charInfo,
    nextStep: findings?.next_edit ?? null,
    coreIdea: findings?.core_idea || null,
  };
}
