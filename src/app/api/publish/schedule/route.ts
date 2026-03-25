import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";

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

    if (scheduledFor.getTime() < Date.now()) {
      return NextResponse.json({ error: "scheduledFor must be in the future" }, { status: 400 });
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

    // Enqueue QStash message to publish at scheduled time
    try {
      const publishUrl = `${process.env.QSTASH_PUBLISH_URL}/api/qstash/publish`;
      const notBefore = Math.floor(scheduledFor.getTime() / 1000);

      const qstashRes = await qstash.publishJSON({
        url: publishUrl,
        body: { scheduledPostId: row.id, userId: user.id },
        notBefore,
        retries: 3,
      });

      // Save QStash message ID for cancellation support
      await supabase
        .from("scheduled_posts")
        .update({ qstash_message_id: qstashRes.messageId })
        .eq("id", row.id);
    } catch (qstashErr) {
      console.error("Failed to enqueue QStash message:", qstashErr);
      // Post is still saved — cron safety net will pick it up
    }

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
