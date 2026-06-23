import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireFeature } from "@/lib/stripe/gate";
import { getValidAccessToken } from "@/lib/x-api";
import { findReplyTargets } from "@/lib/x-api/reply-targets";
import { getDualAuthUser } from "@/lib/api/dual-auth";
import {
  CREDIT_COSTS,
  requireCredits,
  refundCredits,
} from "@/lib/billing/credits";

export const maxDuration = 60;

// X bills search per post returned, so cap the page size hard.
const MIN_RESULTS = 10;
const MAX_RESULTS = 25;
const MIN_CHARGE = 5;

export async function OPTIONS() {
  return handleCors();
}

// GET /api/search/reply-targets?query=&max_results=&sort= — Human surface of
// the reply engine, for BOTH the dashboard (cookie auth) and the Chrome
// extension (Bearer token). Same core (findReplyTargets) as the agent/API route
// and MCP find_reply_posts: returns ONLY posts the account can actually reply
// to, optionally ranked by traction. Pro-gated (search hits the X API).
export async function GET(request: NextRequest) {
  try {
    const { user } = await getDualAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const gateError = await requireFeature(user.id, "xApiSync");
    if (gateError) return gateError;

    const url = new URL(request.url);
    const query = String(url.searchParams.get("query") || "").trim();
    if (!query) {
      return NextResponse.json(
        { error: "Missing query parameter" },
        { status: 400, headers: corsHeaders }
      );
    }

    const maxResults = Math.max(
      MIN_RESULTS,
      Math.min(MAX_RESULTS, Number(url.searchParams.get("max_results")) || MIN_RESULTS)
    );
    const sort = url.searchParams.get("sort") === "traction" ? "traction" : "relevance";

    try {
      await getValidAccessToken(user.id);
    } catch {
      return NextResponse.json(
        { error: "X account not connected — connect X to find reply targets." },
        { status: 400, headers: corsHeaders }
      );
    }

    // X bills per post it RETURNS. Debit the worst case up front (1 credit/
    // result, min 5), then refund the difference once we know the actual count.
    // Mirrors /api/v1/search/reply-targets so the dashboard can't bypass the
    // metering the agent surface enforces.
    const maxCharge = maxResults * CREDIT_COSTS["search.per_post"];
    const charge = await requireCredits(user.id, maxCharge, "search.per_post");
    if (charge instanceof NextResponse) return charge;

    let found: Awaited<ReturnType<typeof findReplyTargets>>;
    try {
      found = await findReplyTargets(user.id, { query, maxResults, sort });
    } catch (error) {
      await refundCredits(user.id, charge.charged, "refund.search_failed");
      throw error;
    }

    const actualCharge = Math.max(
      MIN_CHARGE,
      found.returned_count * CREDIT_COSTS["search.per_post"]
    );
    const overcharge = maxCharge - actualCharge;
    if (overcharge > 0) {
      await refundCredits(user.id, overcharge, "refund.search_overcount");
    }

    return NextResponse.json(
      {
        tweets: found.tweets,
        query,
        sort,
        returned_count: found.returned_count,
        repliable_count: found.repliable_count,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Reply-target search failed:", error);
    Sentry.captureException(error, { tags: { route: "search/reply-targets" } });
    return NextResponse.json(
      { error: "Search failed. Please try again." },
      { status: 500, headers: corsHeaders }
    );
  }
}
