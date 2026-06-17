import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { getContextFreshness } from "@/lib/analysis/freshness";

export async function OPTIONS() {
  return handleCors();
}

// GET /api/insights/voice-health — The single place the tuner loop's state is
// visible: freshness + counts for examples, patterns, niche/positioning, and
// strategy. Backs the dashboard Voice Health block and re-tune banner.
export async function GET() {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const [freshness, examplesRes, patternsRes, nicheRes, strategyRes] = await Promise.all([
      getContextFreshness(supabase, user.id),
      supabase
        .from("user_voice_examples")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_excluded", false),
      supabase
        .from("extracted_patterns")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_enabled", true),
      supabase
        .from("user_niche_profile")
        .select("niche_summary, positioning")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("content_strategy")
        .select("posts_per_week, pillar_targets")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    return NextResponse.json(
      {
        freshness,
        examples_count: examplesRes.count ?? 0,
        patterns_count: patternsRes.count ?? 0,
        has_niche: Boolean(nicheRes.data?.niche_summary),
        has_positioning: Boolean(
          (nicheRes.data?.positioning as { positioning_statement?: string } | null)
            ?.positioning_statement
        ),
        has_strategy: Boolean(strategyRes.data),
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to fetch voice health:", error);
    return NextResponse.json(
      { error: "Failed to fetch voice health" },
      { status: 500, headers: corsHeaders }
    );
  }
}
