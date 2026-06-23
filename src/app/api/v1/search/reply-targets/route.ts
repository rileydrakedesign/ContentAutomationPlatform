import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { NextResponse } from "next/server";
import { getValidAccessToken } from "@/lib/x-api";
import { findReplyTargets } from "@/lib/x-api/reply-targets";
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

// GET /api/v1/search/reply-targets?query=&max_results=&sort=
// Search recent tweets and return ONLY posts the authenticated account can
// reply to (reply_allowed === true). Optional sort=traction ranks the
// repliable subset by momentum (engagement decayed by post age).
//
// Credits: X bills per post it RETURNS, so we charge on X's returned count
// (1 credit/result, min 5) — not on the smaller repliable subset we hand back.
// Filtering happens after we've already paid X, so dropped posts are not
// refunded. Pro plan required.
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

  // Default keeps X's relevance order; sort=traction ranks repliable posts by
  // momentum. Only triggered when the caller explicitly asks for it.
  const sort = url.searchParams.get("sort") === "traction" ? "traction" : "relevance";

  // Guard not-connected before charging — clearer error and no debit/refund.
  try {
    await getValidAccessToken(auth.userId);
  } catch {
    return apiError("X account not connected", "x_not_connected", 400);
  }

  // Debit the worst case up front, refund the difference once we know how many
  // posts X actually returned (X bills per post returned).
  const maxCharge = maxResults * CREDIT_COSTS["search.per_post"];
  const charge = await requireCredits(auth.userId, maxCharge, "search.per_post");
  if (charge instanceof NextResponse) return charge;

  let found: Awaited<ReturnType<typeof findReplyTargets>>;
  try {
    found = await findReplyTargets(auth.userId, { query, maxResults, sort });
  } catch (e) {
    await refundCredits(auth.userId, charge.charged, "refund.search_failed");
    return apiError(
      e instanceof Error ? e.message : "Search failed",
      "x_api_error",
      502
    );
  }

  // Charge on what X returned (and what we paid for) — not the filtered subset.
  const actualCharge = Math.max(
    MIN_CHARGE,
    found.returned_count * CREDIT_COSTS["search.per_post"]
  );
  const overcharge = maxCharge - actualCharge;
  if (overcharge > 0) {
    await refundCredits(auth.userId, overcharge, "refund.search_overcount");
  }

  return withCreditHeaders(
    apiSuccess({
      tweets: found.tweets,
      query,
      sort,
      // Transparency: how many X returned vs. how many we could reply to.
      returned_count: found.returned_count,
      repliable_count: found.repliable_count,
    }),
    {
      charged: actualCharge,
      remaining: charge.remaining + Math.max(0, overcharge),
    }
  );
});
