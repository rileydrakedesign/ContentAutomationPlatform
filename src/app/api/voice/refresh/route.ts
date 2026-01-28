import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

// Estimate tokens (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Calculate engagement score
function calculateEngagementScore(metrics: Record<string, number>): number {
  return (
    (metrics.likes || 0) +
    (metrics.retweets || 0) * 2 +
    (metrics.replies || 0) * 3 +
    (metrics.quotes || 0) * 4
  );
}

// POST /api/voice/refresh - Manually trigger a refresh of top examples
export async function POST() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get user's captured posts (own posts only)
    const { data: posts, error: postsError } = await supabase
      .from("captured_posts")
      .select("*")
      .eq("user_id", user.id)
      .eq("triaged_as", "my_post")
      .order("captured_at", { ascending: false })
      .limit(100);

    if (postsError) throw postsError;

    if (!posts || posts.length === 0) {
      return NextResponse.json({
        message: "No posts found to refresh. Sync your X account first.",
        examples_updated: 0,
      });
    }

    // Calculate engagement scores and sort
    const scoredPosts = posts
      .map((post) => ({
        ...post,
        engagement_score: calculateEngagementScore(post.metrics || {}),
      }))
      .sort((a, b) => b.engagement_score - a.engagement_score);

    // Get existing pinned examples (preserve them)
    const { data: pinnedExamples } = await supabase
      .from("user_voice_examples")
      .select("captured_post_id")
      .eq("user_id", user.id)
      .eq("source", "pinned")
      .eq("is_excluded", false);

    const pinnedIds = new Set(
      pinnedExamples?.map((e) => e.captured_post_id).filter(Boolean) || []
    );

    // Get excluded post IDs
    const { data: excludedExamples } = await supabase
      .from("user_voice_examples")
      .select("captured_post_id")
      .eq("user_id", user.id)
      .eq("is_excluded", true);

    const excludedIds = new Set(
      excludedExamples?.map((e) => e.captured_post_id).filter(Boolean) || []
    );

    // Select top 10 posts not already pinned or excluded
    const autoSelected = scoredPosts
      .filter((p) => !pinnedIds.has(p.id) && !excludedIds.has(p.id))
      .slice(0, 10);

    // Remove old auto-selected examples
    const { error: deleteError } = await supabase
      .from("user_voice_examples")
      .delete()
      .eq("user_id", user.id)
      .eq("source", "auto");

    if (deleteError) throw deleteError;

    // Insert new auto-selected examples
    if (autoSelected.length > 0) {
      const examples = autoSelected.map((post, index) => ({
        user_id: user.id,
        captured_post_id: post.id,
        content_text: post.text_content,
        content_type: "post" as const,
        source: "auto" as const,
        is_excluded: false,
        metrics_snapshot: post.metrics || {},
        engagement_score: post.engagement_score,
        token_count: estimateTokens(post.text_content),
        selection_reason:
          index === 0 ? "highest engagement" : `top ${index + 1} by engagement`,
      }));

      const { error: insertError } = await supabase
        .from("user_voice_examples")
        .insert(examples);

      if (insertError) throw insertError;
    }

    // Update last refresh timestamp in settings
    await supabase
      .from("user_voice_settings")
      .upsert(
        {
          user_id: user.id,
          last_refresh_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

    return NextResponse.json({
      message: "Top examples updated successfully",
      examples_updated: autoSelected.length,
      last_refresh_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Failed to refresh voice examples:", error);
    return NextResponse.json(
      { error: "Failed to refresh voice examples" },
      { status: 500 }
    );
  }
}
