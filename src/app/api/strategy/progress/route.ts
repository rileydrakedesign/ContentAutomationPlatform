import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import type { PostAnalytics } from "@/types/analytics";

export async function OPTIONS() {
  return handleCors();
}

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay(); // 0 = Sunday
  const start = new Date(now);
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function safeDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

type PillarTarget = { pillar: string; posts_per_week: number };

// GET /api/strategy/progress — Returns current week's progress vs targets
export async function GET() {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    // Fetch strategy
    const { data: strategyRow } = await supabase
      .from("content_strategy")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const strategy = strategyRow || {
      posts_per_week: 5,
      threads_per_week: 1,
      replies_per_week: 10,
      pillar_targets: [],
    };

    const { start, end } = getWeekBounds();
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    // Count from user_analytics posts (CSV/API synced)
    let postCount = 0;
    let threadCount = 0;
    let replyCount = 0;
    const postTexts: string[] = [];

    const { data: analyticsRow } = await supabase
      .from("user_analytics")
      .select("posts")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    const csvPosts: PostAnalytics[] =
      analyticsRow?.posts && Array.isArray(analyticsRow.posts)
        ? (analyticsRow.posts as PostAnalytics[])
        : [];

    for (const post of csvPosts) {
      const dt = safeDate(post.date);
      if (!dt || dt < start || dt >= end) continue;

      if (post.is_reply) {
        replyCount++;
      } else {
        // CSV doesn't distinguish posts vs threads — count as posts
        postCount++;
        if (post.text) postTexts.push(post.text);
      }
    }

    // Count from captured_posts (X API synced own posts this week)
    const { data: capturedPosts } = await supabase
      .from("captured_posts")
      .select("text_content, post_timestamp")
      .eq("user_id", user.id)
      .eq("is_own_post", true)
      .gte("post_timestamp", startISO)
      .lt("post_timestamp", endISO);

    for (const cp of capturedPosts || []) {
      postCount++;
      if (cp.text_content) postTexts.push(cp.text_content);
    }

    // Count scheduled posts that were posted this week
    const { data: postedScheduled } = await supabase
      .from("scheduled_posts")
      .select("content_type, payload")
      .eq("user_id", user.id)
      .eq("status", "posted")
      .gte("scheduled_for", startISO)
      .lt("scheduled_for", endISO);

    for (const sp of postedScheduled || []) {
      if (sp.content_type === "X_THREAD") {
        threadCount++;
      } else {
        postCount++;
      }
      // Extract text from payload for pillar matching
      const payload = sp.payload as any;
      if (payload?.text) postTexts.push(payload.text);
      if (payload?.tweets && Array.isArray(payload.tweets)) {
        for (const t of payload.tweets) {
          if (t?.text) postTexts.push(t.text);
        }
      }
    }

    // Count extension replies this week
    const { data: extReplies } = await supabase
      .from("extension_replies")
      .select("sent_at")
      .eq("user_id", user.id)
      .gte("sent_at", startISO)
      .lt("sent_at", endISO);

    replyCount += (extReplies || []).length;

    // Pillar progress: simple keyword matching
    const pillarTargets: PillarTarget[] = Array.isArray(strategy.pillar_targets)
      ? (strategy.pillar_targets as PillarTarget[])
      : [];

    const pillarProgress = pillarTargets.map((pt) => {
      const keywords = pt.pillar.toLowerCase().split(/\s+/);
      let actual = 0;
      for (const text of postTexts) {
        const lower = text.toLowerCase();
        if (keywords.some((kw) => lower.includes(kw))) {
          actual++;
        }
      }
      return { pillar: pt.pillar, target: pt.posts_per_week, actual };
    });

    // Pacing: how far through the week are we?
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const weekProgress = Math.max(dayOfWeek, 1) / 7; // at least 1/7

    const totalTarget = strategy.posts_per_week + strategy.threads_per_week + strategy.replies_per_week;
    const totalActual = postCount + threadCount + replyCount;
    const expectedByNow = totalTarget * weekProgress;

    let pacing: "ahead" | "on_track" | "behind" = "on_track";
    if (totalActual >= expectedByNow * 1.2) pacing = "ahead";
    else if (totalActual < expectedByNow * 0.7) pacing = "behind";

    return NextResponse.json({
      posts: { target: strategy.posts_per_week, actual: postCount },
      threads: { target: strategy.threads_per_week, actual: threadCount },
      replies: { target: strategy.replies_per_week, actual: replyCount },
      pillars: pillarProgress,
      pacing,
      week_start: dateKey(start),
    }, { status: 200, headers: corsHeaders });
  } catch (error) {
    console.error("Failed to compute strategy progress:", error);
    return NextResponse.json({ error: "Failed to compute progress" }, { status: 500, headers: corsHeaders });
  }
}
