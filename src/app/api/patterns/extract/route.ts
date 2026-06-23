import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireFeature } from "@/lib/stripe/gate";
import { extractPatternsForUser } from "@/lib/analysis/pattern-extract";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

// POST /api/patterns/extract - Trigger pattern extraction from posts
export async function POST() {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Pattern extraction requires Pro plan
    const gateError = await requireFeature(user.id, "patternExtraction");
    if (gateError) return gateError;

    const result = await extractPatternsForUser(supabase, user.id);

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, patterns: [] },
        { status: result.status, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        patterns: result.patterns,
        analyzed_posts: result.analyzed_posts,
        data_source: result.data_source,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to extract patterns:", error);
    Sentry.captureException(error, { tags: { route: "patterns/extract" } });
    return NextResponse.json(
      { error: "Failed to extract patterns" },
      { status: 500, headers: corsHeaders }
    );
  }
}
