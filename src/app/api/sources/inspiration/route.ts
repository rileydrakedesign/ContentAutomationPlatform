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
    const { url, text, platform, author } = body;

    if (!url && !text) {
      return NextResponse.json(
        { error: "Either url or text is required" },
        { status: 400 }
      );
    }

    const { data: source, error } = await supabase
      .from("sources")
      .insert({
        user_id: user.id,
        type: "INSPIRATION",
        raw_content: text || null,
        source_url: url || null,
        metadata: {
          platform: platform || null,
          author: author || null,
        },
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(source, { status: 201 });
  } catch (error) {
    console.error("Failed to create inspiration:", error);
    return NextResponse.json(
      { error: "Failed to create inspiration" },
      { status: 500 }
    );
  }
}
