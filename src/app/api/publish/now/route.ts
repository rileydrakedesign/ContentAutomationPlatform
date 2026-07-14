import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { postTweet, getValidAccessToken } from "@/lib/x-api";
import { parseAttachedMedia, resolveMediaIdsForPublish } from "@/lib/x-api/media";
import { pollForPublish } from "@/lib/x-api/poll";

type ContentType = "X_POST" | "X_THREAD";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { accessToken, connection } = await getValidAccessToken(user.id);

    const body = await request.json();
    const contentType: ContentType = body?.contentType;
    const payload = body?.payload;
    const draftId = body?.draftId ? String(body.draftId) : null;

    if (!contentType || !["X_POST", "X_THREAD"].includes(contentType)) {
      return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
    }

    // Publish
    if (contentType === "X_POST") {
      const text = String(payload?.text || "").trim();
      if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

      // A poll and media are mutually exclusive on X — a poll suppresses media.
      const poll = pollForPublish(payload?.poll);
      const media = poll ? [] : parseAttachedMedia(payload?.media);
      const mediaIds = media.length
        ? await resolveMediaIdsForPublish(supabase, accessToken, media, { forceReupload: false })
        : [];

      const replySettings =
        payload?.replySettings === "mentionedUsers" || payload?.replySettings === "following"
          ? payload.replySettings
          : undefined;

      const posted = await postTweet(
        accessToken,
        text,
        mediaIds.length || replySettings || poll
          ? {
              mediaIds: mediaIds.length ? mediaIds : undefined,
              replySettings,
              poll: poll
                ? { options: poll.options, durationMinutes: poll.duration_minutes }
                : undefined,
            }
          : undefined
      );

      // Backfill captured_posts
      try {
        const username = connection.x_username || null;
        await supabase.from("captured_posts").insert({
          user_id: user.id,
          x_post_id: posted.id_str,
          post_url: username ? `https://x.com/${username}/status/${posted.id_str}` : null,
          author_handle: username,
          text_content: text,
          is_own_post: true,
          inbox_status: "triaged",
          triaged_as: "my_post",
          post_timestamp: new Date().toISOString(),
          metrics: {},
          afx_assisted: true,
        });
      } catch (e) {
        console.warn("publish now: failed to backfill captured_posts", e);
      }

      // Mark draft as POSTED (best-effort)
      if (draftId) {
        try {
          await supabase
            .from("drafts")
            .update({ status: "POSTED", updated_at: new Date().toISOString() })
            .eq("id", draftId)
            .eq("user_id", user.id);
        } catch (e) {
          console.warn("publish now: failed to mark draft as POSTED", e);
        }
      }

      return NextResponse.json({ success: true, postedIds: [posted.id_str] });
    }

    const tweets: string[] = Array.isArray(payload?.tweets)
      ? payload.tweets
      : Array.isArray(payload?.posts)
        ? payload.posts
        : [];
    const cleaned = tweets.map((t) => String(t || "").trim()).filter(Boolean);
    if (cleaned.length === 0) {
      return NextResponse.json({ error: "Missing tweets" }, { status: 400 });
    }

    const postedIds: string[] = [];
    let publishError: string | null = null;

    // Post the thread; on mid-thread failure, keep the posted prefix so we
    // can report it — a blind full retry would double-post those tweets.
    try {
      let replyTo: string | undefined;
      for (let i = 0; i < cleaned.length; i++) {
        const next = await postTweet(accessToken, cleaned[i], {
          inReplyToStatusId: replyTo,
        });
        postedIds.push(next.id_str);
        replyTo = next.id_str;
      }
    } catch (err) {
      publishError = err instanceof Error ? err.message : "Failed to publish";
      if (postedIds.length === 0) throw err;
    }

    // Backfill captured_posts (one row per tweet posted, even on partial failure)
    try {
      const username = connection.x_username || null;
      const rows = postedIds.map((id, idx) => ({
        user_id: user.id,
        x_post_id: id,
        post_url: username ? `https://x.com/${username}/status/${id}` : null,
        author_handle: username,
        text_content: cleaned[idx] || "",
        is_own_post: true,
        inbox_status: "triaged",
        triaged_as: "my_post",
        post_timestamp: new Date().toISOString(),
        metrics: {},
        afx_assisted: true,
      }));
      await supabase.from("captured_posts").insert(rows);
    } catch (e) {
      console.warn("publish now: failed to backfill captured_posts (thread)", e);
    }

    if (publishError) {
      return NextResponse.json(
        {
          error: `Thread partially posted: ${postedIds.length}/${cleaned.length} tweets went out before failing (${publishError}). Do not retry the full thread — the remaining tweets are returned for resuming.`,
          postedIds,
          failedAtIndex: postedIds.length,
          remainingTweets: cleaned.slice(postedIds.length),
        },
        { status: 500 }
      );
    }

    // Mark draft as POSTED (best-effort)
    if (draftId) {
      try {
        await supabase
          .from("drafts")
          .update({ status: "POSTED", updated_at: new Date().toISOString() })
          .eq("id", draftId)
          .eq("user_id", user.id);
      } catch (e) {
        console.warn("publish now: failed to mark draft as POSTED", e);
      }
    }

    return NextResponse.json({ success: true, postedIds });
  } catch (error) {
    console.error("Failed to publish now:", error);
    Sentry.captureException(error, { tags: { route: "publish/now" } });
    const message = error instanceof Error ? error.message : "Failed to publish";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
