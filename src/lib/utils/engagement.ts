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
 * weights are a snapshot of a system X is actively changing (link penalties,
 * Grok migration) — treat the *ordering* as the durable signal, the exact
 * numbers as tunable. Changing these re-ranks the post pool (posts-pool.ts),
 * which re-derives extracted-pattern multipliers on the next extraction.
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
