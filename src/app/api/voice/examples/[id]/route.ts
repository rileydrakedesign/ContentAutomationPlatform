import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/voice/examples/[id] - Get a single voice example
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_voice_examples")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Example not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch voice example:", error);
    return NextResponse.json(
      { error: "Failed to fetch voice example" },
      { status: 500 }
    );
  }
}

// PATCH /api/voice/examples/[id] - Update a voice example (pin/unpin, exclude, add note)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    // Handle pinning
    if (body.pin === true) {
      // Get the next pinned rank
      const { data: existingPinned } = await supabase
        .from("user_voice_examples")
        .select("pinned_rank")
        .eq("user_id", user.id)
        .not("pinned_rank", "is", null)
        .order("pinned_rank", { ascending: false })
        .limit(1);

      const nextRank = existingPinned && existingPinned.length > 0
        ? (existingPinned[0].pinned_rank || 0) + 1
        : 1;

      updateData.source = "pinned";
      updateData.pinned_rank = nextRank;
      updateData.is_excluded = false;
    } else if (body.pin === false) {
      updateData.source = "auto";
      updateData.pinned_rank = null;
    }

    // Handle exclusion
    if (body.exclude === true) {
      updateData.is_excluded = true;
      updateData.pinned_rank = null;
      updateData.source = "auto";
    } else if (body.exclude === false) {
      updateData.is_excluded = false;
    }

    // Handle note
    if (body.user_note !== undefined) {
      updateData.user_note = body.user_note;
    }

    const { data, error } = await supabase
      .from("user_voice_examples")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Example not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update voice example:", error);
    return NextResponse.json(
      { error: "Failed to update voice example" },
      { status: 500 }
    );
  }
}

// DELETE /api/voice/examples/[id] - Delete a voice example
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { error } = await supabase
      .from("user_voice_examples")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete voice example:", error);
    return NextResponse.json(
      { error: "Failed to delete voice example" },
      { status: 500 }
    );
  }
}
