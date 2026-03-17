import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTweetsBatch, getValidAccessToken } from "@/lib/x-api";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/metrics-refresh - Batch refresh engagement metrics on captured posts
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
      .not("access_token", "is", null);

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: "No connections", updated: 0 });
    }

    let totalUpdated = 0;

    for (const conn of connections) {
      try {
        const { accessToken } = await getValidAccessToken(supabase, conn.user_id);

        // Get captured posts with x_post_id, oldest-updated first
        const { data: posts } = await supabase
          .from("captured_posts")
          .select("id, x_post_id")
          .eq("user_id", conn.user_id)
          .not("x_post_id", "is", null)
          .order("updated_at", { ascending: true })
          .limit(200);

        if (!posts || posts.length === 0) continue;

        // Batch IDs into groups of 100
        const ids = posts.map((p) => p.x_post_id).filter(Boolean);
        const batches: string[][] = [];
        for (let i = 0; i < ids.length; i += 100) {
          batches.push(ids.slice(i, i + 100));
        }

        // Build a map of x_post_id -> fresh metrics
        const metricsMap = new Map<string, Record<string, number>>();

        for (const batch of batches) {
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

        // Update each post with fresh metrics
        for (const post of posts) {
          const freshMetrics = metricsMap.get(post.x_post_id);
          if (!freshMetrics) continue;

          await supabase
            .from("captured_posts")
            .update({
              metrics: freshMetrics,
              updated_at: new Date().toISOString(),
            })
            .eq("id", post.id);

          totalUpdated++;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[metrics-refresh] Failed for user ${conn.user_id}:`, msg);
      }
    }

    return NextResponse.json({ updated: totalUpdated });
  } catch (error) {
    console.error("[metrics-refresh] Cron failed:", error);
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
