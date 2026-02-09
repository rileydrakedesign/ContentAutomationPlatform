import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { analyzeInspirationPost } from "@/lib/openai";

/**
 * GET /api/inspiration/[id]
 * Get a single inspiration post
 */
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
      .from("inspiration_posts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Inspiration post not found" },
          { status: 404 }
        );
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch inspiration post:", error);
    return NextResponse.json(
      { error: "Failed to fetch inspiration post" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/inspiration/[id]
 * Delete an inspiration post
 */
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
      .from("inspiration_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete inspiration post:", error);
    return NextResponse.json(
      { error: "Failed to delete inspiration post" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inspiration/[id]
 * Re-analyze an existing inspiration post
 */
export async function POST(
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

    // Fetch the existing post
    const { data: post, error: fetchError } = await supabase
      .from("inspiration_posts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Inspiration post not found" },
          { status: 404 }
        );
      }
      throw fetchError;
    }

    // Update status to analyzing
    await supabase
      .from("inspiration_posts")
      .update({ analysis_status: "analyzing" })
      .eq("id", id)
      .eq("user_id", user.id);

    // Re-analyze
    try {
      const analysis = await analyzeInspirationPost(post.raw_content);

      const { data: updated, error: updateError } = await supabase
        .from("inspiration_posts")
        .update({
          voice_analysis: analysis.voice,
          format_analysis: analysis.format,
          analysis_status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", id)
        .eq("user_id", user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      return NextResponse.json(updated);
    } catch (analysisError) {
      // Mark as failed
      await supabase
        .from("inspiration_posts")
        .update({ analysis_status: "failed" })
        .eq("id", id)
        .eq("user_id", user.id);

      throw analysisError;
    }
  } catch (error) {
    console.error("Failed to re-analyze inspiration post:", error);
    return NextResponse.json(
      { error: "Failed to re-analyze inspiration post" },
      { status: 500 }
    );
  }
}
