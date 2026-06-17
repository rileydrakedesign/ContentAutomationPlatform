/**
 * The canonical analyzable-post pool.
 *
 * Every analysis surface (niche analyze, pattern extract, voice refresh,
 * best-times) reads the user's posting history through this one function so
 * the niche, patterns, examples, and timing advice in an assembled prompt
 * all describe the same set of posts, ranked by the same engagement
 * function (`weightedEngagement`).
 *
 * Sources, merged and deduped by tweet id:
 * - `user_analytics.posts` (latest CSV upload + API analytics sync) — primary
 * - `captured_posts` (extension capture + /api/x/sync) — supplement
 * - `extension_replies` (replies sent via the Chrome extension) — reply pool
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { weightedEngagement } from "@/lib/utils/engagement";

export interface AnalyzablePostMetrics {
  likes: number;
  reposts: number;
  replies: number;
  bookmarks: number;
  impressions: number;
}

export interface AnalyzablePost {
  post_id: string; // X tweet id when known, "" for CSV rows without one
  text: string;
  is_reply: boolean;
  posted_at: string; // ISO date string when known, "" otherwise
  metrics: AnalyzablePostMetrics;
  engagement_score: number; // weightedEngagement(metrics) — the one currency
  source: "analytics" | "captured" | "extension_reply";
}

export interface GetAnalyzablePostsOptions {
  /** Include replies in the pool (default false — original posts only). */
  includeReplies?: boolean;
  /** Minimum text length to count as analyzable (default 10). */
  minTextLength?: number;
}

export async function getAnalyzablePosts(
  supabase: SupabaseClient,
  userId: string,
  opts: GetAnalyzablePostsOptions = {}
): Promise<AnalyzablePost[]> {
  const { includeReplies = false, minTextLength = 10 } = opts;

  const [analyticsResult, capturedResult, extensionRepliesResult] = await Promise.all([
    supabase
      .from("user_analytics")
      .select("posts")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("captured_posts")
      .select("x_post_id, text_content, metrics, post_timestamp")
      .eq("user_id", userId)
      .eq("is_own_post", true)
      .order("post_timestamp", { ascending: false })
      .limit(500),
    includeReplies
      ? supabase
          .from("extension_replies")
          .select("reply_text, sent_at")
          .eq("user_id", userId)
          .order("sent_at", { ascending: false })
          .limit(500)
      : Promise.resolve({ data: null }),
  ]);

  const seenIds = new Set<string>();
  const posts: AnalyzablePost[] = [];

  // Primary: user_analytics.posts (PostAnalytics[] from CSV upload / API sync)
  if (analyticsResult.data?.posts && Array.isArray(analyticsResult.data.posts)) {
    for (const p of analyticsResult.data.posts as Array<Record<string, unknown>>) {
      const isReply = Boolean(p.is_reply);
      if (isReply && !includeReplies) continue;

      const text = String(p.text || "").trim();
      if (text.length < minTextLength) continue;

      const postId = String(p.post_id || p.id || "");
      if (postId) {
        if (seenIds.has(postId)) continue;
        seenIds.add(postId);
      }

      const metrics: AnalyzablePostMetrics = {
        likes: Number(p.likes) || 0,
        reposts: Number(p.reposts) || 0,
        replies: Number(p.replies) || 0,
        bookmarks: Number(p.bookmarks) || 0,
        impressions: Number(p.impressions) || 0,
      };

      posts.push({
        post_id: postId,
        text,
        is_reply: isReply,
        posted_at: String(p.date || ""),
        metrics,
        engagement_score: weightedEngagement(metrics),
        source: "analytics",
      });
    }
  }

  // Supplement: captured_posts — skip anything already present via analytics.
  // (captured_posts carries no reply flag; the extension capture and sync
  // paths store original posts, so these are treated as posts.)
  if (capturedResult.data) {
    for (const p of capturedResult.data) {
      const xId = String(p.x_post_id || "");
      if (xId && seenIds.has(xId)) continue;
      if (xId) seenIds.add(xId);

      const text = String(p.text_content || "").trim();
      if (text.length < minTextLength) continue;

      const m = (p.metrics as Record<string, number>) || {};
      const metrics: AnalyzablePostMetrics = {
        likes: Number(m.likes) || 0,
        reposts: Number(m.retweets || m.reposts) || 0,
        replies: Number(m.replies) || 0,
        bookmarks: Number(m.bookmarks) || 0,
        impressions: Number(m.views || m.impressions) || 0,
      };

      posts.push({
        post_id: xId,
        text,
        is_reply: false,
        posted_at: p.post_timestamp ? String(p.post_timestamp) : "",
        metrics,
        engagement_score: weightedEngagement(metrics),
        source: "captured",
      });
    }
  }

  // Reply pool: replies the user sent through the Chrome extension. No
  // performance metrics yet — they join the pool so the reply voice can
  // eventually tune on real sent replies.
  if (extensionRepliesResult.data) {
    for (const r of extensionRepliesResult.data as Array<{ reply_text: string; sent_at: string | null }>) {
      const text = String(r.reply_text || "").trim();
      if (text.length < minTextLength) continue;

      const metrics: AnalyzablePostMetrics = {
        likes: 0,
        reposts: 0,
        replies: 0,
        bookmarks: 0,
        impressions: 0,
      };

      posts.push({
        post_id: "",
        text,
        is_reply: true,
        posted_at: r.sent_at ? String(r.sent_at) : "",
        metrics,
        engagement_score: 0,
        source: "extension_reply",
      });
    }
  }

  // One ranking everywhere: weighted engagement, best first.
  posts.sort((a, b) => b.engagement_score - a.engagement_score);

  return posts;
}
