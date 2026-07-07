/**
 * X (Twitter) ranking algorithm — the single source of truth for "how the
 * algorithm treats your actions," rebuilt as a provenance-tagged knowledge base.
 *
 * Ground truth (verified by reading the published source, 2026-07):
 * X open-sourced the For-You algorithm at github.com/xai-org/x-algorithm
 * (Jan 20, 2026; updated May 15, 2026). What the release establishes:
 *
 *   - Final Score = Σ weight_i × P(action_i) over ~19 predicted actions
 *     (weighted_scorer.rs): favorite, reply, retweet, photo_expand, click,
 *     profile_click, video_quality_view, share (+DM/copy-link variants),
 *     dwell + continuous dwell_time, quote, quoted_click, follow_author as
 *     positives; not_interested, block_author, mute_author, report negatives.
 *   - The numeric weight coefficients are REDACTED (a server-tuned `params`
 *     module not in the release). Anyone quoting "2026 weights" is guessing.
 *   - No hand-engineered content features; a Grok-based transformer learns
 *     relevance from engagement history. There is NO explicit link-demotion
 *     rule in the published ranking code — the link reach gap is measured
 *     behavior, not a published rule.
 *   - Every post is annotated at publish by Grok classifiers (grox/):
 *     a "banger" quality screen (quality_score, pass ≥ 0.4) with an explicit
 *     slop_score (1–3), plus spam screening (extra scrutiny on low-follower
 *     accounts' replies) and LLM reply ranking.
 *
 * The numeric multipliers we still show (27×, 148, …) are the LAST PUBLISHED
 * coefficients (the 2023 heavy ranker). Treat orderings (replies ≫ retweets >
 * likes; negative feedback is brutal) as durable; exact numbers as historical.
 * Every user-facing claim below carries its provenance and a review-by date —
 * see `ALGORITHM_CLAIMS`. The algo-watch cron (api/cron/algo-watch) diffs the
 * public repo weekly so structural changes surface for review.
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
  | "grok_quality_read"
  | "author_diversity"
  | "negative_feedback"
  | "report"
  | "external_link";

// ---------------------------------------------------------------------------
// The claims knowledge base — every user-facing "why" traces to one of these.
// ---------------------------------------------------------------------------

/**
 * Tier A = verified in X's published code (cite the file).
 * Tier B = measured / externally attested behavior (cite the study + date).
 * Tier C = folklore — exists only so audits can mark retired claims; never ship.
 */
export type ClaimTier = "A" | "B" | "C";

export interface AlgorithmClaim {
  tier: ClaimTier;
  /** The user-facing "why" copy. Self-contained, provenance included. */
  statement: string;
  source: {
    url: string;
    kind: "code" | "measurement" | "announcement";
    /** Date of the source itself (release/study date). */
    date: string;
  };
  /** When we last checked the claim against its source. */
  last_verified: string;
  /** Past this date the claim is stale — re-verify before continuing to ship it. */
  review_by: string;
  status: "active" | "stale" | "retired";
}

const X_ALGO_REPO = "https://github.com/xai-org/x-algorithm";

export const ALGORITHM_CLAIMS = {
  reply_over_like: {
    tier: "B",
    statement:
      "Asks a question or takes a stance — replies are the strongest common positive signal (a reply ≈ 27× a like in the last published weights).",
    source: { url: `${X_ALGO_REPO}/blob/main/home-mixer/scorers/weighted_scorer.rs`, kind: "code", date: "2026-05-15" },
    last_verified: "2026-07-07",
    review_by: "2026-11-15",
    status: "active",
  },
  link_reach_gap: {
    tier: "B",
    statement:
      "Link posts are measured to reach ~30–50% fewer people (2025–26 studies — a measured behavior, not a published rule). Put the link in a reply instead.",
    source: {
      url: "https://adlibrary.com/guides/x-twitter-algorithm-explained",
      kind: "measurement",
      date: "2026-01",
    },
    last_verified: "2026-07-07",
    review_by: "2026-10-07",
    status: "active",
  },
  negative_feedback_costly: {
    tier: "A",
    statement:
      "“RT if / follow for / tag someone” asks invite mutes, blocks and “not interested” — outcomes the ranker predicts and holds against you (a mute cost ~148 likes in the last published weights).",
    source: { url: `${X_ALGO_REPO}/blob/main/home-mixer/scorers/weighted_scorer.rs`, kind: "code", date: "2026-05-15" },
    last_verified: "2026-07-07",
    review_by: "2026-11-15",
    status: "active",
  },
  dwell_rewarded: {
    tier: "A",
    statement:
      "Longer, dwell-worthy content earns predicted-dwell credit — the held read and time-on-post are first-class ranking outcomes.",
    source: { url: `${X_ALGO_REPO}/blob/main/home-mixer/scorers/weighted_scorer.rs`, kind: "code", date: "2026-05-15" },
    last_verified: "2026-07-07",
    review_by: "2026-11-15",
    status: "active",
  },
  media_rewarded: {
    tier: "A",
    statement:
      "Native media earns its own predicted rewards — photo expands and held video views (above a minimum duration) are first-class ranking outcomes.",
    source: { url: `${X_ALGO_REPO}/blob/main/home-mixer/scorers/weighted_scorer.rs`, kind: "code", date: "2026-05-15" },
    last_verified: "2026-07-07",
    review_by: "2026-11-15",
    status: "active",
  },
  grok_quality_read: {
    tier: "A",
    statement:
      "X reads every post with a Grok classifier at publish — scoring quality (a “banger” screen) and slop (1–3). Human-sounding, substantive writing passes; slop is scored against you.",
    source: {
      url: `${X_ALGO_REPO}/blob/main/grox/classifiers/content/banger_initial_screen.py`,
      kind: "code",
      date: "2026-05-15",
    },
    last_verified: "2026-07-07",
    review_by: "2026-11-15",
    status: "active",
  },
  reply_llm_judged: {
    tier: "A",
    statement:
      "Replies are ranked by an LLM judge, and low-follower accounts get an extra LLM spam screen on their replies — generic AI replies are exactly what it's built to catch.",
    source: {
      url: `${X_ALGO_REPO}/blob/main/grox/classifiers/content/reply_ranking.py`,
      kind: "code",
      date: "2026-05-15",
    },
    last_verified: "2026-07-07",
    review_by: "2026-11-15",
    status: "active",
  },
  author_diversity: {
    tier: "A",
    statement:
      "Repeated posts from the same author are attenuated within a session — space posts out rather than stacking them.",
    source: {
      url: `${X_ALGO_REPO}/blob/main/home-mixer/scorers/author_diversity_scorer.rs`,
      kind: "code",
      date: "2026-05-15",
    },
    last_verified: "2026-07-07",
    review_by: "2026-11-15",
    status: "active",
  },
} as const satisfies Record<string, AlgorithmClaim>;

export type AlgorithmClaimId = keyof typeof ALGORITHM_CLAIMS;

/** The user-facing "why" for a claim — compile-time-safe id, single copy source. */
export function claimNote(id: AlgorithmClaimId): string {
  return ALGORITHM_CLAIMS[id].statement;
}

export function isClaimStale(id: AlgorithmClaimId, now: Date = new Date()): boolean {
  const claim = ALGORITHM_CLAIMS[id];
  return claim.status !== "active" || now > new Date(claim.review_by);
}

// ---------------------------------------------------------------------------
// The transparency table ("How X treats your actions")
// ---------------------------------------------------------------------------

export interface AlgorithmWeight {
  signal: AlgorithmSignal;
  /**
   * Last PUBLISHED coefficient (2023 heavy ranker) — the 2026 release redacts
   * the live values. null = structural/measured signal with no published number.
   */
  weight: number | null;
  /** Where the row's authority comes from. */
  basis: "published_2023" | "structural_2026" | "measured";
  /** Plain-English label for UI. */
  label: string;
  /** Direction of the effect on reach. */
  effect: "positive" | "negative";
  /** Why it matters, in the user's terms. */
  note: string;
}

/**
 * Ordered most-positive → most-negative. The 2026 release confirms every one
 * of these actions is still a predicted outcome in the scorer (Tier A); the
 * numbers are the last published (2023) coefficients. `like` is the unit
 * reference (0.5); ratios in the notes are vs a like.
 */
export const X_ALGORITHM_WEIGHTS: AlgorithmWeight[] = [
  {
    signal: "reply_engaged_by_author",
    weight: 75,
    basis: "published_2023",
    label: "Reply that you reply back to",
    effect: "positive",
    note: "A reply the author engages with was the single biggest positive signal — ~150× a like in the last published weights. Conversations you join in win.",
  },
  {
    signal: "reply",
    weight: 13.5,
    basis: "published_2023",
    label: "Reply",
    effect: "positive",
    note: "P(reply) is a first-class predicted outcome in the 2026 ranker; the last published weights valued a reply ~27× a like. Posts that invite a genuine reply get the most reach.",
  },
  {
    signal: "good_profile_click",
    weight: 12,
    basis: "published_2023",
    label: "Profile click → engage",
    effect: "positive",
    note: "Someone opening your profile and then engaging/following signals strong interest (~24× a like in the last published weights; still a predicted outcome today).",
  },
  {
    signal: "good_click",
    weight: 11,
    basis: "published_2023",
    label: "Open + engage in the conversation",
    effect: "positive",
    note: "Opening the post and engaging inside the thread (~22× a like, last published) — content worth stopping for.",
  },
  {
    signal: "video_dwell",
    weight: 10,
    basis: "published_2023",
    label: "Dwell / held view",
    effect: "positive",
    note: "The 2026 ranker predicts dwell twice over — a held read AND continuous time-on-post — plus quality video views above a minimum duration. Dwell-worthy beats scroll-past.",
  },
  {
    signal: "retweet",
    weight: 1,
    basis: "published_2023",
    label: "Retweet / repost",
    effect: "positive",
    note: "A repost was worth ~2× a like in the last published weights — an endorsement that also extends reach.",
  },
  {
    signal: "like",
    weight: 0.5,
    basis: "published_2023",
    label: "Like",
    effect: "positive",
    note: "The lowest-weighted positive signal — cheap to give, so the algorithm values it least.",
  },
  {
    signal: "grok_quality_read",
    weight: null,
    basis: "structural_2026",
    label: "Grok quality read at publish",
    effect: "positive",
    note: claimNote("grok_quality_read"),
  },
  {
    signal: "author_diversity",
    weight: null,
    basis: "structural_2026",
    label: "Same-author repetition",
    effect: "negative",
    note: claimNote("author_diversity"),
  },
  {
    signal: "external_link",
    weight: null,
    basis: "measured",
    label: "External link in the post",
    effect: "negative",
    note: claimNote("link_reach_gap"),
  },
  {
    signal: "negative_feedback",
    weight: -74,
    basis: "published_2023",
    label: "Block / mute / “show less”",
    effect: "negative",
    note: "not_interested, block, mute are predicted outcomes weighted against you in the 2026 ranker. A single one cost ~148 likes' worth of score in the last published weights.",
  },
  {
    signal: "report",
    weight: -369,
    basis: "published_2023",
    label: "Report",
    effect: "negative",
    note: "The most damaging signal by far — one report cancelled ~738 likes in the last published weights, and P(report) is still predicted and punished.",
  },
];

/**
 * Phrasing that invites a genuine reply — the highest-leverage positive signal.
 * Matched case-insensitively.
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
 * Cheap engagement-bait that risks block/mute/"show less" — negative outcomes
 * the ranker predicts (weighted_scorer.rs). Matched case-insensitively.
 * Shared by tier0.ts and prepublish-read.ts (parity test).
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
  "Grounded in X's open-source algorithm (github.com/xai-org/x-algorithm, Jan/May 2026): the ranker predicts per-action probabilities and blends them with server-tuned weights X did not publish. Numeric multipliers shown are the last published coefficients (2023) — treat the ordering as durable, the exact numbers as historical.";

export interface AlgorithmNote {
  signal: AlgorithmSignal;
  weight: number | null;
  basis: AlgorithmWeight["basis"];
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
    basis: w.basis,
    label: w.label,
    effect: w.effect,
    note: w.note,
  }));
}
