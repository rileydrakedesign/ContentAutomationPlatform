import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import type {
  PostingAnalytics,
  TimeSlot,
  BestTimeRecommendation,
  HeatmapCell,
} from "@/types/analytics";
import type { PostMetrics } from "@/types/captured";

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

function calculateEngagement(metrics: PostMetrics): number {
  const likes = metrics.likes || 0;
  const retweets = metrics.retweets || 0;
  const replies = metrics.replies || 0;
  // Weighted: likes + retweets*2 + replies*3
  return likes + retweets * 2 + replies * 3;
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

    // Fetch posts that are marked as own posts with timestamp
    const { data: posts, error } = await supabase
      .from("captured_posts")
      .select("post_timestamp, metrics")
      .eq("user_id", user.id)
      .eq("triaged_as", "my_post")
      .not("post_timestamp", "is", null);

    if (error) throw error;

    const validPosts = posts || [];

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
      const postDate = new Date(post.post_timestamp);
      const dayOfWeek = postDate.getDay();
      const hour = postDate.getHours();
      const key = `${dayOfWeek}-${hour}`;
      const engagement = calculateEngagement(post.metrics || {});

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
