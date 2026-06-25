/**
 * Writing-assistant ("Grammarly for tweets") shared types.
 *
 * One engine, three skins (dashboard modal, X post box, X reply box). The engine
 * produces an AssistantReport; each surface renders it at a different density.
 * See GRAMMARLY_PIVOT_UX.md for the design these types encode.
 *
 * Three visual primitives, chosen by the rule in §2 of that doc:
 *   - Finding  → an UNDERLINE: a specific, present span to fix (warning palette
 *                by class). A Finding with no `span` degrades to a panel-only card.
 *   - Badge    → a discrete STATE (good / caution): reply-hook present, has media…
 *   - Chip     → something MISSING / a nudge ("+ open with a question") — never a
 *                span, so never an underline.
 * Holistic qualities (voice, performance, post score) are Scores, never underlines.
 *
 * This module is intentionally dependency-free and client-safe (no server/node
 * imports) so the identical engine runs in the dashboard, in a client component,
 * and ported into the Chrome-extension content script.
 */

import type { TweetLengthInfo } from "@/lib/x-api/tweet-text";

/** Underline category → color. Positives are Badges, not Findings, so every
 *  Finding class is a "fix this" warning color. */
export type FindingClass =
  | "correctness" // red — spelling / grammar / typos
  | "clarity" // blue — wordiness, filler, weak phrasing
  | "voice" // purple — drifts from how you sound / breaks a guardrail
  | "reach"; // amber — algorithm risk: external link, engagement-bait

/** Underline *style* encodes severity (dotted / solid / double). */
export type Severity = "suggestion" | "warning" | "problem";

/** Where a finding came from — deterministic Tier-0 vs the LLM Live Read. */
export type FindingSource = "tier0" | "live";

export interface FindingSpan {
  /** The verbatim substring this finding refers to. The LLM returns the quote,
   *  never offsets (models miscount); offsets are resolved locally. */
  quote: string;
  /** Start offset (inclusive) into the plain text. */
  start: number;
  /** End offset (exclusive). */
  end: number;
}

export interface Finding {
  id: string;
  class: FindingClass;
  severity: Severity;
  /** Short "what" — the card title. */
  title: string;
  /** Grounded "why" — cites the X mechanism or the user's pattern multiplier. */
  why: string;
  /** Present → draw an underline. Absent → panel-only card (couldn't anchor). */
  span?: FindingSpan;
  /** One-click Accept payload: replaces `span` (or the whole text if no span). */
  replacement?: string;
  source: FindingSource;
  /** Optional provenance (an AlgorithmSignal or pattern id) for debugging/telemetry. */
  signal?: string;
}

export type BadgeStatus = "good" | "caution" | "info";

export interface Badge {
  id: string;
  status: BadgeStatus;
  label: string;
  /** Hover detail — the grounded reason. */
  detail?: string;
}

export type ChipKind = "missing_pattern" | "nudge";

export interface SuggestionChip {
  id: string;
  kind: ChipKind;
  /** Imperative label, e.g. "+ Open with a question". */
  label: string;
  detail?: string;
  /** Optional text to insert when accepted (nudges only; patterns are guidance). */
  insert?: string;
  /** For missing-pattern chips: the engagement multiplier, for the "why". */
  multiplier?: number;
}

export type Grade = "A" | "B" | "C" | "D" | "F";

export interface Scores {
  /** Headline 0-100 blend the user pushes upward. Provisional until a Live Read
   *  fills in voice + performance (see score.ts). */
  post: number;
  /** Whether `post` includes the LLM-backed components yet. */
  postProvisional: boolean;
  /** 0-100 voice match — null until a Live Read runs. */
  voice: number | null;
  /** Resemblance-to-your-winners as a letter grade — null until a Live Read runs.
   *  A grade (not a number) on purpose: avoids false precision on a fuzzy signal. */
  performance: Grade | null;
  /** 0-100 deterministic algorithm-fit sub-score (always available, free). */
  reach: number;
}

export interface AssistantReport {
  findings: Finding[];
  badges: Badge[];
  chips: SuggestionChip[];
  scores: Scores;
  /** X-accurate character info (reused from tweet-text). */
  charInfo: TweetLengthInfo;
}

/** Color/priority metadata for a class — single source of truth for the UI and
 *  for overlap resolution (higher priority wins a contested character). */
export const FINDING_CLASS_META: Record<
  FindingClass,
  { label: string; priority: number; token: string }
> = {
  // priority: correctness > voice > reach > clarity (UX §7)
  correctness: { label: "Correctness", priority: 4, token: "danger" },
  voice: { label: "Voice", priority: 3, token: "voice" },
  reach: { label: "Reach", priority: 2, token: "warning" },
  clarity: { label: "Clarity", priority: 1, token: "primary" },
};
