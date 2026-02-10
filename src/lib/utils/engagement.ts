/**
 * Canonical weighted-engagement score used across the entire app.
 *
 * Accepts both PostMetrics (captured_posts) and PostAnalytics (CSV) field names.
 * Weights: replies 5× · retweets/reposts 4× · likes/bookmarks 3× · impressions 0.001×
 */
export function weightedEngagement(
  m: Record<string, number | undefined | null>
): number {
  const likes = m.likes ?? 0;
  const retweets = (m.retweets ?? m.reposts) ?? 0;
  const replies = m.replies ?? 0;
  const bookmarks = m.bookmarks ?? 0;
  const impressions = (m.views ?? m.impressions) ?? 0;

  return (
    likes * 3 +
    retweets * 4 +
    replies * 5 +
    bookmarks * 3 +
    impressions * 0.001
  );
}
