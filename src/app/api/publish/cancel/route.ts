import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getPublishQueue } from "@/lib/queue/publish";

// POST /api/publish/cancel - cancel a scheduled post
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

    // Load post
    const { data: post, error } = await supabase
      .from("scheduled_posts")
      .select("id, status, job_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (post.status === "posted") {
      return NextResponse.json({ error: "Already posted" }, { status: 400 });
    }

    // Try to remove BullMQ job
    if (post.job_id) {
      try {
        const queue = getPublishQueue();
        const job = await queue.getJob(post.job_id);
        if (job) {
          await job.remove();
        }
      } catch (e) {
        console.error("Failed to remove job:", e);
      }
    }

    await supabase
      .from("scheduled_posts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel scheduled post:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
