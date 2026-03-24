import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";
import { postTweet, getValidAccessToken } from "@/lib/x-api";

export const OPTIONS = apiOptions;

// POST /api/v1/publish/now — Publish immediately to X
export const POST = withApiAuth(["publish:write"], async ({ auth, request }) => {
  const supabase = createAdminClient();

  let body: { contentType?: string; payload?: Record<string, unknown>; draftId?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const { contentType, payload, draftId } = body;

  if (!contentType || !["X_POST", "X_THREAD"].includes(contentType)) {
    return apiError("contentType must be X_POST or X_THREAD", "validation_error", 400);
  }

  if (!payload || typeof payload !== "object") {
    return apiError("Missing payload", "validation_error", 400);
  }

  // Get valid X access token for the user
  const { accessToken, connection } = await getValidAccessToken(supabase, auth.userId);

  if (contentType === "X_POST") {
    const text = String(payload.text || "").trim();
    if (!text) {
      return apiError("Missing text in payload", "validation_error", 400);
    }

    const posted = await postTweet(accessToken, text);

    // Backfill captured_posts
    try {
      const username = connection.x_username || null;
      await supabase.from("captured_posts").insert({
        user_id: auth.userId,
        x_post_id: posted.id_str,
        post_url: username ? `https://x.com/${username}/status/${posted.id_str}` : null,
        author_handle: username,
        text_content: text,
        is_own_post: true,
        inbox_status: "triaged",
        triaged_as: "my_post",
        post_timestamp: new Date().toISOString(),
        metrics: {},
      });
    } catch (e) {
      console.warn("v1 publish now: backfill failed", e);
    }

    // Mark draft as POSTED
    if (draftId) {
      await supabase
        .from("drafts")
        .update({ status: "POSTED", updated_at: new Date().toISOString() })
        .eq("id", draftId)
        .eq("user_id", auth.userId);
    }

    return apiSuccess({ posted: true, postedIds: [posted.id_str] });
  }

  // Thread
  const tweets: string[] = Array.isArray(payload.tweets)
    ? payload.tweets as string[]
    : Array.isArray(payload.posts)
      ? payload.posts as string[]
      : [];
  const cleaned = tweets.map((t) => String(t || "").trim()).filter(Boolean);
  if (cleaned.length === 0) {
    return apiError("Missing tweets in payload", "validation_error", 400);
  }

  const postedIds: string[] = [];
  const first = await postTweet(accessToken, cleaned[0]);
  postedIds.push(first.id_str);

  let replyTo = first.id_str;
  for (let i = 1; i < cleaned.length; i++) {
    const next = await postTweet(accessToken, cleaned[i], { inReplyToStatusId: replyTo });
    postedIds.push(next.id_str);
    replyTo = next.id_str;
  }

  // Backfill
  try {
    const username = connection.x_username || null;
    const rows = postedIds.map((id, idx) => ({
      user_id: auth.userId,
      x_post_id: id,
      post_url: username ? `https://x.com/${username}/status/${id}` : null,
      author_handle: username,
      text_content: cleaned[idx] || "",
      is_own_post: true,
      inbox_status: "triaged",
      triaged_as: "my_post",
      post_timestamp: new Date().toISOString(),
      metrics: {},
    }));
    await supabase.from("captured_posts").insert(rows);
  } catch (e) {
    console.warn("v1 publish now: thread backfill failed", e);
  }

  if (draftId) {
    await supabase
      .from("drafts")
      .update({ status: "POSTED", updated_at: new Date().toISOString() })
      .eq("id", draftId)
      .eq("user_id", auth.userId);
  }

  return apiSuccess({ posted: true, postedIds });
});
