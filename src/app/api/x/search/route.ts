import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { searchRecentTweets, getValidAccessToken } from "@/lib/x-api";
import { checkRateLimit } from "@/lib/api/rate-limit";

// POST /api/x/search - Search recent tweets for inspiration
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

    // Per-user throttle — search hits the billed X API.
    const rl = await checkRateLimit(`x-search:${user.id}`, 10);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many searches — please slow down." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    const { accessToken } = await getValidAccessToken(user.id);

    const body = await request.json();
    const query = String(body?.query || "").trim();
    const maxResults = Math.min(Number(body?.maxResults) || 10, 100);

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const result = await searchRecentTweets(accessToken, query, maxResults);

    // Build a lightweight response with author info attached
    const tweets = (result.data || []).map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at,
      public_metrics: tweet.public_metrics,
    }));

    return NextResponse.json({ tweets });
  } catch (error) {
    console.error("Failed to search tweets:", error);
    Sentry.captureException(error, { tags: { route: "x/search" } });
    return NextResponse.json({ error: "Search failed. Please try again." }, { status: 500 });
  }
}
