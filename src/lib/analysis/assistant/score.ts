/**
 * Score composition — the headline "Post Score" and the Performance grade.
 *
 * Post Score blends the two opacities as CO-EQUAL pillars, plus the personal
 * winners signal:
 *   0.40·voice + 0.40·algorithm(reach) + 0.20·performance
 * Voice and algorithm-fit are weighted equally on purpose — the product's whole
 * thesis is "sounds like you AND ranks like your best"; neither is a side check.
 * Before a Live Read fills in voice + performance, the weights renormalize over
 * the components we actually have (just reach), and the score is marked
 * provisional so the UI can show it as "live so far" rather than final.
 *
 * FINDINGS-COUPLED DEDUCTIONS — the invariant that makes the score honest:
 * every open finding holds points out of the score, so accepting (or dismissing)
 * a suggestion ALWAYS visibly moves the headline. Deterministic Tier-0 reach
 * findings are already priced into computeReachScore (tier0.ts); everything else
 * deducts here via `scorePenalties`:
 *   - voice findings   → deduct from the Voice sub-score (live drift −6, guardrail −4)
 *   - live reach/algorithm findings → deduct from the Algorithm sub-score (−7)
 *   - correctness      → deduct from the blended post (−5 each)
 *   - clarity          → deduct from the blended post (−1 each, capped at −4)
 * The sub-scores the panel displays are the deducted values, so the numbers the
 * user sees and the blend they feed are the same numbers.
 *
 * Performance is expressed as a letter grade (A–F), not a number, on purpose:
 * resemblance-to-your-winners is a fuzzy signal and a grade avoids false
 * precision (locked decision, 2026-06-24).
 */

import type { Finding, Grade, Scores } from "./types";

const WEIGHTS = { voice: 0.4, performance: 0.2, reach: 0.4 } as const;

/** Points each open finding holds out of the score, by (class, source).
 *  Exported so tests and UI copy can cite the exact coupling. */
export const FINDING_DEDUCTIONS = {
  /** L3 voice drift — deducted from the Voice sub-score. */
  voiceLive: 6,
  /** Tier-0 guardrail avoid-word — deducted from the Voice sub-score. */
  voiceTier0: 4,
  /** L3 algorithm finding — deducted from the Algorithm (reach) sub-score.
   *  (Tier-0 reach findings are priced directly in computeReachScore.) */
  reachLive: 7,
  /** Any correctness finding — deducted from the blended post score. */
  correctness: 5,
  /** Clarity (filler) — deducted from the blended post score, capped. */
  clarity: 1,
  clarityCap: 4,
} as const;

export interface ScorePenalties {
  /** Points to subtract from the Voice sub-score (open voice findings). */
  voice: number;
  /** Points to subtract from the Algorithm sub-score (open live reach findings). */
  algorithm: number;
  /** Points to subtract from the blended post (correctness + clarity). */
  craft: number;
}

/** Sum the deductions held by the currently-visible findings. */
export function scorePenalties(findings: Finding[]): ScorePenalties {
  let voice = 0;
  let algorithm = 0;
  let correctness = 0;
  let clarity = 0;
  for (const f of findings) {
    if (f.class === "voice") {
      voice += f.source === "live" ? FINDING_DEDUCTIONS.voiceLive : FINDING_DEDUCTIONS.voiceTier0;
    } else if (f.class === "reach" && f.source === "live") {
      algorithm += FINDING_DEDUCTIONS.reachLive;
    } else if (f.class === "correctness") {
      correctness += FINDING_DEDUCTIONS.correctness;
    } else if (f.class === "clarity") {
      clarity += FINDING_DEDUCTIONS.clarity;
    }
  }
  return {
    voice,
    algorithm,
    craft: correctness + Math.min(clarity, FINDING_DEDUCTIONS.clarityCap),
  };
}

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

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export interface ComposeScoresInput {
  /** Deterministic reach sub-score (always present; Tier-0 levers priced in). */
  reach: number;
  /** 0-100 voice match, or null if no Live Read yet. */
  voice: number | null;
  /** 0-100 resemblance, or null if no Live Read yet. */
  resemblance: number | null;
  /** Deductions held by open findings (see scorePenalties). Omit for none. */
  penalties?: ScorePenalties;
}

/**
 * Compose the full Scores object from the components available right now,
 * renormalizing the blend over present components. Sub-scores are returned
 * post-deduction so the displayed numbers match what the blend used.
 */
export function composeScores(input: ComposeScoresInput): Scores {
  const p = input.penalties ?? { voice: 0, algorithm: 0, craft: 0 };
  const reachAdj = clamp01to100(input.reach - p.algorithm);
  const voiceAdj = input.voice === null ? null : clamp01to100(input.voice - p.voice);

  const components: { weight: number; value: number }[] = [
    { weight: WEIGHTS.reach, value: reachAdj },
  ];
  if (voiceAdj !== null) components.push({ weight: WEIGHTS.voice, value: voiceAdj });
  if (input.resemblance !== null)
    components.push({ weight: WEIGHTS.performance, value: input.resemblance });

  const totalWeight = components.reduce((sum, c) => sum + c.weight, 0);
  const blended =
    components.reduce((sum, c) => sum + c.weight * c.value, 0) / totalWeight;
  const post = clamp01to100(blended - p.craft);

  const hasLive = input.voice !== null && input.resemblance !== null;

  return {
    post,
    postProvisional: !hasLive,
    voice: voiceAdj,
    performance: input.resemblance === null ? null : resemblanceToGrade(input.resemblance),
    reach: reachAdj,
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
