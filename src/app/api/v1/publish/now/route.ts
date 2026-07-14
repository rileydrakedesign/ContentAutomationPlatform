import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import * as Sentry from "@sentry/nextjs";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { postTweet, getValidAccessToken } from "@/lib/x-api";
import {
  publishCreditCost,
  containsUrl,
  requireCredits,
  refundCredits,
  checkDailyActionCap,
  withCreditHeaders,
} from "@/lib/billing/credits";

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

  // C1 audit (2026-07) — CLOSED: deprecated. The Feb-2026 X rules put
  // programmatic replies in the enforcement blast radius, so the handoff (web
  // intent → extension assist → copy) is the only sanctioned reply route.
  // X_REPLY is still *recognized* so existing callers get a purposeful 410
  // rather than a confusing validation error. Returns before the token lookup,
  // the daily cap, and the credit debit — a deprecated call must never charge.
  // Do not re-add an API reply path (PRODUCT_SLIM_2026-07 §4 Tier 2).
  if (contentType === "X_REPLY") {
    return apiError(
      "Reply publishing via the API is deprecated. Replies must go through the handoff flow.",
      "deprecated",
      410,
      {
        handoff:
          "Call find_reply_posts (GET /api/v1/search/reply-targets), then open the target's intent_url with `&text=<url-encoded reply>` appended.",
      }
    );
  }

  if (!contentType || !["X_POST", "X_THREAD"].includes(contentType)) {
    return apiError("contentType must be X_POST or X_THREAD", "validation_error", 400);
  }

  if (!payload || typeof payload !== "object") {
    return apiError("Missing payload", "validation_error", 400);
  }

  // Get valid X access token for the user. A stale/expired connection throws
  // here — surface it as a clear x_not_connected rather than a generic 500.
  let accessToken: string;
  let connection: { x_user_id: string; x_username: string };
  try {
    ({ accessToken, connection } = await getValidAccessToken(auth.userId));
  } catch (e) {
    return apiError(
      `X account not connected or token expired — reconnect X. (${e instanceof Error ? e.message : "unknown"})`,
      "x_not_connected",
      400
    );
  }

  // Daily publish cap — abuse backstop on top of credits.
  const cap = await checkDailyActionCap(auth.userId, "publish");
  if (!cap.allowed) {
    return apiError(
      `Daily API publish cap reached (${cap.used}/${cap.limit})`,
      "daily_cap",
      429,
      { used: cap.used, limit: cap.limit }
    );
  }

  if (contentType === "X_POST") {
    const text = String(payload.text || "").trim();
    if (!text) {
      return apiError("Missing text in payload", "validation_error", 400);
    }

    // Debit before the X call; refund below if X rejects it.
    const action = containsUrl(text) ? "publish.tweet_with_url" : "publish.tweet";
    const charge = await requireCredits(
      auth.userId,
      publishCreditCost([text]),
      action,
      draftId
    );
    if (charge instanceof NextResponse) return charge;

    let posted: { id_str: string };
    try {
      posted = await postTweet(accessToken, text);
    } catch (e) {
      const detail = e instanceof Error ? e.message : "unknown error";
      // Log server-side: the MCP client may swallow or truncate this, and
      // X's error body is the only way to diagnose write failures.
      console.error(
        `v1 publish now: X rejected post for user ${auth.userId}: ${detail}`
      );
      Sentry.captureException(e, { tags: { route: "v1/publish/now" } });
      await refundCredits(auth.userId, charge.charged, "refund.publish_failed", draftId);
      return apiError(`X rejected the post: ${detail}`, "x_api_error", 502);
    }

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
        afx_assisted: true,
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

    return withCreditHeaders(
      apiSuccess({ posted: true, postedIds: [posted.id_str] }),
      charge
    );
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

  // Debit the whole thread up front; un-posted tweets are refunded on failure.
  const charge = await requireCredits(
    auth.userId,
    publishCreditCost(cleaned),
    "publish.thread",
    draftId
  );
  if (charge instanceof NextResponse) return charge;

  const postedIds: string[] = [];
  let publishError: string | null = null;

  // Post the thread; on mid-thread failure keep the posted prefix so the
  // error can report it — a blind full retry would double-post those tweets.
  try {
    let replyTo: string | undefined;
    for (let i = 0; i < cleaned.length; i++) {
      const next = await postTweet(accessToken, cleaned[i], replyTo ? { inReplyToStatusId: replyTo } : undefined);
      postedIds.push(next.id_str);
      replyTo = next.id_str;
    }
  } catch (e) {
    publishError = e instanceof Error ? e.message : "unknown error";
    console.error(
      `v1 publish now: X rejected thread for user ${auth.userId} at tweet ${postedIds.length + 1}: ${publishError}`
    );
    Sentry.captureException(e, { tags: { route: "v1/publish/now" } });
    // Refund the un-posted remainder — the posted prefix did cost us X writes.
    const refund = publishCreditCost(cleaned.slice(postedIds.length));
    await refundCredits(auth.userId, refund, "refund.thread_partial", draftId);
    if (postedIds.length === 0) {
      return apiError(`X rejected the thread: ${publishError}`, "x_api_error", 502);
    }
  }

  // Backfill every tweet that actually posted, even on partial failure
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
      afx_assisted: true,
    }));
    await supabase.from("captured_posts").insert(rows);
  } catch (e) {
    console.warn("v1 publish now: thread backfill failed", e);
  }

  if (publishError) {
    return apiError(
      `Thread partially posted: ${postedIds.length} of ${cleaned.length} tweets went out before failing (${publishError}). Do NOT retry the full thread — resume with remainingTweets only.`,
      "x_partial_thread",
      502,
      {
        postedIds,
        failedAtIndex: postedIds.length,
        remainingTweets: cleaned.slice(postedIds.length),
      }
    );
  }

  if (draftId) {
    await supabase
      .from("drafts")
      .update({ status: "POSTED", updated_at: new Date().toISOString() })
      .eq("id", draftId)
      .eq("user_id", auth.userId);
  }

  return withCreditHeaders(apiSuccess({ posted: true, postedIds }), charge);
});
