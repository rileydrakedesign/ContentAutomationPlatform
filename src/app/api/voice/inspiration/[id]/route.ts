import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/voice/inspiration/[id] - Get a single inspiration item
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
      .from("user_inspiration")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Inspiration not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch inspiration:", error);
    return NextResponse.json(
      { error: "Failed to fetch inspiration" },
      { status: 500 }
    );
  }
}

// PATCH /api/voice/inspiration/[id] - Update inspiration (pin/exclude/note)
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
        .from("user_inspiration")
        .select("pinned_rank")
        .eq("user_id", user.id)
        .eq("is_pinned", true)
        .not("pinned_rank", "is", null)
        .order("pinned_rank", { ascending: false })
        .limit(1);

      const nextRank = existingPinned && existingPinned.length > 0
        ? (existingPinned[0].pinned_rank || 0) + 1
        : 1;

      updateData.is_pinned = true;
      updateData.pinned_rank = nextRank;
      updateData.is_excluded = false;
    } else if (body.pin === false) {
      updateData.is_pinned = false;
      updateData.pinned_rank = null;
    }

    // Handle exclusion
    if (body.exclude === true) {
      updateData.is_excluded = true;
      updateData.is_pinned = false;
      updateData.pinned_rank = null;
    } else if (body.exclude === false) {
      updateData.is_excluded = false;
    }

    // Handle note
    if (body.user_note !== undefined) {
      updateData.user_note = body.user_note;
    }

    const { data, error } = await supabase
      .from("user_inspiration")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Inspiration not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update inspiration:", error);
    return NextResponse.json(
      { error: "Failed to update inspiration" },
      { status: 500 }
    );
  }
}

// DELETE /api/voice/inspiration/[id] - Delete an inspiration item
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
      .from("user_inspiration")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete inspiration:", error);
    return NextResponse.json(
      { error: "Failed to delete inspiration" },
      { status: 500 }
    );
  }
}
