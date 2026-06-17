/**
 * Voice example refresh — core logic shared by POST /api/voice/refresh and
 * the one-click Voice Tune-Up (/api/insights/tuneup).
 *
 * Reads the canonical analyzable-post pool and ranks by weightedEngagement —
 * the same pool and the same currency as patterns and niche analysis, so the
 * examples in the assembled prompt are optimized to the same objective as
 * the patterns injected beside them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnalyzablePosts } from "./posts-pool";

// Estimate tokens (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export interface VoiceRefreshResult {
  message: string;
  examples_updated: number;
  last_refresh_at?: string;
}

export async function refreshVoiceExamples(
  supabase: SupabaseClient,
  userId: string
): Promise<VoiceRefreshResult> {
  // Canonical pool, already sorted by weighted engagement (best first)
  const posts = await getAnalyzablePosts(supabase, userId);

  if (posts.length === 0) {
    return {
      message:
        "No analyzable posts found. Upload your X analytics CSV or connect your X account first.",
      examples_updated: 0,
    };
  }

  // Get existing pinned examples (preserve them)
  const { data: pinnedExamples } = await supabase
    .from("user_voice_examples")
    .select("content_text")
    .eq("user_id", userId)
    .eq("content_type", "post")
    .eq("source", "pinned")
    .eq("is_excluded", false);

  const pinnedTexts = new Set(
    pinnedExamples?.map((e) => String(e.content_text || "")).filter(Boolean) || []
  );

  // Get excluded post texts
  const { data: excludedExamples } = await supabase
    .from("user_voice_examples")
    .select("content_text")
    .eq("user_id", userId)
    .eq("content_type", "post")
    .eq("is_excluded", true);

  const excludedTexts = new Set(
    excludedExamples?.map((e) => String(e.content_text || "")).filter(Boolean) || []
  );

  // Select top 10 posts not already pinned or excluded
  const autoSelected = posts
    .filter((p) => !pinnedTexts.has(p.text) && !excludedTexts.has(p.text))
    .slice(0, 10);

  // Remove old auto-selected examples
  const { error: deleteError } = await supabase
    .from("user_voice_examples")
    .delete()
    .eq("user_id", userId)
    .eq("source", "auto");

  if (deleteError) throw deleteError;

  // Insert new auto-selected examples
  if (autoSelected.length > 0) {
    const examples = autoSelected.map((post, index) => ({
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
    }));

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
    examples_updated: autoSelected.length,
    last_refresh_at: now,
  };
}
