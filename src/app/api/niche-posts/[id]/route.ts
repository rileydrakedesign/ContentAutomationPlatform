import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuthClient } from "@/lib/supabase/server";
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
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      return { user: null, supabase: null };
    }
    return { user, supabase };
  }

  const supabase = await createAuthClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return { user: null, supabase: null };
  }
  return { user, supabase };
}

// GET /api/niche-posts/[id] - Get a single niche post
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    const { id } = await params;

    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const { data, error } = await supabase
      .from("niche_posts")
      .select("*, niche_accounts(x_username, display_name)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Post not found" },
          { status: 404, headers: corsHeaders }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to fetch niche post:", error);
    return NextResponse.json(
      { error: "Failed to fetch niche post" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PATCH /api/niche-posts/[id] - Update a niche post (pattern analysis)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    const { id } = await params;

    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const body = await request.json();

    const updateData: Record<string, unknown> = {};

    if (body.pattern_analysis !== undefined) updateData.pattern_analysis = body.pattern_analysis;
    if (body.metrics !== undefined) updateData.metrics = body.metrics;

    const { data, error } = await supabase
      .from("niche_posts")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Post not found" },
          { status: 404, headers: corsHeaders }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to update niche post:", error);
    return NextResponse.json(
      { error: "Failed to update niche post" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE /api/niche-posts/[id] - Remove a niche post
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);
    const { id } = await params;

    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const { error } = await supabase
      .from("niche_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json(
      { success: true },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to delete niche post:", error);
    return NextResponse.json(
      { error: "Failed to delete niche post" },
      { status: 500, headers: corsHeaders }
    );
  }
}
