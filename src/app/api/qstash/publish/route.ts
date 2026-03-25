import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { createClient } from "@supabase/supabase-js";
import { executeScheduledPost } from "@/lib/publish/execute";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    // Verify QStash signature at runtime (avoids build-time env var check)
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
      await receiver.verify({
        signature,
        body: rawBody,
      });
    } catch {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const { scheduledPostId, userId } = body;

    if (!scheduledPostId || !userId) {
      return NextResponse.json(
        { error: "Missing scheduledPostId or userId" },
        { status: 400 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Load the scheduled post
    const { data: post, error } = await supabase
      .from("scheduled_posts")
      .select("id, user_id, content_type, payload, scheduled_for, status, draft_id")
      .eq("id", scheduledPostId)
      .eq("user_id", userId)
      .single();

    if (error || !post) {
      console.error("QStash publish: post not found", { scheduledPostId, error });
      return NextResponse.json({ error: "Post not found" }, { status: 404 });
    }

    // Skip if no longer scheduled (cancelled, already posted, etc.)
    if (post.status && post.status !== "scheduled") {
      console.log(`QStash publish: skipping post ${post.id} with status ${post.status}`);
      return NextResponse.json({ skipped: true, status: post.status });
    }

    const result = await executeScheduledPost(supabase, post);

    if (result.success) {
      return NextResponse.json({ success: true, postedIds: result.postedIds });
    } else {
      // Return 200 so QStash doesn't retry on application-level failures
      return NextResponse.json({ success: false, error: result.error });
    }
  } catch (error) {
    console.error("QStash publish webhook error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
