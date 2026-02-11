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
// - posts actually posted through the app (captured_posts backfill)
// - replies actually sent through the chrome extension (extension_replies)
//
// Scheduled posts are NOT counted until they are posted.
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

    // 1) captured_posts: count posts that were actually posted through the app
    // (publish worker backfills captured_posts only after success)
    const { data: posted, error: postedErr } = await supabase
      .from("captured_posts")
      .select("post_timestamp, captured_at, text_content")
      .eq("user_id", user.id)
      .eq("is_own_post", true);

    if (postedErr) throw postedErr;

    for (const row of posted || []) {
      const dt = safeDate((row as any).post_timestamp) || safeDate((row as any).captured_at);
      if (!dt) continue;
      if (dt < since) continue;
      const key = dateKey(dt);
      if (!map[key]) map[key] = { posts: 0, replies: 0 };

      const text = String((row as any).text_content || "");
      if (!isReplyText(text)) {
        map[key].posts += 1;
      }
    }

    // 2) extension_replies: count replies actually sent via extension
    const { data: extReplies, error: extErr } = await supabase
      .from("extension_replies")
      .select("sent_at")
      .eq("user_id", user.id);

    // If table isn't present yet, keep dashboard functional.
    if (!extErr) {
      for (const row of extReplies || []) {
        const dt = safeDate((row as any).sent_at);
        if (!dt) continue;
        if (dt < since) continue;
        const key = dateKey(dt);
        if (!map[key]) map[key] = { posts: 0, replies: 0 };
        map[key].replies += 1;
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
