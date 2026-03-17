import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getUserTimeline, mapV2ToPostAnalytics, getValidAccessToken } from "@/lib/x-api";
import type { PostAnalytics } from "@/types/analytics";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/analytics-sync - Automated analytics sync for all users
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all users with X connections
    const { data: connections, error: connError } = await supabase
      .from("x_connections")
      .select("user_id")
      .not("access_token", "is", null)
      .not("x_user_id", "is", null);

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: "No connections to sync", synced: 0 });
    }

    const results: Array<{ userId: string; synced: number; error?: string }> = [];

    // Process users sequentially to respect rate limits
    for (const conn of connections) {
      try {
        const { accessToken, connection } = await getValidAccessToken(supabase, conn.user_id);

        // Fetch up to 200 tweets
        const allTweets: PostAnalytics[] = [];
        let paginationToken: string | undefined;

        for (let page = 0; page < 2; page++) {
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

        // Load existing user_analytics
        const { data: existingRow } = await supabase
          .from("user_analytics")
          .select("id, posts")
          .eq("user_id", conn.user_id)
          .order("uploaded_at", { ascending: false })
          .limit(1)
          .single();

        const existingPosts: PostAnalytics[] =
          existingRow?.posts && Array.isArray(existingRow.posts)
            ? (existingRow.posts as PostAnalytics[])
            : [];

        const existingByPostId = new Map<string, PostAnalytics>();
        for (const p of existingPosts) {
          existingByPostId.set(p.post_id, p);
        }

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
          } else {
            existingByPostId.set(apiPost.post_id, apiPost);
          }
        }

        const mergedPosts = Array.from(existingByPostId.values());
        const nonReplyPosts = mergedPosts.filter((p) => !p.is_reply);

        mergedPosts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        const dates = mergedPosts.map((p) => new Date(p.date).getTime()).filter((t) => !isNaN(t));
        const dateRange = dates.length > 0
          ? {
              start: new Date(Math.min(...dates)).toISOString().split("T")[0],
              end: new Date(Math.max(...dates)).toISOString().split("T")[0],
            }
          : { start: "", end: "" };

        const upsertData = {
          user_id: conn.user_id,
          posts: mergedPosts,
          total_posts: nonReplyPosts.length,
          total_replies: mergedPosts.length - nonReplyPosts.length,
          date_range: dateRange,
          uploaded_at: new Date().toISOString(),
        };

        if (existingRow?.id) {
          await supabase
            .from("user_analytics")
            .update(upsertData)
            .eq("id", existingRow.id);
        } else {
          await supabase.from("user_analytics").insert(upsertData);
        }

        // Update last_api_sync_at
        await supabase
          .from("x_connections")
          .update({ last_api_sync_at: new Date().toISOString() })
          .eq("user_id", conn.user_id);

        results.push({ userId: conn.user_id, synced: allTweets.length });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[analytics-sync] Failed for user ${conn.user_id}:`, msg);
        results.push({ userId: conn.user_id, synced: 0, error: msg });
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("[analytics-sync] Cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
