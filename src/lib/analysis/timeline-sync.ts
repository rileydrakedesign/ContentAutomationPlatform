/**
 * Timeline analytics sync — pulls the user's recent tweets from the X API and
 * merges their live metrics into `user_analytics.posts` (the primary source of
 * the canonical analyzable pool). Shared by:
 *   - POST /api/analytics/sync          (user-triggered, in-app)
 *   - POST /api/v1/analytics/sync       (agent/API-triggered)
 *   - the daily-ops loop-upkeep cron    (automatic)
 *   - x/callback first-session bootstrap (cold start)
 *
 * Gating lives at the call sites (xApiSync is a paid feature for *timeline*
 * sync). The own-post metrics refresh (own-posts-refresh.ts) is the ungated
 * path that keeps the loop fresh for everyone.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getUserTimeline, mapV2ToPostAnalytics, getValidAccessToken } from "@/lib/x-api";
import type { PostAnalytics } from "@/types/analytics";
import { capPostsByRecency } from "@/lib/utils/analytics-retention";

export interface SyncTimelineResult {
  synced: number;
  merged: number;
  total: number;
}

export interface SyncTimelineOptions {
  /** Number of timeline pages (100 tweets each) to fetch. Default 2 (~200). */
  pages?: number;
  /** Reuse an access token + connection already fetched by the caller. */
  accessToken?: string;
  connection?: { x_user_id: string };
}

export async function syncUserTimeline(
  supabase: SupabaseClient,
  userId: string,
  opts: SyncTimelineOptions = {}
): Promise<SyncTimelineResult> {
  const { pages = 2 } = opts;

  let accessToken = opts.accessToken;
  let connection = opts.connection;
  if (!accessToken || !connection) {
    const valid = await getValidAccessToken(userId);
    accessToken = valid.accessToken;
    connection = valid.connection;
  }

  // Fetch recent tweets via pagination
  const allTweets: PostAnalytics[] = [];
  let paginationToken: string | undefined;
  for (let page = 0; page < pages; page++) {
    const { data: tweets, meta } = await getUserTimeline(
      accessToken,
      connection.x_user_id,
      100,
      paginationToken
    );
    for (const tweet of tweets) {
      allTweets.push(mapV2ToPostAnalytics(tweet));
    }
    paginationToken = meta.next_token;
    if (!paginationToken) break;
  }

  // Load existing user_analytics row (latest)
  const { data: existingRow } = await supabase
    .from("user_analytics")
    .select("id, posts")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existingPosts: PostAnalytics[] =
    existingRow?.posts && Array.isArray(existingRow.posts)
      ? (existingRow.posts as PostAnalytics[])
      : [];

  const existingByPostId = new Map<string, PostAnalytics>();
  for (const p of existingPosts) {
    existingByPostId.set(p.post_id, p);
  }

  // Merge: API data updates live metrics; CSV-only fields are preserved.
  let mergedCount = 0;
  for (const apiPost of allTweets) {
    const existing = existingByPostId.get(apiPost.post_id);
    if (existing) {
      existingByPostId.set(apiPost.post_id, {
        ...existing,
        impressions: apiPost.impressions,
        likes: apiPost.likes,
        replies: apiPost.replies,
        reposts: apiPost.reposts,
        bookmarks: apiPost.bookmarks,
        engagement_score: apiPost.engagement_score,
        data_source: "both",
      });
      mergedCount++;
    } else {
      existingByPostId.set(apiPost.post_id, apiPost);
    }
  }

  const mergedPosts = capPostsByRecency(Array.from(existingByPostId.values()));
  const nonReplyPosts = mergedPosts.filter((p) => !p.is_reply);

  mergedPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const dates = mergedPosts.map((p) => new Date(p.date).getTime()).filter((t) => !isNaN(t));
  const dateRange =
    dates.length > 0
      ? {
          start: new Date(Math.min(...dates)).toISOString().split("T")[0],
          end: new Date(Math.max(...dates)).toISOString().split("T")[0],
        }
      : { start: "", end: "" };

  const upsertData = {
    user_id: userId,
    posts: mergedPosts,
    total_posts: nonReplyPosts.length,
    total_replies: mergedPosts.length - nonReplyPosts.length,
    date_range: dateRange,
    uploaded_at: new Date().toISOString(),
  };

  if (existingRow?.id) {
    await supabase.from("user_analytics").update(upsertData).eq("id", existingRow.id);
  } else {
    await supabase.from("user_analytics").insert(upsertData);
  }

  // Stamp last sync time on the connection
  await supabase
    .from("x_connections")
    .update({ last_api_sync_at: new Date().toISOString() })
    .eq("user_id", userId);

  return { synced: allTweets.length, merged: mergedCount, total: mergedPosts.length };
}
