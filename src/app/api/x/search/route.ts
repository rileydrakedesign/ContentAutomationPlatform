import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { searchRecentTweets, getValidAccessToken } from "@/lib/x-api";

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

    const { accessToken } = await getValidAccessToken(supabase, user.id);

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
    const message = error instanceof Error ? error.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
