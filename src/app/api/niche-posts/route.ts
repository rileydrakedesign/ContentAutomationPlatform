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

// GET /api/niche-posts - List niche posts
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
    const accountId = searchParams.get("account_id");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    let query = supabase
      .from("niche_posts")
      .select("*, niche_accounts!inner(x_username, display_name)")
      .eq("user_id", user.id)
      .order("post_timestamp", { ascending: false })
      .range(offset, offset + limit - 1);

    if (accountId) {
      query = query.eq("niche_account_id", accountId);
    }

    const { data, error } = await query;

    if (error) throw error;

    return NextResponse.json(data, { headers: corsHeaders });
  } catch (error) {
    console.error("Failed to fetch niche posts:", error);
    return NextResponse.json(
      { error: "Failed to fetch niche posts" },
      { status: 500, headers: corsHeaders }
    );
  }
}

// POST /api/niche-posts - Add a niche post (from Chrome extension)
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

    if (!body.x_username || !body.x_post_id || !body.text_content) {
      return NextResponse.json(
        { error: "x_username, x_post_id, and text_content are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const cleanUsername = body.x_username.replace(/^@/, "").toLowerCase();

    // Find or create the niche account
    let { data: account } = await supabase
      .from("niche_accounts")
      .select("id")
      .eq("user_id", user.id)
      .eq("x_username", cleanUsername)
      .single();

    if (!account) {
      // Create the account if it doesn't exist
      const { data: newAccount, error: createError } = await supabase
        .from("niche_accounts")
        .insert({
          user_id: user.id,
          x_username: cleanUsername,
          display_name: body.display_name || null,
          follower_count: body.follower_count || null,
          is_active: true,
        })
        .select("id")
        .single();

      if (createError) throw createError;
      account = newAccount;
    }

    // Insert the post
    const { data, error } = await supabase
      .from("niche_posts")
      .insert({
        user_id: user.id,
        niche_account_id: account.id,
        x_post_id: body.x_post_id,
        text_content: body.text_content,
        metrics: body.metrics || {},
        post_timestamp: body.post_timestamp || null,
      })
      .select("*, niche_accounts(x_username, display_name)")
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Post already saved", code: "DUPLICATE" },
          { status: 409, headers: corsHeaders }
        );
      }
      throw error;
    }

    return NextResponse.json(data, { status: 201, headers: corsHeaders });
  } catch (error) {
    console.error("Failed to add niche post:", error);
    return NextResponse.json(
      { error: "Failed to add niche post" },
      { status: 500, headers: corsHeaders }
    );
  }
}
