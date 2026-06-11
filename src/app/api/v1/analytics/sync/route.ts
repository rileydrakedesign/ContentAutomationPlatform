import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getUserTimeline, getValidAccessToken } from "@/lib/x-api";
import { requireFeature } from "@/lib/stripe/gate";
import {
  CREDIT_COSTS,
  requireCredits,
  refundCredits,
  withCreditHeaders,
} from "@/lib/billing/credits";

export const OPTIONS = apiOptions;

// POST /api/v1/analytics/sync — On-demand sync of the user's own timeline into
// captured_posts. 15 credits. Pro plan required. Uses since_id deltas so
// steady-state syncs only fetch (and we only get billed for) new posts.
export const POST = withApiAuth(["analytics:read"], async ({ auth }) => {
  const featureGate = await requireFeature(auth.userId, "xApiSync");
  if (featureGate) {
    return apiError("Upgrade required — X sync requires a Pro plan", "plan_limit", 403);
  }

  let accessToken: string;
  let connection: { x_user_id: string; x_username: string };
  try {
    ({ accessToken, connection } = await getValidAccessToken(auth.userId));
  } catch {
    return apiError("X account not connected", "x_not_connected", 400);
  }

  const charge = await requireCredits(
    auth.userId,
    CREDIT_COSTS["analytics.sync"],
    "analytics.sync"
  );
  if (charge instanceof NextResponse) return charge;

  const supabase = createAdminClient();

  // Tweet IDs are snowflakes (numeric, time-ordered): the max captured ID is
  // the delta cursor.
  const { data: latest } = await supabase
    .from("captured_posts")
    .select("x_post_id")
    .eq("user_id", auth.userId)
    .eq("is_own_post", true)
    .not("x_post_id", "is", null)
    .order("x_post_id", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sinceId = latest?.x_post_id || undefined;

  let tweets;
  try {
    ({ data: tweets } = await getUserTimeline(
      accessToken,
      connection.x_user_id,
      100,
      undefined,
      sinceId
    ));
  } catch (e) {
    await refundCredits(auth.userId, charge.charged, "refund.sync_failed");
    return apiError(
      e instanceof Error ? e.message : "X sync failed",
      "x_api_error",
      502
    );
  }

  // since_id already excludes known posts, but guard against overlap anyway.
  const { data: existingPosts } = await supabase
    .from("captured_posts")
    .select("x_post_id")
    .eq("user_id", auth.userId)
    .in("x_post_id", tweets.map((t) => t.id));
  const existingIds = new Set(existingPosts?.map((p) => p.x_post_id) || []);
  const newTweets = tweets.filter((t) => !existingIds.has(t.id));

  if (newTweets.length > 0) {
    const { error: insertError } = await supabase.from("captured_posts").insert(
      newTweets.map((tweet) => ({
        user_id: auth.userId,
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
          views:
            tweet.organic_metrics?.impression_count ??
            tweet.public_metrics?.impression_count ??
            0,
        },
        post_timestamp: tweet.created_at || new Date().toISOString(),
        inbox_status: "triaged",
        triaged_as: "my_post",
      }))
    );
    if (insertError) {
      console.error("v1 analytics sync: insert failed", insertError);
      return apiError("Failed to store synced posts", "internal_error", 500);
    }
  }

  await supabase
    .from("x_connections")
    .update({
      last_api_sync_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", auth.userId);

  return withCreditHeaders(
    apiSuccess({
      synced: newTweets.length,
      fetched: tweets.length,
      since_id: sinceId ?? null,
    }),
    charge
  );
});
