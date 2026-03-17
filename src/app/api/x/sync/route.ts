import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getUserTimeline, getValidAccessToken } from "@/lib/x-api";

// POST /api/x/sync - Sync user's tweets from X (v2 API)
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

    const { accessToken, connection } = await getValidAccessToken(supabase, user.id);

    // Fetch user's tweets via v2 API
    const { data: tweets } = await getUserTimeline(
      accessToken,
      connection.x_user_id,
      100
    );

    // Get existing tweet IDs to avoid duplicates
    const { data: existingPosts } = await supabase
      .from("captured_posts")
      .select("x_post_id")
      .eq("user_id", user.id)
      .not("x_post_id", "is", null);

    const existingIds = new Set(existingPosts?.map((p) => p.x_post_id) || []);

    // Filter out existing tweets
    const newTweets = tweets.filter((t) => !existingIds.has(t.id));

    // Insert new tweets as captured posts
    if (newTweets.length > 0) {
      const postsToInsert = newTweets.map((tweet) => ({
        user_id: user.id,
        x_post_id: tweet.id,
        post_url: `https://x.com/${connection.x_username}/status/${tweet.id}`,
        author_handle: connection.x_username,
        text_content: tweet.text,
        is_own_post: true,
        metrics: {
          likes: tweet.public_metrics?.like_count || 0,
          retweets: tweet.public_metrics?.retweet_count || 0,
          replies: tweet.public_metrics?.reply_count || 0,
          quotes: tweet.public_metrics?.quote_count || 0,
          views: tweet.organic_metrics?.impression_count ?? tweet.public_metrics?.impression_count ?? 0,
        },
        post_timestamp: tweet.created_at || new Date().toISOString(),
        inbox_status: "triaged",
        triaged_as: "my_post",
      }));

      const { error: insertError } = await supabase
        .from("captured_posts")
        .insert(postsToInsert);

      if (insertError) {
        console.error("Failed to insert posts:", insertError);
        throw insertError;
      }
    }

    // Update last sync time
    await supabase
      .from("x_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);

    return NextResponse.json({
      synced: newTweets.length,
      total: tweets.length,
      message: `Synced ${newTweets.length} new posts`,
    });
  } catch (error) {
    console.error("Failed to sync X posts:", error);
    return NextResponse.json(
      { error: "Failed to sync posts" },
      { status: 500 }
    );
  }
}
