/**
 * Score composition — the headline "Post Score" and the Performance grade.
 *
 * Post Score blends voice + performance + reach (GRAMMARLY_PIVOT_UX.md §6):
 *   0.45·voice + 0.35·performance + 0.20·reach
 * Before a Live Read fills in voice + performance, those weights renormalize over
 * the components we actually have (just reach), and the score is marked provisional
 * so the UI can show it as "live so far" rather than final.
 *
 * Performance is expressed as a letter grade (A–F), not a number, on purpose:
 * resemblance-to-your-winners is a fuzzy signal and a grade avoids false precision
 * (locked decision, 2026-06-24).
 */

import type { Grade, Scores } from "./types";

const WEIGHTS = { voice: 0.45, performance: 0.35, reach: 0.2 } as const;

/** Map a 0-100 resemblance score to a letter grade. */
export function resemblanceToGrade(resemblance: number): Grade {
  if (resemblance >= 85) return "A";
  if (resemblance >= 70) return "B";
  if (resemblance >= 55) return "C";
  if (resemblance >= 40) return "D";
  return "F";
}

/** Inverse: a grade's representative 0-100 value, for blending into Post Score. */
function gradeToValue(grade: Grade): number {
  switch (grade) {
    case "A":
      return 92;
    case "B":
      return 77;
    case "C":
      return 62;
    case "D":
      return 47;
    case "F":
      return 30;
  }
}

export interface ComposeScoresInput {
  /** Deterministic reach sub-score (always present). */
  reach: number;
  /** 0-100 voice match, or null if no Live Read yet. */
  voice: number | null;
  /** 0-100 resemblance, or null if no Live Read yet. */
  resemblance: number | null;
}

/**
 * Compose the full Scores object from the components available right now,
 * renormalizing the blend over present components.
 */
export function composeScores(input: ComposeScoresInput): Scores {
  const components: { weight: number; value: number }[] = [
    { weight: WEIGHTS.reach, value: input.reach },
  ];
  if (input.voice !== null) components.push({ weight: WEIGHTS.voice, value: input.voice });
  if (input.resemblance !== null)
    components.push({ weight: WEIGHTS.performance, value: input.resemblance });

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const post = Math.round(
    components.reduce((sum, c) => sum + c.weight * c.value, 0) / totalWeight
  );

  const hasLive = input.voice !== null && input.resemblance !== null;

  return {
    post: Math.max(0, Math.min(100, post)),
    postProvisional: !hasLive,
    voice: input.voice,
    performance: input.resemblance === null ? null : resemblanceToGrade(input.resemblance),
    reach: input.reach,
  };
}

/** UI banding shared by every score readout (orb, panel, badges). */
export function scoreBand(score: number): "good" | "warning" | "danger" {
  if (score >= 80) return "good";
  if (score >= 60) return "warning";
  return "danger";
}

export function gradeBand(grade: Grade): "good" | "warning" | "danger" {
  return scoreBand(gradeToValue(grade));
}
