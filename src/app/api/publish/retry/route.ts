import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { enqueuePublish } from "@/lib/qstash/enqueue";

// POST /api/publish/retry - retry a failed scheduled post
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
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    const { data: post, error } = await supabase
      .from("scheduled_posts")
      .select("id, status, scheduled_for")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (post.status !== "failed") {
      return NextResponse.json({ error: "Only failed posts can be retried" }, { status: 400 });
    }

    // Reset to scheduled — CAS on status so a concurrent cancel/publish can't
    // be resurrected. posted_post_ids is intentionally untouched: a retried
    // thread resumes from the first unposted tweet.
    const { data: reset, error: resetError } = await supabase
      .from("scheduled_posts")
      .update({
        status: "scheduled",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id)
      .eq("status", "failed")
      .select("id");

    if (resetError || !reset || reset.length === 0) {
      return NextResponse.json(
        { error: "Post is no longer in a failed state" },
        { status: 409 }
      );
    }

    // Enqueue QStash message for immediate retry (5s delay). On enqueue failure
    // the row is back to `scheduled` and the publish-scheduled sweep will pick
    // it up — reported as deliveryConfirmed:false.
    const { messageId } = await enqueuePublish({
      scheduledPostId: id,
      userId: user.id,
      notBefore: Math.floor(Date.now() / 1000) + 5,
    });
    if (messageId) {
      await supabase
        .from("scheduled_posts")
        .update({ qstash_message_id: messageId })
        .eq("id", id);
    }

    return NextResponse.json({ success: true, deliveryConfirmed: messageId !== null });
  } catch (error) {
    console.error("Failed to retry scheduled post:", error);
    Sentry.captureException(error, { tags: { route: "publish/retry" } });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
