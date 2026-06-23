import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { analyzeInspirationPost } from "@/lib/openai/analyze-inspiration";
import { getUserProvider } from "@/lib/ai";
import { requireAiGeneration } from "@/lib/stripe/gate";

// POST /api/captured/[id]/promote - Convert captured post to inspiration post
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

    const gateError = await requireAiGeneration(user.id, "captured-promote");
    if (gateError) return gateError;

    // Get the captured post
    const { data: capturedPost, error: fetchError } = await supabase
      .from("captured_posts")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (fetchError) {
      if (fetchError.code === "PGRST116") {
        return NextResponse.json({ error: "Post not found" }, { status: 404 });
      }
      throw fetchError;
    }

    // Create inspiration post
    const { data: inspirationPost, error: insertError } = await supabase
      .from("inspiration_posts")
      .insert({
        user_id: user.id,
        raw_content: capturedPost.text_content,
        source_url: capturedPost.post_url,
        author_handle: capturedPost.author_handle,
        platform: "X",
        analysis_status: "analyzing",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Update captured post to mark as triaged to inspiration
    await supabase
      .from("captured_posts")
      .update({
        inbox_status: "triaged",
        triaged_as: "inspiration",
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    // Run analysis asynchronously (don't wait for it)
    analyzeAndUpdate(supabase, inspirationPost.id, capturedPost.text_content, user.id);

    return NextResponse.json({
      success: true,
      inspirationPostId: inspirationPost.id,
      message: "Post promoted to inspiration. Analysis in progress.",
    });
  } catch (error) {
    console.error("Failed to promote post:", error);
    Sentry.captureException(error, { tags: { route: "captured/[id]/promote" } });
    return NextResponse.json(
      { error: "Failed to promote post to inspiration" },
      { status: 500 }
    );
  }
}

// Helper to run analysis and update the inspiration post
async function analyzeAndUpdate(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  inspirationId: string,
  content: string,
  userId: string
) {
  try {
    const provider = await getUserProvider(supabase, userId);
    const analysis = await analyzeInspirationPost(content, provider);

    await supabase
      .from("inspiration_posts")
      .update({
        voice_analysis: analysis.voice,
        format_analysis: analysis.format,
        analysis_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", inspirationId);
  } catch (error) {
    console.error("Analysis failed:", error);
    Sentry.captureException(error, { tags: { route: "captured/[id]/promote" } });
    await supabase
      .from("inspiration_posts")
      .update({
        analysis_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", inspirationId);
  }
}
