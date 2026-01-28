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

// GET /api/patterns - List extracted patterns
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
    const patternType = searchParams.get("type");
    const enabledOnly = searchParams.get("enabled_only") === "true";

    let query = supabase
      .from("extracted_patterns")
      .select("*")
      .eq("user_id", user.id)
      .order("multiplier", { ascending: false });

    if (patternType) {
      query = query.eq("pattern_type", patternType);
    }

    if (enabledOnly) {
      query = query.eq("is_enabled", true);
    }

    const { data, error } = await query;

    if (error) throw error;

    // Group patterns by type for easier consumption
    const groupedPatterns = data.reduce((acc, pattern) => {
      const type = pattern.pattern_type;
      if (!acc[type]) {
        acc[type] = [];
      }
      acc[type].push(pattern);
      return acc;
    }, {} as Record<string, typeof data>);

    return NextResponse.json(
      { patterns: data, grouped: groupedPatterns },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to fetch patterns:", error);
    return NextResponse.json(
      { error: "Failed to fetch patterns" },
      { status: 500, headers: corsHeaders }
    );
  }
}
