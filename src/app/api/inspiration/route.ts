import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/server";
import { analyzeInspirationPost } from "@/lib/openai";
import { corsHeaders, handleCors } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

// Helper to get user from either cookie or Bearer token
async function getAuthenticatedUser(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { user: null, supabase: null };
    }
    return { user, supabase };
  }

  const supabase = await createAuthClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, supabase: null };
  }
  return { user, supabase };
}

/**
 * GET /api/inspiration
 * List all inspiration posts with their analysis
 */
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);

    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const { data, error } = await supabase
      .from("inspiration_posts")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to fetch inspiration posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch inspiration posts" },
      { status: 500, headers: corsHeaders }
    );
  }
}

/**
 * POST /api/inspiration
 * Create a new inspiration post and auto-analyze it
 */
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);

    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();
    const { content, url, authorHandle, metrics, post_timestamp, source } =
      body as {
        content: string;
        url?: string;
        authorHandle?: string;
        metrics?: Record<string, unknown>;
        post_timestamp?: string;
        source?: string;
      };

    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Duplicate detection by source_url
    if (url) {
      const { data: existing } = await supabase
        .from("inspiration_posts")
        .select("id")
        .eq("user_id", user.id)
        .eq("source_url", url)
        .maybeSingle();

      if (existing) {
        return NextResponse.json(
          { error: "Post already saved", code: "DUPLICATE" },
          { status: 409, headers: corsHeaders }
        );
      }
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
        metrics: metrics || {},
        post_timestamp: post_timestamp || null,
        source: source || "manual",
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Auto-analyze in the background (don't await for faster response)
    analyzeAndUpdate(supabase, post.id, content.trim()).catch((err) => {
      console.error("Background analysis failed:", err);
    });

    return NextResponse.json(post, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error("Failed to create inspiration post:", error);
    return NextResponse.json(
      { error: "Failed to create inspiration post" },
      { status: 500, headers: corsHeaders }
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
