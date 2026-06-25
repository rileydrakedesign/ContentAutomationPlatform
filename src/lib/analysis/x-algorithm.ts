/**
 * X (Twitter) ranking algorithm — the single source of truth for "how the
 * algorithm treats your actions."
 *
 * These figures come from X's open-sourced "heavy ranker" (the-algorithm-ml,
 * April 2023): the For-You score is a weighted sum of predicted-engagement
 * probabilities, so the weight on each action is exactly how much the algorithm
 * "cares" about driving it.
 *
 * IMPORTANT — this is a 2023 snapshot of a system X is actively changing:
 *   - external-link demotion tightened through 2025,
 *   - X announced (Oct 2025) a migration to a Grok-based recommender.
 * So treat the *ordering* (replies ≫ retweets > likes; conversation + dwell win;
 * negative feedback is brutal; links are demoted) as the durable, well-attested
 * signal, and the exact numeric weights as directional, not literally current.
 * Surface the caveat (X_ALGORITHM_CAVEAT) wherever the weights are shown.
 *
 * The same ordering anchors our canonical weightedEngagement() — see the
 * ordering-consistency test in x-algorithm.test.ts.
 */

export type AlgorithmSignal =
  | "reply_engaged_by_author"
  | "reply"
  | "good_profile_click"
  | "good_click"
  | "retweet"
  | "like"
  | "video_dwell"
  | "negative_feedback"
  | "report"
  | "external_link";

export interface AlgorithmWeight {
  signal: AlgorithmSignal;
  /** The documented heavy-ranker weight (null where it's a heuristic, not a ranker weight). */
  weight: number | null;
  /** Plain-English label for UI. */
  label: string;
  /** Direction of the effect on reach. */
  effect: "positive" | "negative";
  /** Why it matters, in the user's terms. */
  note: string;
}

/**
 * Documented heavy-ranker weights (2023), ordered most-positive → most-negative.
 * `like` is the unit reference (weight 0.5); ratios in the notes are vs a like.
 */
export const X_ALGORITHM_WEIGHTS: AlgorithmWeight[] = [
  {
    signal: "reply_engaged_by_author",
    weight: 75,
    label: "Reply that you reply back to",
    effect: "positive",
    note: "A reply the author engages with is the single biggest positive signal — ~150× a like. Conversations you join in win.",
  },
  {
    signal: "reply",
    weight: 13.5,
    label: "Reply",
    effect: "positive",
    note: "A reply is worth ~27× a like. Posts that invite a genuine reply get the most reach — this is the lever that matters most.",
  },
  {
    signal: "good_profile_click",
    weight: 12,
    label: "Profile click → engage",
    effect: "positive",
    note: "Someone opening your profile and then engaging/following signals strong interest (~24× a like).",
  },
  {
    signal: "good_click",
    weight: 11,
    label: "Open + engage in the conversation",
    effect: "positive",
    note: "Opening the post and replying/liking inside the thread (~22× a like) — content worth stopping for.",
  },
  {
    signal: "video_dwell",
    weight: 10,
    label: "Dwell ~2+ minutes",
    effect: "positive",
    note: "Holding attention (a long read or a watched video) is rewarded (~20× a like). Dwell-worthy beats scroll-past.",
  },
  {
    signal: "retweet",
    weight: 1,
    label: "Retweet / repost",
    effect: "positive",
    note: "A repost is worth ~2× a like — an endorsement that also extends reach.",
  },
  {
    signal: "like",
    weight: 0.5,
    label: "Like",
    effect: "positive",
    note: "The lowest-weighted positive signal — cheap to give, so the algorithm values it least.",
  },
  {
    signal: "external_link",
    weight: null,
    label: "External link in the post",
    effect: "negative",
    note: "Links that send people off X are demoted (reportedly 30–50%+ in 2025). Put the link in a reply, not the main post.",
  },
  {
    signal: "negative_feedback",
    weight: -74,
    label: "Block / mute / “show less”",
    effect: "negative",
    note: "A single block, mute, or “show less” costs ~148 likes' worth of score. Engagement-bait that annoys people backfires hard.",
  },
  {
    signal: "report",
    weight: -369,
    label: "Report",
    effect: "negative",
    note: "The most damaging signal by far — one report cancels ~738 likes.",
  },
];

/**
 * Phrasing that invites a genuine reply — the highest-weighted positive signal
 * (a reply ≈ 27× a like). Matched case-insensitively.
 *
 * SHARED so the deterministic layers never drift: imported by both the writing
 * assistant's Tier-0 engine (tier0.ts) and the pre-publish read
 * (prepublish-read.ts). A parity test pins them equal (x-algorithm.test.ts).
 */
export const REPLY_DRIVING = [
  "what do you think",
  "what's your",
  "whats your",
  "agree?",
  "am i wrong",
  "change my mind",
  "unpopular opinion",
  "hot take",
  "thoughts?",
  "anyone else",
  "how do you",
  "what would you",
  "?",
];

/**
 * Cheap engagement-bait that risks block/mute/"show less" (−74 each). Matched
 * case-insensitively. Shared by tier0.ts and prepublish-read.ts (parity test).
 */
export const ENGAGEMENT_BAIT = [
  "rt if",
  "retweet if",
  "like if",
  "reply yes",
  "comment yes",
  "follow for",
  "follow me for",
  "tag someone",
  "tag a friend",
  "tag 3",
  "drop a",
  "👇 follow",
];

export const X_ALGORITHM_CAVEAT =
  "Based on X's open-sourced 2023 ranking weights. X has since changed link penalties and announced (Oct 2025) a move to a Grok-based ranker — treat the ordering as directional, not exact.";

export interface AlgorithmNote {
  signal: AlgorithmSignal;
  weight: number | null;
  label: string;
  effect: "positive" | "negative";
  note: string;
}

/**
 * The transparency payload for the "How X treats your actions" panel — the full
 * weight table plus the caveat. Stable/static; surfaced even with zero user data.
 */
export function buildAlgorithmNotes(): AlgorithmNote[] {
  return X_ALGORITHM_WEIGHTS.map((w) => ({
    signal: w.signal,
    weight: w.weight,
    label: w.label,
    effect: w.effect,
    note: w.note,
  }));
}
