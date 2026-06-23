import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { getOutcomeAttribution } from "@/lib/analysis/attribution";

export async function OPTIONS() {
  return handleCors();
}

// GET /api/insights/attribution — "your AFX-assisted posts vs. your baseline."
export async function GET() {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const attribution = await getOutcomeAttribution(supabase, user.id);
    return NextResponse.json(attribution, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("insights/attribution failed:", error);
    Sentry.captureException(error, { tags: { route: "insights/attribution" } });
    return NextResponse.json(
      { error: "Failed to compute attribution" },
      { status: 500, headers: corsHeaders }
    );
  }
}
