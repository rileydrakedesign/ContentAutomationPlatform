import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

type ContentType = "X_POST" | "X_THREAD";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const draftId = body?.draftId ? String(body.draftId) : null;
    const contentType: ContentType = body?.contentType;
    const payload = body?.payload;
    const scheduledFor = body?.scheduledFor ? new Date(body.scheduledFor) : null;

    if (!contentType || !["X_POST", "X_THREAD"].includes(contentType)) {
      return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
    }

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    if (!scheduledFor || isNaN(scheduledFor.getTime())) {
      return NextResponse.json({ error: "Invalid scheduledFor" }, { status: 400 });
    }

    // Insert scheduled post — the cron job will pick it up when scheduled_for arrives
    const { data: row, error: insertError } = await supabase
      .from("scheduled_posts")
      .insert({
        user_id: user.id,
        draft_id: draftId,
        content_type: contentType,
        payload,
        scheduled_for: scheduledFor.toISOString(),
        status: "scheduled",
      })
      .select("id, scheduled_for")
      .single();

    if (insertError) throw insertError;

    // Mark linked draft as SCHEDULED (best-effort)
    if (draftId) {
      try {
        await supabase
          .from("drafts")
          .update({ status: "SCHEDULED", updated_at: new Date().toISOString() })
          .eq("id", draftId)
          .eq("user_id", user.id);
      } catch (e) {
        console.warn("schedule: failed to mark draft as SCHEDULED", e);
      }
    }

    return NextResponse.json({
      success: true,
      id: row.id,
      scheduledFor: row.scheduled_for,
    });
  } catch (error) {
    console.error("Failed to schedule publish:", error);
    return NextResponse.json({ error: "Failed to schedule" }, { status: 500 });
  }
}
