import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { NextResponse } from "next/server";
import { getValidAccessToken, getTweet, extractTweetId } from "@/lib/x-api";
import {
  CREDIT_COSTS,
  requireCredits,
  refundCredits,
  withCreditHeaders,
} from "@/lib/billing/credits";

export const OPTIONS = apiOptions;

// GET /api/v1/tweets/:id — Fetch a single tweet's text + metrics.
// `id` may be a raw tweet ID or a full x.com/twitter.com status URL.
// Useful for pulling the post being replied to as context for reply generation.
export const GET = withApiAuth(["analytics:read"], async ({ auth, params }) => {
  const raw = params?.id ? decodeURIComponent(params.id) : "";
  const tweetId = /^\d+$/.test(raw) ? raw : extractTweetId(raw);

  if (!tweetId) {
    return apiError("Invalid tweet id or URL", "validation_error", 400);
  }

  let accessToken: string;
  try {
    ({ accessToken } = await getValidAccessToken(auth.userId));
  } catch {
    return apiError("X account not connected", "x_not_connected", 400);
  }

  // Each read is a billed X API call ($0.005) — debit before, refund on failure.
  const charge = await requireCredits(
    auth.userId,
    CREDIT_COSTS["tweets.read"],
    "tweets.read",
    tweetId
  );
  if (charge instanceof NextResponse) return charge;

  try {
    const tweet = await getTweet(accessToken, tweetId);
    return withCreditHeaders(
      apiSuccess({
        id: tweet.id,
        text: tweet.text,
        created_at: tweet.created_at ?? null,
        metrics: tweet.public_metrics ?? null,
      }),
      charge
    );
  } catch (e) {
    await refundCredits(auth.userId, charge.charged, "refund.tweet_read_failed", tweetId);
    return apiError(
      e instanceof Error ? e.message : "Failed to fetch tweet",
      "x_api_error",
      502
    );
  }
});
