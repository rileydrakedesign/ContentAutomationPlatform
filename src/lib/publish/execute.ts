import { getValidAccessToken, postTweet } from "@/lib/x-api";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ScheduledPost {
  id: string;
  user_id: string;
  content_type: string;
  payload: Record<string, unknown>;
  scheduled_for: string;
  draft_id?: string | null;
}

/**
 * Publish a single scheduled post to X.
 * Shared by QStash webhook handler and cron safety-net.
 */
export async function executeScheduledPost(
  supabase: SupabaseClient,
  post: ScheduledPost
): Promise<{ success: boolean; postedIds?: string[]; error?: string }> {
  const { id, user_id: userId, content_type, payload, draft_id } = post;

  try {
    // Mark as publishing
    await supabase
      .from("scheduled_posts")
      .update({ status: "publishing", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId);

    // Get valid access token
    const { accessToken, connection } = await getValidAccessToken(supabase, userId);
    const username = connection?.x_username || null;

    // Resolve content to publish
    const tweetTexts: string[] = [];
    if (content_type === "X_THREAD") {
      const raw: string[] =
        (payload.tweets as string[]) || (payload.thread as string[]) || [];
      tweetTexts.push(...raw.map((t) => String(t || "").trim()).filter(Boolean));
    } else {
      const text = String((payload.text as string) || (payload.tweet as string) || "").trim();
      if (text) tweetTexts.push(text);
    }

    if (tweetTexts.length === 0) {
      throw new Error("Cannot publish: content is empty");
    }

    // Publish to X
    const postedIds: string[] = [];
    let previousId: string | undefined;

    for (const tweetText of tweetTexts) {
      const result = await postTweet(accessToken, tweetText, {
        inReplyToStatusId: previousId,
      });
      postedIds.push(result.id_str);
      previousId = result.id_str;
    }

    // Backfill captured_posts (matching publish/now schema)
    try {
      const rows = postedIds.map((tweetId, idx) => ({
        user_id: userId,
        x_post_id: tweetId,
        post_url: username ? `https://x.com/${username}/status/${tweetId}` : null,
        author_handle: username,
        text_content: tweetTexts[idx] || "",
        is_own_post: true,
        inbox_status: "triaged",
        triaged_as: "my_post",
        post_timestamp: new Date().toISOString(),
        metrics: {},
      }));
      await supabase.from("captured_posts").insert(rows);
    } catch (e) {
      console.warn("executeScheduledPost: failed to backfill captured_posts", e);
    }

    // Mark as posted
    await supabase
      .from("scheduled_posts")
      .update({
        status: "posted",
        posted_post_ids: postedIds,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    // Update linked draft status (best-effort) — use draft_id from DB row, not payload
    if (draft_id) {
      try {
        await supabase
          .from("drafts")
          .update({ status: "POSTED", updated_at: new Date().toISOString() })
          .eq("id", draft_id)
          .eq("user_id", userId);
      } catch (e) {
        console.warn("executeScheduledPost: failed to mark draft as POSTED", e);
      }
    }

    return { success: true, postedIds };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);

    await supabase
      .from("scheduled_posts")
      .update({
        status: "failed",
        error: errorMsg,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", userId);

    return { success: false, error: errorMsg };
  }
}
