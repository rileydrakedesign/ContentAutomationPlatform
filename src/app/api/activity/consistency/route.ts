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
// - captured_posts created via extension + x sync (user-owned only)
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

    // 1) captured_posts (own posts + replies)
    // Prefer post_timestamp, fallback to captured_at.
    const { data: captured, error: capturedError } = await supabase
      .from("captured_posts")
      .select("post_timestamp, captured_at, text_content, is_own_post, triaged_as")
      .eq("user_id", user.id)
      // defense: only count user-owned content
      .or("is_own_post.eq.true,triaged_as.eq.my_post");

    if (capturedError) throw capturedError;

    for (const row of captured || []) {
      const dt = safeDate((row as any).post_timestamp) || safeDate((row as any).captured_at);
      if (!dt) continue;
      const key = dateKey(dt);
      if (!map[key]) map[key] = { posts: 0, replies: 0 };

      const text = String((row as any).text_content || "");
      if (isReplyText(text)) map[key].replies += 1;
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
