import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

// QStash calls this after a scheduled-publish message exhausts its retries
// (dead-letter). The post id rides in the callback URL (see enqueuePublish), so
// identification never depends on QStash's failure-body shape; the body is read
// only for a human-readable reason. Marking the post `failed` makes it visible
// and retryable in the queue UI instead of silently vanishing.
export async function POST(request: NextRequest) {
  try {
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
    });

    const rawBody = await request.text();
    const signature = request.headers.get("upstash-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }
    try {
      await receiver.verify({ signature, body: rawBody });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scheduledPostId = searchParams.get("scheduledPostId");
    const userId = searchParams.get("userId");
    if (!scheduledPostId || !userId) {
      return NextResponse.json({ error: "Missing identifiers" }, { status: 400 });
    }

    // Best-effort detail for the queue UI / Sentry (QStash failure body).
    let detail = "Delivery failed: QStash exhausted all retries";
    let dlqId: string | undefined;
    try {
      const failure = JSON.parse(rawBody) as { status?: number; dlqId?: string };
      dlqId = failure.dlqId;
      if (failure.status) detail += ` (last response ${failure.status})`;
    } catch {
      // non-JSON body — keep the generic detail
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // CAS: only fail a still-`scheduled` post. If a late retry already posted it
    // or the user cancelled, this matches 0 rows and is a no-op.
    const { data: failed } = await supabase
      .from("scheduled_posts")
      .update({
        status: "failed",
        error: `${detail}. The post was not published — retry it from the queue. Check X first in case of a partial post.`,
        updated_at: new Date().toISOString(),
      })
      .eq("id", scheduledPostId)
      .eq("user_id", userId)
      .eq("status", "scheduled")
      .select("id");

    if (failed && failed.length > 0) {
      Sentry.captureMessage(
        `QStash delivery exhausted for scheduled post ${scheduledPostId}`,
        { level: "error", tags: { area: "qstash_failure", dlqId: dlqId ?? "none" } }
      );
    }

    // 200 so QStash considers the failure callback handled.
    return NextResponse.json({ ok: true, marked: failed?.length ?? 0 });
  } catch (error) {
    console.error("QStash failure callback error:", error);
    Sentry.captureException(error, { tags: { area: "qstash_failure" } });
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
