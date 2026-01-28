import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { AddKeywordRequest } from "@/types/voice";

// GET /api/voice/inspiration/keywords - Get distinct keywords
export async function GET() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all inspiration items and extract unique keywords with counts
    const { data, error } = await supabase
      .from("user_inspiration")
      .select("keyword, niche_category")
      .eq("user_id", user.id)
      .eq("is_excluded", false);

    if (error) throw error;

    // Group by keyword and count
    const keywordMap = new Map<string, { keyword: string; niche_category: string | null; count: number }>();

    for (const item of data || []) {
      const existing = keywordMap.get(item.keyword);
      if (existing) {
        existing.count++;
      } else {
        keywordMap.set(item.keyword, {
          keyword: item.keyword,
          niche_category: item.niche_category,
          count: 1,
        });
      }
    }

    const keywords = Array.from(keywordMap.values()).sort((a, b) =>
      a.keyword.localeCompare(b.keyword)
    );

    return NextResponse.json(keywords);
  } catch (error) {
    console.error("Failed to fetch keywords:", error);
    return NextResponse.json(
      { error: "Failed to fetch keywords" },
      { status: 500 }
    );
  }
}

// POST /api/voice/inspiration/keywords - Add a new keyword (placeholder, no content yet)
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

    const body: AddKeywordRequest = await request.json();

    if (!body.keyword) {
      return NextResponse.json(
        { error: "keyword is required" },
        { status: 400 }
      );
    }

    const keyword = body.keyword.toLowerCase().trim();

    // Check if keyword already exists
    const { data: existing } = await supabase
      .from("user_inspiration")
      .select("id")
      .eq("user_id", user.id)
      .eq("keyword", keyword)
      .limit(1);

    if (existing && existing.length > 0) {
      return NextResponse.json(
        { error: "Keyword already exists" },
        { status: 400 }
      );
    }

    // Create a placeholder inspiration item for this keyword
    const { data, error } = await supabase
      .from("user_inspiration")
      .insert({
        user_id: user.id,
        keyword: keyword,
        niche_category: body.niche_category || null,
        content_text: "[Keyword placeholder - add inspiration content]",
        is_pinned: false,
        is_excluded: false,
        relevance_score: 0,
        token_count: 0,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ keyword, niche_category: body.niche_category || null, count: 1 }, { status: 201 });
  } catch (error) {
    console.error("Failed to add keyword:", error);
    return NextResponse.json(
      { error: "Failed to add keyword" },
      { status: 500 }
    );
  }
}

// DELETE /api/voice/inspiration/keywords - Remove all inspiration for a keyword
export async function DELETE(request: NextRequest) {
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
    const keyword = searchParams.get("keyword");

    if (!keyword) {
      return NextResponse.json(
        { error: "keyword query parameter is required" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("user_inspiration")
      .delete()
      .eq("user_id", user.id)
      .eq("keyword", keyword.toLowerCase().trim());

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete keyword:", error);
    return NextResponse.json(
      { error: "Failed to delete keyword" },
      { status: 500 }
    );
  }
}
