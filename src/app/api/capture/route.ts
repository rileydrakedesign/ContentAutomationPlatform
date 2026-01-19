import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { CaptureRequest } from "@/types/captured";
import { corsHeaders, handleCors } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

// Helper to get user from either cookie or Bearer token
async function getAuthenticatedUser(request: NextRequest) {
  // Check for Bearer token first (from extension)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.substring(7);

    // Create client with the access token
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

    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { user: null, supabase: null };
    }
    return { user, supabase };
  }

  // Fall back to cookie-based auth
  const supabase = await createAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, supabase: null };
  }
  return { user, supabase };
}

// POST /api/capture - Receive captured posts from extension
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);

    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body: CaptureRequest = await request.json();

    // Validate required fields
    if (!body.post_url || !body.author_handle || !body.text_content) {
      return NextResponse.json(
        { error: "post_url, author_handle, and text_content are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Get user's configured X handles to determine if this is their own post
    const { data: settings } = await supabase
      .from("user_settings")
      .select("x_handles")
      .eq("user_id", user.id)
      .single();

    const xHandles = settings?.x_handles || [];
    const isOwnPost = xHandles.some(
      (handle: string) =>
        handle.toLowerCase() === body.author_handle.toLowerCase() ||
        handle.toLowerCase() === body.author_handle.replace("@", "").toLowerCase()
    );

    // Insert the captured post
    const { data, error } = await supabase
      .from("captured_posts")
      .insert({
        user_id: user.id,
        post_url: body.post_url,
        author_handle: body.author_handle.replace("@", ""),
        author_name: body.author_name || null,
        text_content: body.text_content,
        is_own_post: isOwnPost,
        metrics: body.metrics || {},
        post_timestamp: body.post_timestamp || null,
        inbox_status: "inbox",
        triaged_as: null,
        collection_id: null,
      })
      .select()
      .single();

    if (error) {
      // Handle duplicate post
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Post already captured", code: "DUPLICATE" },
          { status: 409, headers: corsHeaders }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error("Failed to capture post:", error);
    return NextResponse.json(
      { error: "Failed to capture post" },
      { status: 500, headers: corsHeaders }
    );
  }
}
