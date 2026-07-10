/**
 * The canonical analyzable pools — POSTS and REPLIES, deliberately separate.
 *
 * Posts and replies are different crafts with different success signals, so
 * they get different pools:
 *
 * - `getAnalyzablePosts` — original posts only. Every post-side analysis
 *   surface (niche analyze, pattern extract, post-voice refresh, best-times)
 *   reads through this one function, ranked by `weightedEngagement`.
 *
 * - `getAnalyzableReplies` — the user's replies as PAIRS: what was said → how
 *   the user answered. Sources: analytics-synced own replies (real metrics +
 *   `in_reply_to_post_id`) merged with `extension_replies` (every reply that
 *   went through a product surface: handoff, extension send-log, timeline
 *   mirror — carries `replied_to_text` parent context). Reply-voice surfaces
 *   (reply live-read grounding, reply-voice examples) read through this.
 *
 * Sources for posts, merged and deduped by tweet id:
 * - `user_analytics.posts` (latest CSV upload + API analytics sync) — primary
 * - `captured_posts` (extension capture + /api/x/sync) — supplement
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
  source: "analytics" | "captured";
}

export interface GetAnalyzablePostsOptions {
  /** Minimum text length to count as analyzable (default 10). */
  minTextLength?: number;
}

export async function getAnalyzablePosts(
  supabase: SupabaseClient,
  userId: string,
  opts: GetAnalyzablePostsOptions = {}
): Promise<AnalyzablePost[]> {
  const { minTextLength = 10 } = opts;

  const [analyticsResult, capturedResult] = await Promise.all([
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
  ]);

  const seenIds = new Set<string>();
  const posts: AnalyzablePost[] = [];

  // Primary: user_analytics.posts (PostAnalytics[] from CSV upload / API sync)
  if (analyticsResult.data?.posts && Array.isArray(analyticsResult.data.posts)) {
    for (const p of analyticsResult.data.posts as Array<Record<string, unknown>>) {
      const isReply = Boolean(p.is_reply);
      if (isReply) continue; // replies live in getAnalyzableReplies

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

  // One ranking everywhere: weighted engagement, best first.
  posts.sort((a, b) => b.engagement_score - a.engagement_score);

  return posts;
}

// ── The reply pool ───────────────────────────────────────────────────────────

export interface AnalyzableReply {
  /** The user's reply tweet id when known (analytics-synced), "" otherwise. */
  post_id: string;
  /** The user's reply text. */
  text: string;
  posted_at: string;
  metrics: AnalyzablePostMetrics;
  /** weightedEngagement of the REPLY itself — how this answer performed. */
  engagement_score: number;
  /** The post being answered — the other half of the pair. */
  parent: { post_id: string | null; text: string | null };
  source: "analytics" | "extension_reply";
}

function normalizeReplyText(t: string): string {
  return t.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * The user's replies as (parent → reply) pairs, best-performing first.
 *
 * Merge strategy: analytics-synced replies are primary (they carry REAL
 * metrics — the "top-performing reply style" signal); `extension_replies`
 * rows are matched to them by parent id or normalized text to contribute the
 * parent TEXT (`replied_to_text`, written at handoff/send/mirror time).
 * Unmatched extension rows join with zero metrics — recent style evidence
 * whose numbers haven't synced yet. Parent text falls back to the Radar
 * candidate pool when the target came through a sweep.
 */
export async function getAnalyzableReplies(
  supabase: SupabaseClient,
  userId: string,
  opts: GetAnalyzablePostsOptions = {}
): Promise<AnalyzableReply[]> {
  const { minTextLength = 5 } = opts;

  const [analyticsResult, extensionResult] = await Promise.all([
    supabase
      .from("user_analytics")
      .select("posts")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("extension_replies")
      .select("reply_text, replied_to_post_id, replied_to_text, sent_at")
      .eq("user_id", userId)
      .order("sent_at", { ascending: false })
      .limit(500),
  ]);

  interface ExtRow {
    reply_text: string | null;
    replied_to_post_id: string | null;
    replied_to_text: string | null;
    sent_at: string | null;
  }
  const extRows = (extensionResult.data || []) as ExtRow[];

  // Parent text lookups from the reply-pool records, keyed two ways.
  const parentTextById = new Map<string, string>();
  const parentByReplyText = new Map<string, { id: string | null; text: string | null }>();
  for (const r of extRows) {
    const parentId = r.replied_to_post_id ? String(r.replied_to_post_id) : null;
    const parentText = (r.replied_to_text || "").trim() || null;
    if (parentId && parentText && !parentTextById.has(parentId)) {
      parentTextById.set(parentId, parentText);
    }
    const key = normalizeReplyText(String(r.reply_text || ""));
    if (key && !parentByReplyText.has(key)) {
      parentByReplyText.set(key, { id: parentId, text: parentText });
    }
  }

  const replies: AnalyzableReply[] = [];
  const seenReplyKeys = new Set<string>();

  // Primary: analytics-synced replies — real metrics.
  if (analyticsResult.data?.posts && Array.isArray(analyticsResult.data.posts)) {
    for (const p of analyticsResult.data.posts as Array<Record<string, unknown>>) {
      if (!p.is_reply) continue;
      const text = String(p.text || "").trim();
      if (text.length < minTextLength) continue;

      const metrics: AnalyzablePostMetrics = {
        likes: Number(p.likes) || 0,
        reposts: Number(p.reposts) || 0,
        replies: Number(p.replies) || 0,
        bookmarks: Number(p.bookmarks) || 0,
        impressions: Number(p.impressions) || 0,
      };

      const parentId = p.in_reply_to_post_id ? String(p.in_reply_to_post_id) : null;
      const matched = parentByReplyText.get(normalizeReplyText(text));
      const resolvedParentId = parentId ?? matched?.id ?? null;
      const parentText =
        (resolvedParentId ? parentTextById.get(resolvedParentId) : undefined) ??
        matched?.text ??
        null;

      seenReplyKeys.add(normalizeReplyText(text));
      replies.push({
        post_id: String(p.post_id || p.id || ""),
        text,
        posted_at: String(p.date || ""),
        metrics,
        engagement_score: weightedEngagement(metrics),
        parent: { post_id: resolvedParentId, text: parentText },
        source: "analytics",
      });
    }
  }

  // Supplement: extension_replies not yet visible in analytics (too fresh, or
  // pre-dating the sync window). Zero metrics until the sync catches up.
  for (const r of extRows) {
    const text = String(r.reply_text || "").trim();
    if (text.length < minTextLength) continue;
    const key = normalizeReplyText(text);
    if (seenReplyKeys.has(key)) continue;
    seenReplyKeys.add(key);

    const parentId = r.replied_to_post_id ? String(r.replied_to_post_id) : null;
    replies.push({
      post_id: "",
      text,
      posted_at: r.sent_at ? String(r.sent_at) : "",
      metrics: { likes: 0, reposts: 0, replies: 0, bookmarks: 0, impressions: 0 },
      engagement_score: 0,
      parent: {
        post_id: parentId,
        text: (r.replied_to_text || "").trim() || (parentId ? parentTextById.get(parentId) : undefined) || null,
      },
      source: "extension_reply",
    });
  }

  // Fallback parent text: the Radar candidate pool (targets that came through
  // a sweep have their text on file — no X read needed).
  const missingParentIds = [
    ...new Set(
      replies
        .filter((r) => r.parent.post_id && !r.parent.text)
        .map((r) => r.parent.post_id as string)
    ),
  ];
  if (missingParentIds.length > 0) {
    const { data: candidates } = await supabase
      .from("candidate_posts")
      .select("post_id, text")
      .in("post_id", missingParentIds);
    const byId = new Map((candidates || []).map((c) => [String(c.post_id), String(c.text || "")]));
    for (const r of replies) {
      if (r.parent.post_id && !r.parent.text) {
        r.parent.text = byId.get(r.parent.post_id) || null;
      }
    }
  }

  // Best-performing replies first; metric-less rows (score 0) sort by recency
  // among themselves via the stable sort below.
  replies.sort(
    (a, b) =>
      b.engagement_score - a.engagement_score ||
      (b.posted_at || "").localeCompare(a.posted_at || "")
  );

  return replies;
}
