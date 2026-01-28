import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Vercel Cron configuration
export const runtime = "nodejs";
export const maxDuration = 60;

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

// Refresh voice examples for a single user
async function refreshUserExamples(supabase: any, userId: string): Promise<number> {
  // Get user's captured posts (own posts only)
  const { data: posts, error: postsError } = await supabase
    .from("captured_posts")
    .select("*")
    .eq("user_id", userId)
    .eq("triaged_as", "my_post")
    .order("captured_at", { ascending: false })
    .limit(100);

  if (postsError || !posts || posts.length === 0) {
    return 0;
  }

  // Calculate engagement scores and sort
  const scoredPosts = posts
    .map((post: any) => ({
      ...post,
      engagement_score: calculateEngagementScore(post.metrics || {}),
    }))
    .sort((a: any, b: any) => b.engagement_score - a.engagement_score);

  // Get existing pinned examples (preserve them)
  const { data: pinnedExamples } = await supabase
    .from("user_voice_examples")
    .select("captured_post_id")
    .eq("user_id", userId)
    .eq("source", "pinned")
    .eq("is_excluded", false);

  const pinnedIds = new Set(
    pinnedExamples?.map((e: any) => e.captured_post_id).filter(Boolean) || []
  );

  // Get excluded post IDs
  const { data: excludedExamples } = await supabase
    .from("user_voice_examples")
    .select("captured_post_id")
    .eq("user_id", userId)
    .eq("is_excluded", true);

  const excludedIds = new Set(
    excludedExamples?.map((e: any) => e.captured_post_id).filter(Boolean) || []
  );

  // Select top 10 posts not already pinned or excluded
  const autoSelected = scoredPosts
    .filter((p: any) => !pinnedIds.has(p.id) && !excludedIds.has(p.id))
    .slice(0, 10);

  // Remove old auto-selected examples
  await supabase
    .from("user_voice_examples")
    .delete()
    .eq("user_id", userId)
    .eq("source", "auto");

  // Insert new auto-selected examples
  if (autoSelected.length > 0) {
    const examples = autoSelected.map((post: any, index: number) => ({
      user_id: userId,
      captured_post_id: post.id,
      content_text: post.text_content,
      content_type: "post",
      source: "auto",
      is_excluded: false,
      metrics_snapshot: post.metrics || {},
      engagement_score: post.engagement_score,
      token_count: estimateTokens(post.text_content),
      selection_reason:
        index === 0 ? "highest engagement" : `top ${index + 1} by engagement`,
    }));

    await supabase.from("user_voice_examples").insert(examples);
  }

  // Update last refresh timestamp
  await supabase
    .from("user_voice_settings")
    .upsert(
      {
        user_id: userId,
        last_refresh_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

  return autoSelected.length;
}

// GET /api/cron/voice-refresh - Weekly cron job to refresh voice examples
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    // In production, require CRON_SECRET; in development, allow without auth
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create admin client to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().getDay(); // 0-6, Sunday-Saturday

    // Get users whose refresh day matches today and have auto-refresh enabled
    const { data: settings, error } = await supabase
      .from("user_voice_settings")
      .select("user_id")
      .eq("auto_refresh_enabled", true)
      .eq("refresh_day_of_week", today);

    if (error) {
      console.error("[voice-refresh] Failed to fetch users:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    if (!settings || settings.length === 0) {
      return NextResponse.json({
        message: "No users scheduled for refresh today",
        users_refreshed: 0,
      });
    }

    // Refresh examples for each user
    let totalRefreshed = 0;
    const results: { userId: string; examplesUpdated: number }[] = [];

    for (const setting of settings) {
      try {
        const count = await refreshUserExamples(supabase, setting.user_id);
        results.push({ userId: setting.user_id, examplesUpdated: count });
        totalRefreshed++;
      } catch (err) {
        console.error(`[voice-refresh] Failed for user ${setting.user_id}:`, err);
      }
    }

    console.log(`[voice-refresh] Completed. Refreshed ${totalRefreshed} users.`);

    return NextResponse.json({
      message: `Refreshed ${totalRefreshed} users`,
      users_refreshed: totalRefreshed,
      results,
    });
  } catch (error) {
    console.error("[voice-refresh] Cron job failed:", error);
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
