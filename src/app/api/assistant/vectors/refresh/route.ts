import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

export const maxDuration = 60;
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireFeature } from "@/lib/stripe/gate";
import { refreshVoiceVectors } from "@/lib/analysis/assistant/vectors";
import { getDualAuthUser } from "@/lib/api/dual-auth";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/assistant/vectors/refresh — rebuild the caller's L2 voice + winners
// centroids from their current corpus. Triggered after a tune-up / analytics sync,
// or on demand. Subscription-gated, not metered (embeddings are cheap).
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getDualAuthUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const gateError = await requireFeature(user.id, "writingAssistant");
    if (gateError) return gateError;

    const result = await refreshVoiceVectors(supabase, user.id);
    return NextResponse.json(result, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Assistant vectors refresh failed:", error);
    Sentry.captureException(error, { tags: { route: "assistant-vectors-refresh" } });
    return NextResponse.json({ error: "Refresh failed" }, { status: 500, headers: corsHeaders });
  }
}
