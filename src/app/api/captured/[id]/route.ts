import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { TriageRequest } from "@/types/captured";

// GET /api/captured/[id] - Get single captured post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      .from("captured_posts")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch captured post:", error);
    return NextResponse.json(
      { error: "Failed to fetch captured post" },
      { status: 500 }
    );
  }
}

// PATCH /api/captured/[id] - Update captured post (triage, assign collection)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const body: TriageRequest = await request.json();

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.inbox_status !== undefined) {
      updateData.inbox_status = body.inbox_status;
    }

    if (body.triaged_as !== undefined) {
      updateData.triaged_as = body.triaged_as;
      // Auto-set inbox_status to triaged when triaging
      if (body.triaged_as) {
        updateData.inbox_status = "triaged";
      }
    }

    if (body.collection_id !== undefined) {
      updateData.collection_id = body.collection_id;
    }

    const { data, error } = await supabase
      .from("captured_posts")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to update captured post:", error);
    return NextResponse.json(
      { error: "Failed to update captured post" },
      { status: 500 }
    );
  }
}

// DELETE /api/captured/[id] - Delete captured post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
      .from("captured_posts")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete captured post:", error);
    return NextResponse.json(
      { error: "Failed to delete captured post" },
      { status: 500 }
    );
  }
}
