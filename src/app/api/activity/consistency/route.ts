import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import type { PostAnalytics } from "@/types/analytics";

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

// GET /api/activity/consistency
// Returns daily post/reply activity based on:
// - user_analytics.posts (synced via X API / CSV upload)
// - replies actually sent through the chrome extension (extension_replies)
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

    // 1) user_analytics: X API-synced post data
    const { data: analyticsRow } = await supabase
      .from("user_analytics")
      .select("posts")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    const posts: PostAnalytics[] =
      analyticsRow?.posts && Array.isArray(analyticsRow.posts)
        ? (analyticsRow.posts as PostAnalytics[])
        : [];

    for (const post of posts) {
      const dt = safeDate(post.date);
      if (!dt || dt < since) continue;
      const key = dateKey(dt);
      if (!map[key]) map[key] = { posts: 0, replies: 0 };

      if (post.is_reply) {
        map[key].replies += 1;
      } else {
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
        if (!dt || dt < since) continue;
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
