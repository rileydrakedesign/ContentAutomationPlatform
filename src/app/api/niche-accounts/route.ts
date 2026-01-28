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

// GET /api/niche-accounts - List niche accounts
export async function GET(request: NextRequest) {
  try {
    const { user, supabase } = await getAuthenticatedUser(request);

    if (!user || !supabase) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const category = searchParams.get("category");
    const isActive = searchParams.get("is_active");

    let query = supabase
      .from("niche_accounts")
      .select("*, niche_posts(count)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (category) {
      query = query.eq("niche_category", category);
    }

    if (isActive !== null) {
      query = query.eq("is_active", isActive === "true");
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to fetch niche accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch niche accounts" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/niche-accounts - Add a niche account
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

    if (!body.x_username) {
      return NextResponse.json(
        { error: "x_username is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Clean the username (remove @ if present)
    const cleanUsername = body.x_username.replace(/^@/, "").toLowerCase();

    const { data, error } = await supabase
      .from("niche_accounts")
      .insert({
        user_id: user.id,
        x_username: cleanUsername,
        display_name: body.display_name || null,
        follower_count: body.follower_count || null,
        niche_category: body.niche_category || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Account already being tracked", code: "DUPLICATE" },
          { status: 409, headers: corsHeaders }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error("Failed to add niche account:", error);
    return NextResponse.json(
      { error: "Failed to add niche account" },
      { status: 500, headers: corsHeaders }
    );
  }
}
