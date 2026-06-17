import { NextResponse } from "next/server";

export const maxDuration = 60;
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireAiGeneration } from "@/lib/stripe/gate";
import { analyzeNicheForUser } from "@/lib/analysis/niche-analyze";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/niche/analyze — Cluster user's posts into topic groups and produce
// a niche summary + positioning (audience, unique angle, statement).
export async function POST() {
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

    const gateError = await requireAiGeneration(user.id, "niche-analyze");
    if (gateError) return gateError;

    const result = await analyzeNicheForUser(supabase, user.id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      { profile: result.profile, posts_analyzed: result.posts_analyzed },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to analyse niche:", error);
    return NextResponse.json(
      { error: "Failed to analyse niche" },
      { status: 500, headers: corsHeaders }
    );
  }
}
