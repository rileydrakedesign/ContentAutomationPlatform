/**
 * Canonical weighted-engagement score used across the entire app.
 *
 * Accepts both PostMetrics (captured_posts) and PostAnalytics (CSV) field names.
 * Weights: replies 10× · retweets/reposts 3× · bookmarks 3× · likes 1× · impressions 0.001×
 *
 * Anchored to X's documented "heavy ranker" weights (open-sourced 2023), which
 * value a reply ~27× a like and a retweet ~2× a like — i.e. conversation is the
 * dominant positive signal, reach is secondary. We move decisively toward that
 * ordering (reply ≫ retweet ≈ bookmark > like) while compressing X's extreme
 * 27× and keeping bookmarks elevated as a high-intent "save" signal. The 2023
 * numbers are the LAST PUBLISHED coefficients: the 2026 Grok-based ranker
 * (open-sourced Jan/May 2026, xai-org/x-algorithm) still predicts these same
 * actions but redacts its live weights — treat the *ordering* as the durable
 * signal, the exact numbers as tunable (see x-algorithm.ts ALGORITHM_CLAIMS).
 * Changing these re-ranks the post pool (posts-pool.ts), which re-derives
 * extracted-pattern multipliers on the next extraction.
 */
type EngagementFields = Partial<
  Record<
    "likes" | "retweets" | "reposts" | "replies" | "bookmarks" | "views" | "impressions",
    number | null | undefined
  >
>;

export function weightedEngagement(m: EngagementFields): number {
  const likes = m.likes ?? 0;
  const retweets = (m.retweets ?? m.reposts) ?? 0;
  const replies = m.replies ?? 0;
  const bookmarks = m.bookmarks ?? 0;
  const impressions = (m.views ?? m.impressions) ?? 0;

  return (
    likes * 1 +
    retweets * 3 +
    replies * 10 +
    bookmarks * 3 +
    impressions * 0.001
  );
}

/**
 * Canonical opportunity traction: weighted engagement decayed by post age, so
 * fresh posts with momentum outrank old saturated ones. This is the ONE
 * ranking formula for reply targets — the server (search-mapping.ts
 * tractionScore) and the extension pill (via the bundled engine,
 * chrome-extension/src/engine-entry.ts) both call it, so their orderings can
 * never drift. Ages below the floor rank as if at the floor: below one hour
 * the metrics are too thin for the ratio to mean "momentum".
 */
export const TRACTION_MIN_AGE_HOURS = 1;

export function opportunityTraction(m: EngagementFields, ageHours: number): number {
  return weightedEngagement(m) / Math.max(TRACTION_MIN_AGE_HOURS, ageHours);
}
