import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";

export async function OPTIONS() {
  return handleCors();
}

// GET /api/strategy — Returns the user's content strategy (or defaults)
export async function GET() {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { data: strategy, error } = await supabase
      .from("content_strategy")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error && error.code === "PGRST116") {
      // No strategy yet — return defaults
      return NextResponse.json({
        strategy: {
          posts_per_week: 5,
          threads_per_week: 1,
          replies_per_week: 10,
          pillar_targets: [],
        },
      }, { status: 200, headers: corsHeaders });
    }
    if (error) throw error;

    return NextResponse.json({ strategy }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Failed to fetch strategy:", error);
    return NextResponse.json({ error: "Failed to fetch strategy" }, { status: 500, headers: corsHeaders });
  }
}

type PillarTarget = { pillar: string; posts_per_week: number };

// PUT /api/strategy — Upsert the user's content strategy
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();

    const posts_per_week = Math.max(0, Math.floor(Number(body.posts_per_week) || 0));
    const threads_per_week = Math.max(0, Math.floor(Number(body.threads_per_week) || 0));
    const replies_per_week = Math.max(0, Math.floor(Number(body.replies_per_week) || 0));

    const pillar_targets: PillarTarget[] = Array.isArray(body.pillar_targets)
      ? body.pillar_targets
          .filter((t: any) => t && typeof t.pillar === "string" && t.pillar.trim())
          .map((t: any) => ({
            pillar: String(t.pillar).trim(),
            posts_per_week: Math.max(0, Math.floor(Number(t.posts_per_week) || 0)),
          }))
      : [];

    const { data: strategy, error } = await supabase
      .from("content_strategy")
      .upsert(
        {
          user_id: user.id,
          posts_per_week,
          threads_per_week,
          replies_per_week,
          pillar_targets,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ strategy }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Failed to save strategy:", error);
    return NextResponse.json({ error: "Failed to save strategy" }, { status: 500, headers: corsHeaders });
  }
}
