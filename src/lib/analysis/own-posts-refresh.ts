/**
 * Own-post metrics refresh — pulls fresh engagement metrics from X for the
 * user's own captured posts (including everything published through the app,
 * API, or MCP, which is backfilled into `captured_posts` with `metrics: {}`).
 *
 * This is the seam that closes the analytics flywheel: a just-published post
 * sits in the pool with zero engagement until its metrics land. Running this
 * on a daily cadence (see the daily-ops cron) means a post published through
 * any surface can rank as a voice example / be mined as a pattern within ~1 day
 * — with no manual CSV upload.
 *
 * Ordered by `post_timestamp` (newest first) so freshly-published posts are
 * refreshed first. Unlike timeline analytics sync, this is NOT plan-gated: it
 * refreshes the user's *own* posts and is the only thing keeping the loop fresh
 * for free users.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTweetsBatch, getValidAccessToken } from "@/lib/x-api";

export interface RefreshOwnPostMetricsResult {
  scanned: number;
  updated: number;
}

export interface RefreshOwnPostMetricsOptions {
  /** Max own posts to refresh in one pass (newest first). Default 200. */
  limit?: number;
  /** Reuse an access token already fetched by the caller. */
  accessToken?: string;
}

export async function refreshOwnPostMetrics(
  supabase: SupabaseClient,
  userId: string,
  opts: RefreshOwnPostMetricsOptions = {}
): Promise<RefreshOwnPostMetricsResult> {
  const { limit = 200 } = opts;

  const { data: posts } = await supabase
    .from("captured_posts")
    .select("id, x_post_id")
    .eq("user_id", userId)
    .eq("is_own_post", true)
    .not("x_post_id", "is", null)
    .order("post_timestamp", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (!posts || posts.length === 0) return { scanned: 0, updated: 0 };

  const accessToken =
    opts.accessToken ?? (await getValidAccessToken(userId)).accessToken;

  const ids = posts.map((p) => p.x_post_id).filter(Boolean) as string[];

  // Build a map of x_post_id -> fresh metrics, batched in groups of 100.
  const metricsMap = new Map<string, Record<string, number>>();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const tweets = await getTweetsBatch(accessToken, batch);
    for (const tweet of tweets) {
      metricsMap.set(tweet.id, {
        likes: tweet.public_metrics?.like_count || 0,
        retweets: tweet.public_metrics?.retweet_count || 0,
        replies: tweet.public_metrics?.reply_count || 0,
        quotes: tweet.public_metrics?.quote_count || 0,
        views: tweet.public_metrics?.impression_count ?? 0,
      });
    }
  }

  let updated = 0;
  for (const post of posts) {
    const freshMetrics = metricsMap.get(post.x_post_id);
    if (!freshMetrics) continue;
    await supabase
      .from("captured_posts")
      .update({ metrics: freshMetrics, updated_at: new Date().toISOString() })
      .eq("id", post.id);
    updated++;
  }

  return { scanned: posts.length, updated };
}
