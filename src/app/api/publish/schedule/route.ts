import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getPublishQueue } from "@/lib/queue/publish";

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

    const now = Date.now();
    const delayMs = Math.max(0, scheduledFor.getTime() - now);

    // Insert scheduled post
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

    // Enqueue publish job
    const queue = getPublishQueue();
    await queue.add(
      "publish",
      { scheduledPostId: row.id, userId: user.id },
      { delay: delayMs }
    );

    return NextResponse.json({ success: true, id: row.id, scheduledFor: row.scheduled_for });
  } catch (error) {
    console.error("Failed to schedule publish:", error);
    return NextResponse.json({ error: "Failed to schedule" }, { status: 500 });
  }
}
