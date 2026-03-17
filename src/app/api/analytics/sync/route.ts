import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getUserTimeline, mapV2ToPostAnalytics, getValidAccessToken } from "@/lib/x-api";
import type { PostAnalytics } from "@/types/analytics";

// POST /api/analytics/sync - User-triggered API analytics sync
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

    // Fetch up to 200 tweets via pagination
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

    // Load existing user_analytics row
    const { data: existingRow } = await supabase
      .from("user_analytics")
      .select("id, posts")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    const existingPosts: PostAnalytics[] =
      existingRow?.posts && Array.isArray(existingRow.posts)
        ? (existingRow.posts as PostAnalytics[])
        : [];

    // Build index of existing posts by post_id
    const existingByPostId = new Map<string, PostAnalytics>();
    for (const p of existingPosts) {
      existingByPostId.set(p.post_id, p);
    }

    // Merge: API data updates metrics; CSV-only fields are preserved
    let mergedCount = 0;
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
        mergedCount++;
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
      user_id: user.id,
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

    // Update last_api_sync_at on x_connections
    await supabase
      .from("x_connections")
      .update({ last_api_sync_at: new Date().toISOString() })
      .eq("user_id", user.id);

    return NextResponse.json({
      synced: allTweets.length,
      merged: mergedCount,
      total: mergedPosts.length,
    });
  } catch (error) {
    console.error("Failed to sync analytics:", error);
    const message = error instanceof Error ? error.message : "Failed to sync analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
