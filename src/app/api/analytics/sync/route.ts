import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { requireFeature } from "@/lib/stripe/gate";
import { syncUserTimeline } from "@/lib/analysis/timeline-sync";

// POST /api/analytics/sync - User-triggered API analytics sync
export async function POST() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const gateError = await requireFeature(user.id, "xApiSync");
    if (gateError) return gateError;

    const { synced, merged, total } = await syncUserTimeline(supabase, user.id);

    return NextResponse.json({ synced, merged, total });
  } catch (error) {
    console.error("Failed to sync analytics:", error);
    Sentry.captureException(error, { tags: { route: "analytics/sync" } });
    const message = error instanceof Error ? error.message : "Failed to sync analytics";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
