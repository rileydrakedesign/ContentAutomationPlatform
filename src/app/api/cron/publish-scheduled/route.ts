import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getValidAccessToken, postTweet } from "@/lib/x-api";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/publish-scheduled - Publish posts that are due
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

    // Find all posts due for publishing
    const { data: duePosts, error: queryError } = await supabase
      .from("scheduled_posts")
      .select("id, user_id, content_type, payload, scheduled_for")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true });

    if (queryError) throw queryError;
    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({ published: 0, failed: 0 });
    }

    // Group by user to process sequentially per user (rate limit safety)
    const byUser = new Map<string, typeof duePosts>();
    for (const post of duePosts) {
      const existing = byUser.get(post.user_id) || [];
      existing.push(post);
      byUser.set(post.user_id, existing);
    }

    let published = 0;
    let failed = 0;

    for (const [userId, posts] of byUser) {
      let accessToken: string;
      try {
        const tokenResult = await getValidAccessToken(supabase, userId);
        accessToken = tokenResult.accessToken;
      } catch (err) {
        // Mark all this user's posts as failed
        for (const post of posts) {
          await supabase
            .from("scheduled_posts")
            .update({
              status: "failed",
              error: `Token error: ${err instanceof Error ? err.message : String(err)}`,
              updated_at: new Date().toISOString(),
            })
            .eq("id", post.id);
          failed++;
        }
        continue;
      }

      for (const post of posts) {
        try {
          // Mark as publishing
          await supabase
            .from("scheduled_posts")
            .update({ status: "publishing", updated_at: new Date().toISOString() })
            .eq("id", post.id);

          const postedIds: string[] = [];

          if (post.content_type === "X_THREAD") {
            // Thread: post each tweet in sequence as replies
            const tweets: string[] = post.payload.tweets || post.payload.thread || [];
            let previousId: string | undefined;

            for (const tweetText of tweets) {
              const result = await postTweet(accessToken, tweetText, {
                inReplyToStatusId: previousId,
              });
              postedIds.push(result.id_str);
              previousId = result.id_str;
            }
          } else {
            // Single post
            const text = post.payload.text || post.payload.tweet || "";
            const result = await postTweet(accessToken, text);
            postedIds.push(result.id_str);
          }

          // Backfill captured_posts
          for (const tweetId of postedIds) {
            await supabase.from("captured_posts").upsert(
              {
                user_id: userId,
                post_id: tweetId,
                platform: "x",
                posted_at: new Date().toISOString(),
                text:
                  post.content_type === "X_THREAD"
                    ? (post.payload.tweets || post.payload.thread)?.[postedIds.indexOf(tweetId)] || ""
                    : post.payload.text || post.payload.tweet || "",
              },
              { onConflict: "post_id" }
            );
          }

          // Mark as posted
          await supabase
            .from("scheduled_posts")
            .update({
              status: "posted",
              posted_post_ids: postedIds,
              updated_at: new Date().toISOString(),
            })
            .eq("id", post.id);

          // Update linked draft status (best-effort)
          if (post.payload.draftId) {
            await supabase
              .from("drafts")
              .update({ status: "POSTED", updated_at: new Date().toISOString() })
              .eq("id", post.payload.draftId)
              .eq("user_id", userId)
              .then(() => {});
          }

          published++;
        } catch (err) {
          await supabase
            .from("scheduled_posts")
            .update({
              status: "failed",
              error: err instanceof Error ? err.message : String(err),
              updated_at: new Date().toISOString(),
            })
            .eq("id", post.id);
          failed++;
        }
      }
    }

    return NextResponse.json({ published, failed, total: duePosts.length });
  } catch (error) {
    console.error("Cron publish-scheduled error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
