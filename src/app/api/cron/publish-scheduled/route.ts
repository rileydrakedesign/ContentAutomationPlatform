import { NextRequest, NextResponse } from "next/server";
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

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find all posts due for publishing
    const { data: duePosts, error: queryError } = await supabase
      .from("scheduled_posts")
      .select("id, user_id, content_type, payload, scheduled_for")
      .eq("status", "scheduled")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true });

    if (queryError) throw queryError;
    if (!duePosts || duePosts.length === 0) {
      return NextResponse.json({ published: 0, failed: 0 });
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

    return NextResponse.json({ published, failed, total: duePosts.length });
  } catch (error) {
    console.error("Cron publish-scheduled error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
