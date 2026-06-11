import { withApiAuth, apiSuccess, apiOptions } from "@/lib/api/v1-handler";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { PostAnalytics, DayOfWeekAnalytics, DayOfWeekStats } from "@/types/analytics";
import {
  CREDIT_COSTS,
  requireCredits,
  withCreditHeaders,
} from "@/lib/billing/credits";

export const OPTIONS = apiOptions;

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MINIMUM_POSTS = 5;

function getConfidence(postCount: number): "high" | "medium" | "low" {
  if (postCount >= 10) return "high";
  if (postCount >= 5) return "medium";
  return "low";
}

// GET /api/v1/analytics/best-times — Best posting days from CSV analytics.
// 1 credit (DB read, same rate as /analytics).
export const GET = withApiAuth(["analytics:read"], async ({ auth }) => {
  const charge = await requireCredits(
    auth.userId,
    CREDIT_COSTS["analytics.read"],
    "analytics.read"
  );
  if (charge instanceof NextResponse) return charge;

  const supabase = createAdminClient();
  const { data: row, error } = await supabase
    .from("user_analytics")
    .select("posts")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) throw error;

  const allPosts: PostAnalytics[] = row?.posts || [];
  const validPosts = allPosts.filter((p) => p.date && !p.is_reply);

  if (validPosts.length < MINIMUM_POSTS) {
    const response: DayOfWeekAnalytics = {
      days: [],
      bestDay: null,
      totalPostsAnalyzed: validPosts.length,
      hasEnoughData: false,
    };
    return withCreditHeaders(apiSuccess(response), charge);
  }

  const dayMap = new Map<
    number,
    { count: number; engagement: number; impressions: number; likes: number; reposts: number; replies: number }
  >();

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

  const maxAvgEng = Math.max(
    ...Array.from(dayMap.values()).map((d) => (d.count > 0 ? d.engagement / d.count : 0)),
    1
  );

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

  const bestDay =
    [...days].sort((a, b) => b.avgEngagement - a.avgEngagement).find((d) => d.postCount > 0) ||
    null;

  const response: DayOfWeekAnalytics = {
    days,
    bestDay,
    totalPostsAnalyzed: validPosts.length,
    hasEnoughData: true,
  };

  return withCreditHeaders(apiSuccess(response), charge);
});
