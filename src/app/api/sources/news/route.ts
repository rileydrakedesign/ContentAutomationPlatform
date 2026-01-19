import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

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

    const body = await request.json();
    const { url, content, title, author, publication } = body;

    if (!url && !content) {
      return NextResponse.json(
        { error: "Either url or content is required" },
        { status: 400 }
      );
    }

    const { data: source, error } = await supabase
      .from("sources")
      .insert({
        user_id: user.id,
        type: "NEWS",
        raw_content: content || null,
        source_url: url || null,
        metadata: {
          title: title || null,
          author: author || null,
          publication: publication || null,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error("Failed to create news source:", error);
    return NextResponse.json(
      { error: "Failed to create news source" },
      { status: 500 }
    );
  }
}
