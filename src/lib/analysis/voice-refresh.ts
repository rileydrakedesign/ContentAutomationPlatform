/**
 * Voice example refresh — core logic shared by POST /api/voice/refresh and
 * the one-click Voice Tune-Up (/api/insights/tuneup).
 *
 * Refreshes BOTH voices from their own pools: post examples from the
 * analyzable-post pool, reply examples from the reply pool — post style and
 * reply style are different crafts with different winners. Both ranked by the
 * same weightedEngagement currency as patterns and niche analysis, so the
 * examples in an assembled prompt are optimized to the same objective as the
 * patterns injected beside them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnalyzablePosts, getAnalyzableReplies } from "./posts-pool";

// Estimate tokens (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface VoiceRefreshResult {
  message: string;
  examples_updated: number;
  last_refresh_at?: string;
}

/** Pinned/excluded texts for one content type — user decisions to preserve. */
async function fetchCuration(
  supabase: SupabaseClient,
  userId: string,
  contentType: "post" | "reply"
): Promise<{ pinned: Set<string>; excluded: Set<string> }> {
  const [pinnedRes, excludedRes] = await Promise.all([
    supabase
      .from("user_voice_examples")
      .select("content_text")
      .eq("user_id", userId)
      .eq("content_type", contentType)
      .eq("source", "pinned")
      .eq("is_excluded", false),
    supabase
      .from("user_voice_examples")
      .select("content_text")
      .eq("user_id", userId)
      .eq("content_type", contentType)
      .eq("is_excluded", true),
  ]);
  return {
    pinned: new Set(
      pinnedRes.data?.map((e) => String(e.content_text || "")).filter(Boolean) || []
    ),
    excluded: new Set(
      excludedRes.data?.map((e) => String(e.content_text || "")).filter(Boolean) || []
    ),
  };
}

export async function refreshVoiceExamples(
  supabase: SupabaseClient,
  userId: string
): Promise<VoiceRefreshResult> {
  // The two pools, deliberately separate.
  const [posts, replies] = await Promise.all([
    getAnalyzablePosts(supabase, userId),
    getAnalyzableReplies(supabase, userId).catch(() => []),
  ]);

  if (posts.length === 0 && replies.length === 0) {
    return {
      message:
        "No analyzable posts found. Upload your X analytics CSV or connect your X account first.",
      examples_updated: 0,
    };
  }

  const [postCuration, replyCuration] = await Promise.all([
    fetchCuration(supabase, userId, "post"),
    fetchCuration(supabase, userId, "reply"),
  ]);

  // Top 10 of each pool, minus user-curated pins/exclusions.
  const autoSelectedPosts = posts
    .filter((p) => !postCuration.pinned.has(p.text) && !postCuration.excluded.has(p.text))
    .slice(0, 10);
  const autoSelectedReplies = replies
    .filter((r) => !replyCuration.pinned.has(r.text) && !replyCuration.excluded.has(r.text))
    .slice(0, 10);

  // Replace old auto-selected examples for both types. Scoped to source=auto —
  // pinned and excluded rows are user decisions and survive every refresh.
  const { error: deleteError } = await supabase
    .from("user_voice_examples")
    .delete()
    .eq("user_id", userId)
    .eq("source", "auto")
    .in("content_type", ["post", "reply"]);

  if (deleteError) throw deleteError;

  const examples = [
    ...autoSelectedPosts.map((post, index) => ({
      user_id: userId,
      captured_post_id: null,
      content_text: post.text,
      content_type: "post" as const,
      source: "auto" as const,
      is_excluded: false,
      metrics_snapshot: { ...post.metrics },
      engagement_score: Math.round(post.engagement_score),
      token_count: estimateTokens(post.text),
      selection_reason:
        index === 0
          ? "highest weighted engagement"
          : `top ${index + 1} by weighted engagement`,
    })),
    ...autoSelectedReplies.map((reply, index) => ({
      user_id: userId,
      captured_post_id: null,
      content_text: reply.text,
      content_type: "reply" as const,
      source: "auto" as const,
      is_excluded: false,
      metrics_snapshot: { ...reply.metrics },
      engagement_score: Math.round(reply.engagement_score),
      token_count: estimateTokens(reply.text),
      selection_reason:
        reply.engagement_score > 0
          ? index === 0
            ? "highest weighted engagement among your replies"
            : `top ${index + 1} reply by weighted engagement`
          : "recent sent reply (metrics not yet synced)",
    })),
  ];

  if (examples.length > 0) {
    const { error: insertError } = await supabase
      .from("user_voice_examples")
      .insert(examples);

    if (insertError) throw insertError;
  }

  // Update last refresh timestamp in settings
  const now = new Date().toISOString();
  await supabase
    .from("user_voice_settings")
    .upsert(
      {
        user_id: userId,
        last_refresh_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );

  return {
    message: "Top examples updated successfully",
    examples_updated: examples.length,
    last_refresh_at: now,
  };
}
