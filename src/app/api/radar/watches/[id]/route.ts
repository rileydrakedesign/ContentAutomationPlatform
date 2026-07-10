import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient, createAdminClient } from "@/lib/supabase/server";
import { isRadarBetaUser } from "@/lib/radar/flag";

// PATCH /api/radar/watches/:id — toggle a watch on/off. Watches are
// system-seeded and user-trimmed (PRD §3.1): trimming is a first-class
// action, so a disabled watch pauses its sweep units, it isn't deleted.
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
    let body: { enabled?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ error: "enabled must be a boolean" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: updated, error } = await admin
      .from("watches")
      .update({ enabled: body.enabled, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, enabled")
      .maybeSingle();
    if (error) throw error;
    if (!updated) {
      return NextResponse.json({ error: "Watch not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, watch: updated });
  } catch (error) {
    console.error("Radar watch update failed:", error);
    Sentry.captureException(error, { tags: { route: "radar/watch-toggle" } });
    return NextResponse.json({ error: "Failed to update watch" }, { status: 500 });
  }
}
