import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { refreshVoiceVectors } from "@/lib/analysis/assistant/vectors";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/assistant-vectors — refresh the writing-assistant L2 centroids for
// users whose vectors are stale relative to their latest analytics. Keeps the live
// Voice Match / Performance scores tracking the user's most recent posting history
// without waiting for a tune-up. Best-effort per user; never fails the batch.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
      console.error("CRON_SECRET is not set; refusing cron request");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Users whose analytics changed more recently than their vectors were built
    // (plus users who have analytics but no vectors yet). Cheap heuristic: take
    // users with a recent analytics upload and refresh their centroids.
    const { data: recent, error } = await supabase
      .from("user_analytics")
      .select("user_id, uploaded_at")
      .order("uploaded_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("[assistant-vectors] failed to list users:", error);
      return NextResponse.json({ error: "Failed to list users" }, { status: 500 });
    }

    const userIds = Array.from(new Set((recent || []).map((r) => String(r.user_id)).filter(Boolean)));
    let refreshed = 0;
    for (const userId of userIds) {
      try {
        const r = await refreshVoiceVectors(supabase, userId);
        if (r.sample_count > 0) refreshed++;
      } catch (err) {
        console.error(`[assistant-vectors] refresh failed for ${userId}:`, err);
      }
    }

    return NextResponse.json({ message: `Refreshed ${refreshed} users`, users_refreshed: refreshed });
  } catch (error) {
    console.error("[assistant-vectors] cron failed:", error);
    Sentry.captureException(error, { tags: { cron: "assistant-vectors" } });
    return NextResponse.json({ error: "Cron job failed" }, { status: 500 });
  }
}
