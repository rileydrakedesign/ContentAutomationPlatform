import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getUserTimeline } from "@/lib/x-api";

// POST /api/x/sync - Sync user's tweets from X
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

    // Get X connection
    const { data: connection } = await supabase
      .from("x_connections")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (!connection) {
      return NextResponse.json(
        { error: "X account not connected" },
        { status: 400 }
      );
    }

    // Fetch user's tweets
    const tweets = await getUserTimeline(
      connection.access_token,
      connection.access_token_secret,
      50
    );

    // Get existing tweet IDs to avoid duplicates
    const { data: existingPosts } = await supabase
      .from("captured_posts")
      .select("x_post_id")
      .eq("user_id", user.id)
      .not("x_post_id", "is", null);

    const existingIds = new Set(existingPosts?.map((p) => p.x_post_id) || []);

    // Filter out existing tweets
    const newTweets = tweets.filter((t) => !existingIds.has(t.id_str));

    // Insert new tweets as captured posts
    if (newTweets.length > 0) {
      const postsToInsert = newTweets.map((tweet) => ({
        user_id: user.id,
        x_post_id: tweet.id_str,
        post_url: `https://x.com/${connection.x_username}/status/${tweet.id_str}`,
        author_handle: connection.x_username,
        author_name: tweet.user?.name || null,
        text_content: tweet.full_text || tweet.text,
        is_own_post: true,
        metrics: {
          likes: tweet.favorite_count || 0,
          retweets: tweet.retweet_count || 0,
          replies: tweet.reply_count || 0,
          quotes: tweet.quote_count || 0,
        },
        post_timestamp: new Date(tweet.created_at).toISOString(),
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
