import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient, createAdminClient } from "@/lib/supabase/server";
import { isRadarBetaUser } from "@/lib/radar/flag";

const STATES = ["new", "snoozed", "replied", "skipped"] as const;

// PATCH /api/radar/queue/:id — queue-state transition (snooze / skip / replied
// / back to new). Skip reasons are signal, not failure — they feed ranking in
// Phase 3.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!isRadarBetaUser(user.id)) {
      return NextResponse.json({ error: "Radar beta not enabled", code: "NOT_BETA" }, { status: 403 });
    }

    const { id } = await params;
    let body: { state?: string; skip_reason?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const state = String(body.state || "");
    if (!STATES.includes(state as (typeof STATES)[number])) {
      return NextResponse.json(
        { error: `state must be one of ${STATES.join(", ")}` },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from("user_target_queue")
      .update({
        state,
        skip_reason: state === "skipped" ? String(body.skip_reason || "") || null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, state")
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      return NextResponse.json({ error: "Queue item not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, item: updated });
  } catch (error) {
    console.error("Radar queue update failed:", error);
    Sentry.captureException(error, { tags: { route: "radar/queue-state" } });
    return NextResponse.json({ error: "Failed to update queue item" }, { status: 500 });
  }
}
