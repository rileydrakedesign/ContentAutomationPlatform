import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { executeScheduledPost } from "@/lib/publish/execute";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/publish-scheduled - Safety-net sweep for posts QStash missed
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET is not set; refusing cron request");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Recover posts stuck in 'publishing' (process died mid-publish): mark
    // failed so they surface in the queue UI. Never auto-republish — tweets
    // may have partially posted.
    const stuckCutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckPosts } = await supabase
      .from("scheduled_posts")
      .update({
        status: "failed",
        error:
          "Publishing did not complete (process interrupted). Some tweets may already be on X — check before retrying.",
        updated_at: new Date().toISOString(),
      })
      .eq("status", "publishing")
      .lt("updated_at", stuckCutoff)
      .select("id");
    const recovered = stuckPosts?.length ?? 0;

    // Find all posts due for publishing
    const { data: duePosts, error: queryError } = await supabase
      .from("scheduled_posts")
      .select("id, user_id, content_type, payload, scheduled_for, draft_id")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true });

    if (queryError) throw queryError;
    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({ published: 0, failed: 0, recovered });
    }

    let published = 0;
    let failed = 0;

    for (const post of duePosts) {
      const result = await executeScheduledPost(supabase, post);
      if (result.success) {
        published++;
      } else {
        failed++;
      }
    }

    return NextResponse.json({ published, failed, recovered, total: duePosts.length });
  } catch (error) {
    console.error("Cron publish-scheduled error:", error);
    Sentry.captureException(error, { tags: { cron: "publish-scheduled" } });
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
