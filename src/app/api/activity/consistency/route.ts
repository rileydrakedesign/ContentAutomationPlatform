import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

type ActivityDay = {
  date: string; // YYYY-MM-DD
  posts: number;
  replies: number;
};

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function safeDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

function isReplyText(text: string): boolean {
  return text.trim().startsWith("@");
}

// GET /api/activity/consistency
// Returns daily post/reply activity based on:
// - user_analytics CSV (sole source of truth for "my posts" and "my replies")
// - scheduled_posts created via Agent for X publish scheduler
export async function GET() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const map: Record<string, { posts: number; replies: number }> = {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const since = new Date(today);
    since.setDate(since.getDate() - 90);

    // 1) user_analytics (CSV)
    const { data: analyticsRow, error: analyticsErr } = await supabase
      .from("user_analytics")
      .select("posts")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    if (analyticsErr && analyticsErr.code !== "PGRST116") throw analyticsErr;

    const csvPosts = (analyticsRow?.posts && Array.isArray(analyticsRow.posts))
      ? (analyticsRow.posts as Array<Record<string, unknown>>)
      : [];

    for (const row of csvPosts) {
      const dateStr = String((row as any).date || "");
      const dt = safeDate(dateStr);
      if (!dt) continue;
      if (dt < since) continue;
      const key = dateKey(dt);
      if (!map[key]) map[key] = { posts: 0, replies: 0 };

      const isReply = Boolean((row as any).is_reply);
      if (isReply) map[key].replies += 1;
      else map[key].posts += 1;
    }

    // 2) scheduled_posts (count scheduled content as posts on the scheduled_for day)
    // Note: we do not attempt de-dup against captured_posts.
    const { data: scheduled, error: scheduledError } = await supabase
      .from("scheduled_posts")
      .select("scheduled_for, content_type, status")
      .eq("user_id", user.id)
      .in("status", ["scheduled", "publishing", "posted"]);

    // If scheduled_posts table isn't present yet, don't hard-fail the dashboard.
    if (!scheduledError) {
      for (const row of scheduled || []) {
        const dt = safeDate((row as any).scheduled_for);
        if (!dt) continue;
        if (dt < since) continue;
        if (dt > today) continue; // don't count future scheduled posts as completed activity
        const key = dateKey(dt);
        if (!map[key]) map[key] = { posts: 0, replies: 0 };
        map[key].posts += 1;
      }
    }

    const days: ActivityDay[] = Object.entries(map)
      .map(([date, v]) => ({ date, posts: v.posts, replies: v.replies }))
      .sort((a, b) => (a.date < b.date ? -1 : 1));

    return NextResponse.json({ days });
  } catch (error) {
    console.error("Failed to compute consistency activity:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
