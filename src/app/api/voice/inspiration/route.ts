import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { AddInspirationRequest } from "@/types/voice";

// Estimate tokens (approx 4 chars per token)
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// GET /api/voice/inspiration - Get all inspiration items
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeExcluded = searchParams.get("include_excluded") === "true";
    const keyword = searchParams.get("keyword");
    const pinnedOnly = searchParams.get("pinned_only") === "true";

    let query = supabase
      .from("user_inspiration")
      .select("*")
      .eq("user_id", user.id);

    if (!includeExcluded) {
      query = query.eq("is_excluded", false);
    }

    if (keyword) {
      query = query.eq("keyword", keyword);
    }

    if (pinnedOnly) {
      query = query.eq("is_pinned", true);
    }

    // Order: pinned first (by rank), then by relevance score
    query = query
      .order("is_pinned", { ascending: false })
      .order("pinned_rank", { ascending: true, nullsFirst: false })
      .order("relevance_score", { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch inspiration:", error);
    return NextResponse.json(
      { error: "Failed to fetch inspiration" },
      { status: 500 }
    );
  }
}

// POST /api/voice/inspiration - Add new inspiration item
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

    const body: AddInspirationRequest = await request.json();

    if (!body.keyword || !body.content_text) {
      return NextResponse.json(
        { error: "keyword and content_text are required" },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from("user_inspiration")
      .insert({
        user_id: user.id,
        keyword: body.keyword.toLowerCase().trim(),
        niche_category: body.niche_category || null,
        content_text: body.content_text,
        source_url: body.source_url || null,
        source_author: body.source_author || null,
        is_pinned: false,
        is_excluded: false,
        relevance_score: 0,
        token_count: estimateTokens(body.content_text),
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error("Failed to add inspiration:", error);
    return NextResponse.json(
      { error: "Failed to add inspiration" },
      { status: 500 }
    );
  }
}
