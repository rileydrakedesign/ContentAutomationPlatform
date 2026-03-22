import { getValidAccessToken, postTweet } from "@/lib/x-api";
import type { SupabaseClient } from "@supabase/supabase-js";

interface ScheduledPost {
  id: string;
  user_id: string;
  content_type: string;
  payload: Record<string, unknown>;
  scheduled_for: string;
}

/**
 * Publish a single scheduled post to X.
 * Shared by QStash webhook handler and cron safety-net.
 */
export async function executeScheduledPost(
  supabase: SupabaseClient,
  post: ScheduledPost
): Promise<{ success: boolean; postedIds?: string[]; error?: string }> {
  const { id, user_id: userId, content_type, payload } = post;

  try {
    // Mark as publishing
    await supabase
      .from("scheduled_posts")
      .update({ status: "publishing", updated_at: new Date().toISOString() })
      .eq("id", id);

    // Get valid access token
    const { accessToken } = await getValidAccessToken(supabase, userId);

    const postedIds: string[] = [];

    if (content_type === "X_THREAD") {
      const tweets: string[] =
        (payload.tweets as string[]) || (payload.thread as string[]) || [];
      let previousId: string | undefined;

      for (const tweetText of tweets) {
        const result = await postTweet(accessToken, tweetText, {
          inReplyToStatusId: previousId,
        });
        postedIds.push(result.id_str);
        previousId = result.id_str;
      }
    } else {
      const text = (payload.text as string) || (payload.tweet as string) || "";
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
            content_type === "X_THREAD"
              ? ((payload.tweets as string[]) || (payload.thread as string[]))?.[
                  postedIds.indexOf(tweetId)
                ] || ""
              : (payload.text as string) || (payload.tweet as string) || "",
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
      .eq("id", id);

    // Update linked draft status (best-effort)
    if (payload.draftId) {
      await supabase
        .from("drafts")
        .update({ status: "POSTED", updated_at: new Date().toISOString() })
        .eq("id", payload.draftId as string)
        .eq("user_id", userId)
        .then(() => {});
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
      .eq("id", id);

    return { success: false, error: errorMsg };
  }
}
