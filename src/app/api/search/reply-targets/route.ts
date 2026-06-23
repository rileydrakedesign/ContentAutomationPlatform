import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireFeature } from "@/lib/stripe/gate";
import { getValidAccessToken } from "@/lib/x-api";
import { findReplyTargets } from "@/lib/x-api/reply-targets";
import { getDualAuthUser } from "@/lib/api/dual-auth";

export const maxDuration = 60;

// X bills search per post returned, so cap the page size hard.
const MIN_RESULTS = 10;
const MAX_RESULTS = 25;

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

    const found = await findReplyTargets(user.id, { query, maxResults, sort });

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
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500, headers: corsHeaders });
  }
}
