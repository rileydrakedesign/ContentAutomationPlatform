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

// GET /api/niche-accounts/[id] - Get a single niche account with its posts
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
      .from("niche_accounts")
      .select("*, niche_posts(*)")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404, headers: corsHeaders }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to fetch niche account:", error);
    return NextResponse.json(
      { error: "Failed to fetch niche account" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// PATCH /api/niche-accounts/[id] - Update a niche account
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

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (body.display_name !== undefined) updateData.display_name = body.display_name;
    if (body.niche_category !== undefined) updateData.niche_category = body.niche_category;
    if (body.is_active !== undefined) updateData.is_active = body.is_active;
    if (body.follower_count !== undefined) updateData.follower_count = body.follower_count;
    if (body.last_sync_at !== undefined) updateData.last_sync_at = body.last_sync_at;

    const { data, error } = await supabase
      .from("niche_accounts")
      .update(updateData)
      .eq("id", id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "Account not found" },
          { status: 404, headers: corsHeaders }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to update niche account:", error);
    return NextResponse.json(
      { error: "Failed to update niche account" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// DELETE /api/niche-accounts/[id] - Remove a niche account
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
      .from("niche_accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) throw error;

    return NextResponse.json(
      { success: true },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to delete niche account:", error);
    return NextResponse.json(
      { error: "Failed to delete niche account" },
      { status: 500, headers: corsHeaders }
    );
  }
}
