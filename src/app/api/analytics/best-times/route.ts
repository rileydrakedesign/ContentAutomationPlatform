import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import type {
  PostingAnalytics,
  PostAnalytics,
  TimeSlot,
  BestTimeRecommendation,
  HeatmapCell,
} from "@/types/analytics";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const MINIMUM_POSTS_FOR_ANALYSIS = 5;
const MINIMUM_POSTS_FOR_HIGH_CONFIDENCE = 10;
const MINIMUM_POSTS_FOR_MEDIUM_CONFIDENCE = 5;

function formatHour(hour: number): string {
  if (hour === 0) return "12 AM";
  if (hour === 12) return "12 PM";
  if (hour < 12) return `${hour} AM`;
  return `${hour - 12} PM`;
}

function getConfidence(
  postCount: number
): "high" | "medium" | "low" {
  if (postCount >= MINIMUM_POSTS_FOR_HIGH_CONFIDENCE) return "high";
  if (postCount >= MINIMUM_POSTS_FOR_MEDIUM_CONFIDENCE) return "medium";
  return "low";
}

// GET /api/analytics/best-times
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

    // Fetch CSV-uploaded analytics data
    const { data: row, error } = await supabase
      .from("user_analytics")
      .select("posts")
      .eq("user_id", user.id)
      .single();

    if (error && error.code !== "PGRST116") throw error;

    const allPosts: PostAnalytics[] = row?.posts || [];
    const validPosts = allPosts.filter((p) => p.date);

    // Not enough data for analysis
    if (validPosts.length < MINIMUM_POSTS_FOR_ANALYSIS) {
      const response: PostingAnalytics = {
        bestTimes: [],
        heatmapData: [],
        totalPostsAnalyzed: validPosts.length,
        hasEnoughData: false,
      };
      return NextResponse.json(response);
    }

    // Group posts by day-of-week and hour
    const timeSlotMap = new Map<string, TimeSlot>();

    for (const post of validPosts) {
      const postDate = new Date(post.date);
      if (isNaN(postDate.getTime())) continue;
      const dayOfWeek = postDate.getDay();
      const hour = postDate.getHours();
      const key = `${dayOfWeek}-${hour}`;
      const engagement = post.engagement_score || 0;

      const existing = timeSlotMap.get(key);
      if (existing) {
        existing.postCount++;
        existing.totalEngagement += engagement;
        existing.avgEngagement = existing.totalEngagement / existing.postCount;
      } else {
        timeSlotMap.set(key, {
          dayOfWeek,
          hour,
          postCount: 1,
          totalEngagement: engagement,
          avgEngagement: engagement,
        });
      }
    }

    // Convert to array and sort by average engagement
    const timeSlots = Array.from(timeSlotMap.values());
    const sortedSlots = [...timeSlots].sort(
      (a, b) => b.avgEngagement - a.avgEngagement
    );

    // Get top 5 best times
    const bestTimes: BestTimeRecommendation[] = sortedSlots
      .slice(0, 5)
      .map((slot) => ({
        dayOfWeek: slot.dayOfWeek,
        hour: slot.hour,
        dayName: DAY_NAMES[slot.dayOfWeek],
        timeDisplay: formatHour(slot.hour),
        avgEngagement: Math.round(slot.avgEngagement),
        postCount: slot.postCount,
        confidence: getConfidence(slot.postCount),
      }));

    // Create heatmap data (normalize engagement values)
    const maxEngagement = Math.max(
      ...timeSlots.map((s) => s.avgEngagement),
      1
    );

    const heatmapData: HeatmapCell[] = timeSlots.map((slot) => ({
      dayOfWeek: slot.dayOfWeek,
      hour: slot.hour,
      value: slot.avgEngagement / maxEngagement,
      postCount: slot.postCount,
    }));

    const response: PostingAnalytics = {
      bestTimes,
      heatmapData,
      totalPostsAnalyzed: validPosts.length,
      hasEnoughData: true,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to fetch best times analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}
