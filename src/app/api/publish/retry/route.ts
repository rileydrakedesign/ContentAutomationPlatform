import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getPublishQueue } from "@/lib/queue/publish";

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

    const queue = getPublishQueue();
    const job = await queue.add("publish", { scheduledPostId: id, userId: user.id }, { delay: 0 });

    await supabase
      .from("scheduled_posts")
      .update({
        status: "scheduled",
        error: null,
        job_id: String(job.id),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("user_id", user.id);

    return NextResponse.json({ success: true, jobId: String(job.id) });
  } catch (error) {
    console.error("Failed to retry scheduled post:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
