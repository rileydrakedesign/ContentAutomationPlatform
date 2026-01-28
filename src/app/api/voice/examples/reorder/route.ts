import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { ReorderExamplesRequest } from "@/types/voice";

// POST /api/voice/examples/reorder - Reorder pinned examples
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

    const body: ReorderExamplesRequest = await request.json();

    if (!body.example_ids || !Array.isArray(body.example_ids)) {
      return NextResponse.json(
        { error: "example_ids array is required" },
        { status: 400 }
      );
    }

    // Update ranks based on array order
    const updates = body.example_ids.map((id, index) => ({
      id,
      pinned_rank: index + 1,
      updated_at: new Date().toISOString(),
    }));

    // Batch update using upsert
    for (const update of updates) {
      const { error } = await supabase
        .from("user_voice_examples")
        .update({
          pinned_rank: update.pinned_rank,
          updated_at: update.updated_at,
        })
        .eq("id", update.id)
        .eq("user_id", user.id);

      if (error) throw error;
    }

    // Fetch updated examples
    const { data, error } = await supabase
      .from("user_voice_examples")
      .select("*")
      .eq("user_id", user.id)
      .eq("source", "pinned")
      .eq("is_excluded", false)
      .order("pinned_rank", { ascending: true });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to reorder voice examples:", error);
    return NextResponse.json(
      { error: "Failed to reorder voice examples" },
      { status: 500 }
    );
  }
}
