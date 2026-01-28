import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

// CORS headers for Chrome extension
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle preflight OPTIONS request
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

interface AnalyticsPost {
  post_url: string;
  text_content: string;
  author_handle: string;
  metrics: {
    likes?: number;
    retweets?: number;
    replies?: number;
    quotes?: number;
    views?: number;
    impressions?: number;
  };
  post_timestamp?: string;
  x_post_id?: string;
  parent_post?: {
    text?: string;
    author?: string;
  } | null;
}

interface AnalyticsPayload {
  posts: AnalyticsPost[];
  replies: AnalyticsPost[];
}

// POST /api/x/analytics-sync - Sync top posts and replies from browser scraping
export async function POST(request: Request) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const payload: AnalyticsPayload = await request.json();

    if (!payload.posts && !payload.replies) {
      return NextResponse.json(
        { error: "No posts or replies provided" },
        { status: 400, headers: corsHeaders }
      );
    }

    const { posts = [], replies = [] } = payload;

    // Get existing post IDs to avoid duplicates
    const allPostIds = [
      ...posts.map(p => p.x_post_id).filter(Boolean),
      ...replies.map(p => p.x_post_id).filter(Boolean),
    ];

    const { data: existingPosts } = await supabase
      .from("captured_posts")
      .select("x_post_id")
      .eq("user_id", user.id)
      .in("x_post_id", allPostIds);

    const existingIds = new Set(existingPosts?.map(p => p.x_post_id) || []);

    // Process regular posts
    const newPosts = posts.filter(p => p.x_post_id && !existingIds.has(p.x_post_id));
    const postsToInsert = newPosts.map(post => ({
      user_id: user.id,
      x_post_id: post.x_post_id,
      post_url: post.post_url,
      author_handle: post.author_handle,
      text_content: post.text_content,
      is_own_post: true,
      metrics: {
        likes: post.metrics.likes || 0,
        retweets: post.metrics.retweets || 0,
        replies: post.metrics.replies || 0,
        quotes: post.metrics.quotes || 0,
        impressions: post.metrics.impressions || post.metrics.views || 0,
      },
      post_timestamp: post.post_timestamp ? new Date(post.post_timestamp).toISOString() : null,
      inbox_status: "triaged",
      triaged_as: "my_post",
    }));

    // Process replies
    const newReplies = replies.filter(r => r.x_post_id && !existingIds.has(r.x_post_id));
    const repliesToInsert = newReplies.map(reply => ({
      user_id: user.id,
      x_post_id: reply.x_post_id,
      post_url: reply.post_url,
      author_handle: reply.author_handle,
      text_content: reply.text_content,
      is_own_post: true,
      metrics: {
        likes: reply.metrics.likes || 0,
        retweets: reply.metrics.retweets || 0,
        replies: reply.metrics.replies || 0,
        quotes: reply.metrics.quotes || 0,
        impressions: reply.metrics.impressions || reply.metrics.views || 0,
        is_reply: true,
        parent_author: reply.parent_post?.author || null,
        parent_text: reply.parent_post?.text || null,
      },
      post_timestamp: reply.post_timestamp ? new Date(reply.post_timestamp).toISOString() : null,
      inbox_status: "triaged",
      triaged_as: "my_post",
    }));

    // Insert all new posts
    const allInserts = [...postsToInsert, ...repliesToInsert];

    if (allInserts.length > 0) {
      const { error: insertError } = await supabase
        .from("captured_posts")
        .insert(allInserts);

      if (insertError) {
        console.error("Failed to insert analytics posts:", insertError);
        throw insertError;
      }
    }

    // Update existing posts with new impression data
    const existingToUpdate = [
      ...posts.filter(p => p.x_post_id && existingIds.has(p.x_post_id)),
      ...replies.filter(r => r.x_post_id && existingIds.has(r.x_post_id)),
    ];

    for (const post of existingToUpdate) {
      if (post.metrics.impressions || post.metrics.views) {
        await supabase
          .from("captured_posts")
          .update({
            metrics: {
              impressions: post.metrics.impressions || post.metrics.views || 0,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("x_post_id", post.x_post_id)
          .eq("user_id", user.id);
      }
    }

    return NextResponse.json({
      success: true,
      inserted: {
        posts: postsToInsert.length,
        replies: repliesToInsert.length,
      },
      updated: existingToUpdate.length,
      message: `Synced ${postsToInsert.length} posts and ${repliesToInsert.length} replies`,
    }, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to sync analytics:", error);
    return NextResponse.json(
      { error: "Failed to sync analytics data" },
      { status: 500, headers: corsHeaders }
    );
  }
}
