import type { PostAnalytics } from "@/types/analytics";

// Retention cap for the user_analytics.posts JSONB blob — without it the blob
// grows unboundedly and every read/merge gets slower. Most recent N by date.
export const MAX_ANALYTICS_POSTS = 2000;

export function capPostsByRecency(
  posts: PostAnalytics[],
  max: number = MAX_ANALYTICS_POSTS
): PostAnalytics[] {
  if (posts.length <= max) return posts;
  const time = (p: PostAnalytics) => {
    const t = new Date(p.date).getTime();
    return Number.isNaN(t) ? 0 : t; // undated posts count as oldest
  };
  return [...posts].sort((a, b) => time(b) - time(a)).slice(0, max);
}
