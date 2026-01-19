import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { analyzeInspirationPost } from "@/lib/openai";

/**
 * GET /api/inspiration
 * List all inspiration posts with their analysis
 */
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

    const { data, error } = await supabase
      .from("inspiration_posts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch inspiration posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch inspiration posts" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/inspiration
 * Create a new inspiration post and auto-analyze it
 */
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
    const { content, url, authorHandle } = body as {
      content: string;
      url?: string;
      authorHandle?: string;
    };

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Create the post with pending status
    const { data: post, error: insertError } = await supabase
      .from("inspiration_posts")
      .insert({
        user_id: user.id,
        raw_content: content.trim(),
        source_url: url || null,
        author_handle: authorHandle || extractHandleFromUrl(url),
        platform: "X",
        analysis_status: "analyzing",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Auto-analyze in the background (don't await for faster response)
    analyzeAndUpdate(supabase, post.id, content.trim()).catch((err) => {
      console.error("Background analysis failed:", err);
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error("Failed to create inspiration post:", error);
    return NextResponse.json(
      { error: "Failed to create inspiration post" },
      { status: 500 }
    );
  }
}

/**
 * Extract @handle from X URL if present
 */
function extractHandleFromUrl(url?: string): string | null {
  if (!url) return null;

  // Match patterns like:
  // https://x.com/username/status/123
  // https://twitter.com/username/status/123
  const match = url.match(/(?:x\.com|twitter\.com)\/([^\/]+)/);
  return match ? `@${match[1]}` : null;
}

/**
 * Analyze post and update database
 */
async function analyzeAndUpdate(
  supabase: Awaited<ReturnType<typeof createAuthClient>>,
  postId: string,
  content: string
) {
  try {
    const analysis = await analyzeInspirationPost(content);

    await supabase
      .from("inspiration_posts")
      .update({
        voice_analysis: analysis.voice,
        format_analysis: analysis.format,
        analysis_status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
  } catch (error) {
    console.error("Analysis failed for post:", postId, error);

    await supabase
      .from("inspiration_posts")
      .update({
        analysis_status: "failed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId);
  }
}
