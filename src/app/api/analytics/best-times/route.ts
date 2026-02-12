import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import type { PostAnalytics, DayOfWeekAnalytics, DayOfWeekStats } from "@/types/analytics";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MINIMUM_POSTS = 5;

function getConfidence(postCount: number): "high" | "medium" | "low" {
  if (postCount >= 10) return "high";
  if (postCount >= 5) return "medium";
  return "low";
}

// GET /api/analytics/best-times
export async function GET() {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: row, error } = await supabase
      .from("user_analytics")
      .select("posts")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    const allPosts: PostAnalytics[] = row?.posts || [];
    const validPosts = allPosts.filter((p) => p.date && !p.is_reply);

    if (validPosts.length < MINIMUM_POSTS) {
      const response: DayOfWeekAnalytics = {
        days: [],
        bestDay: null,
        totalPostsAnalyzed: validPosts.length,
        hasEnoughData: false,
      };
      return NextResponse.json(response);
    }

    // Group by day-of-week only (hours are unreliable from CSV)
    const dayMap = new Map<number, { count: number; engagement: number; impressions: number; likes: number; reposts: number; replies: number }>();

    for (const post of validPosts) {
      const postDate = new Date(post.date);
      if (isNaN(postDate.getTime())) continue;
      const dow = postDate.getDay();
      const existing = dayMap.get(dow);
      const eng = post.engagement_score || 0;

      if (existing) {
        existing.count++;
        existing.engagement += eng;
        existing.impressions += post.impressions || 0;
        existing.likes += post.likes || 0;
        existing.reposts += post.reposts || 0;
        existing.replies += post.replies || 0;
      } else {
        dayMap.set(dow, {
          count: 1,
          engagement: eng,
          impressions: post.impressions || 0,
          likes: post.likes || 0,
          reposts: post.reposts || 0,
          replies: post.replies || 0,
        });
      }
    }

    // Build stats for all 7 days
    const maxAvgEng = Math.max(...Array.from(dayMap.values()).map((d) => d.count > 0 ? d.engagement / d.count : 0), 1);

    const days: DayOfWeekStats[] = Array.from({ length: 7 }, (_, i) => {
      const data = dayMap.get(i);
      const count = data?.count || 0;
      const avgEng = count > 0 ? data!.engagement / count : 0;
      return {
        dayOfWeek: i,
        dayName: DAY_NAMES[i],
        postCount: count,
        avgEngagement: Math.round(avgEng),
        avgImpressions: count > 0 ? Math.round(data!.impressions / count) : 0,
        avgLikes: count > 0 ? Math.round((data!.likes / count) * 10) / 10 : 0,
        avgReposts: count > 0 ? Math.round((data!.reposts / count) * 10) / 10 : 0,
        avgReplies: count > 0 ? Math.round((data!.replies / count) * 10) / 10 : 0,
        totalEngagement: Math.round(data?.engagement || 0),
        value: maxAvgEng > 0 ? avgEng / maxAvgEng : 0,
        confidence: getConfidence(count),
      };
    });

    const bestDay = [...days].sort((a, b) => b.avgEngagement - a.avgEngagement).find((d) => d.postCount > 0) || null;

    const response: DayOfWeekAnalytics = {
      days,
      bestDay,
      totalPostsAnalyzed: validPosts.length,
      hasEnoughData: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch best times analytics:", error);
    return NextResponse.json({ error: "Failed to fetch analytics" }, { status: 500 });
  }
}
