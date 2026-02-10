import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { weightedEngagement } from "@/lib/utils/engagement";

// Estimate tokens (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// Calculate engagement score
function calculateEngagementScore(metrics: Record<string, number>): number {
  return weightedEngagement(metrics);
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

    // Use CSV analytics as the sole source of truth for "my posts"
    const { data: row, error: postsError } = await supabase
      .from("user_analytics")
      .select("posts")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    if (postsError && postsError.code !== "PGRST116") throw postsError;

    const posts = (row?.posts && Array.isArray(row.posts)) ? (row.posts as any[]) : [];
    const onlyPosts = posts.filter((p) => p && p.is_reply === false);

    if (onlyPosts.length === 0) {
      return NextResponse.json({
        message: "No posts found in CSV. Upload your X analytics CSV first.",
        examples_updated: 0,
      });
    }

    // Score by impressions (primary)
    const scoredPosts = [...onlyPosts]
      .map((post) => ({
        ...post,
        engagement_score: Number((post as any).impressions || 0),
      }))
      .sort((a, b) => b.engagement_score - a.engagement_score);

    // Get existing pinned examples (preserve them)
    const { data: pinnedExamples } = await supabase
      .from("user_voice_examples")
      .select("content_text")
      .eq("user_id", user.id)
      .eq("content_type", "post")
      .eq("source", "pinned")
      .eq("is_excluded", false);

    const pinnedTexts = new Set(
      pinnedExamples?.map((e) => String(e.content_text || "")).filter(Boolean) || []
    );

    // Get excluded post IDs
    const { data: excludedExamples } = await supabase
      .from("user_voice_examples")
      .select("content_text")
      .eq("user_id", user.id)
      .eq("content_type", "post")
      .eq("is_excluded", true);

    const excludedTexts = new Set(
      excludedExamples?.map((e) => String(e.content_text || "")).filter(Boolean) || []
    );

    // Select top 10 posts not already pinned or excluded
    const autoSelected = scoredPosts
      .filter((p: any) => {
        const text = String(p.text || "");
        return text && !pinnedTexts.has(text) && !excludedTexts.has(text);
      })
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
      const examples = autoSelected.map((post: any, index) => ({
        user_id: user.id,
        captured_post_id: null,
        content_text: String(post.text || ""),
        content_type: "post" as const,
        source: "auto" as const,
        is_excluded: false,
        metrics_snapshot: { impressions: Number(post.impressions || 0) },
        engagement_score: Number(post.engagement_score || 0),
        token_count: estimateTokens(String(post.text || "")),
        selection_reason:
          index === 0 ? "highest impressions" : `top ${index + 1} by impressions`,
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
