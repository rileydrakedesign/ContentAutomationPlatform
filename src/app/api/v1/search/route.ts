import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { NextResponse } from "next/server";
import { searchRecentTweets, getValidAccessToken } from "@/lib/x-api";
import { requireFeature } from "@/lib/stripe/gate";
import {
  CREDIT_COSTS,
  requireCredits,
  refundCredits,
  withCreditHeaders,
} from "@/lib/billing/credits";

export const OPTIONS = apiOptions;

// X bills search per post returned, so cap the page size hard.
const MIN_RESULTS = 10; // X API minimum for max_results
const MAX_RESULTS = 25;
const MIN_CHARGE = 5;

// GET /api/v1/search?query=&max_results= — Search recent tweets (last 7 days).
// 1 credit per result returned (minimum 5). Pro plan required.
export const GET = withApiAuth(["search:read"], async ({ auth, request }) => {
  const featureGate = await requireFeature(auth.userId, "xApiSync");
  if (featureGate) {
    return apiError("Upgrade required — search requires a Pro plan", "plan_limit", 403);
  }

  const url = new URL(request.url);
  const query = String(url.searchParams.get("query") || "").trim();
  if (!query) {
    return apiError("Missing query parameter", "validation_error", 400);
  }

  const maxResults = Math.max(
    MIN_RESULTS,
    Math.min(MAX_RESULTS, Number(url.searchParams.get("max_results")) || MIN_RESULTS)
  );

  let accessToken: string;
  try {
    ({ accessToken } = await getValidAccessToken(auth.userId));
  } catch {
    return apiError("X account not connected", "x_not_connected", 400);
  }

  // Debit the worst case up front, refund the difference once we know how
  // many posts actually came back (X bills per post returned).
  const maxCharge = maxResults * CREDIT_COSTS["search.per_post"];
  const charge = await requireCredits(auth.userId, maxCharge, "search.per_post");
  if (charge instanceof NextResponse) return charge;

  let result: Awaited<ReturnType<typeof searchRecentTweets>>;
  try {
    result = await searchRecentTweets(accessToken, query, maxResults);
  } catch (e) {
    await refundCredits(auth.userId, charge.charged, "refund.search_failed");
    return apiError(
      e instanceof Error ? e.message : "Search failed",
      "x_api_error",
      502
    );
  }

  const users = new Map(
    (result.includes?.users || []).map((u) => [u.id, u])
  );
  const tweets = (result.data || []).map((tweet) => ({
    id: tweet.id,
    text: tweet.text,
    created_at: tweet.created_at ?? null,
    metrics: tweet.public_metrics ?? null,
    author: tweet.author_id
      ? {
          username: users.get(tweet.author_id)?.username ?? null,
          name: users.get(tweet.author_id)?.name ?? null,
        }
      : null,
  }));

  const actualCharge = Math.max(MIN_CHARGE, tweets.length * CREDIT_COSTS["search.per_post"]);
  const overcharge = maxCharge - actualCharge;
  if (overcharge > 0) {
    await refundCredits(auth.userId, overcharge, "refund.search_overcount");
  }

  return withCreditHeaders(apiSuccess({ tweets, query }), {
    charged: actualCharge,
    remaining: charge.remaining + Math.max(0, overcharge),
  });
});
