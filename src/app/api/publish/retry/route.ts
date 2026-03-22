import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";

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

    // Reset to scheduled
    await supabase
      .from("scheduled_posts")
      .update({
        status: "scheduled",
        error: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    // Enqueue QStash message for immediate retry (5s delay)
    try {
      const publishUrl = `${process.env.QSTASH_PUBLISH_URL}/api/qstash/publish`;
      const notBefore = Math.floor(Date.now() / 1000) + 5;

      const qstashRes = await qstash.publishJSON({
        url: publishUrl,
        body: { scheduledPostId: id, userId: user.id },
        notBefore,
        retries: 3,
      });

      await supabase
        .from("scheduled_posts")
        .update({ qstash_message_id: qstashRes.messageId })
        .eq("id", id);
    } catch (qstashErr) {
      console.error("Failed to enqueue QStash retry:", qstashErr);
      // Cron safety net will pick it up
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to retry scheduled post:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
