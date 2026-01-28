import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

interface Suggestion {
  id: string;
  type: "pattern" | "timing" | "topic" | "action";
  title: string;
  description: string;
  impact: string;
  action?: string;
  patternId?: string;
}

// GET /api/patterns/suggestions - Get actionable insights based on patterns
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Get user's enabled patterns
    const { data: patterns, error: patternsError } = await supabase
      .from("extracted_patterns")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_enabled", true)
      .order("multiplier", { ascending: false });

    if (patternsError) throw patternsError;

    // Get recent post performance for context
    const { data: recentPosts, error: postsError } = await supabase
      .from("captured_posts")
      .select("metrics, post_timestamp")
      .eq("user_id", user.id)
      .eq("is_own_post", true)
      .order("post_timestamp", { ascending: false })
      .limit(20);

    if (postsError) throw postsError;

    const suggestions: Suggestion[] = [];

    // Generate suggestions from top patterns
    const topPatterns = (patterns || []).slice(0, 3);
    topPatterns.forEach((pattern, index) => {
      if (pattern.multiplier >= 1.5) {
        suggestions.push({
          id: `pattern-${pattern.id}`,
          type: "pattern",
          title: pattern.pattern_name,
          description: pattern.pattern_value,
          impact: `${pattern.multiplier.toFixed(1)}x more engagement`,
          action: "Apply to next post",
          patternId: pattern.id,
        });
      }
    });

    // Find timing patterns
    const timingPatterns = (patterns || []).filter(p => p.pattern_type === "timing");
    if (timingPatterns.length > 0) {
      const bestTiming = timingPatterns[0];
      suggestions.push({
        id: `timing-${bestTiming.id}`,
        type: "timing",
        title: bestTiming.pattern_name,
        description: `Posts during this time get ${bestTiming.multiplier.toFixed(1)}x more engagement`,
        impact: `${bestTiming.multiplier.toFixed(1)}x avg engagement`,
        action: "Schedule for this time",
        patternId: bestTiming.id,
      });
    }

    // Find topic suggestions
    const topicPatterns = (patterns || []).filter(p => p.pattern_type === "topic");
    if (topicPatterns.length > 0) {
      const bestTopic = topicPatterns[0];
      suggestions.push({
        id: `topic-${bestTopic.id}`,
        type: "topic",
        title: `Write about: ${bestTopic.pattern_name}`,
        description: bestTopic.pattern_value,
        impact: `${bestTopic.multiplier.toFixed(1)}x engagement`,
        action: "Create post",
        patternId: bestTopic.id,
      });
    }

    // Calculate overall insights
    const avgViews = recentPosts?.length
      ? recentPosts.reduce((sum, p) => sum + (p.metrics?.views || 0), 0) / recentPosts.length
      : 0;

    const avgLikes = recentPosts?.length
      ? recentPosts.reduce((sum, p) => sum + (p.metrics?.likes || 0), 0) / recentPosts.length
      : 0;

    // Add action suggestion if no patterns yet
    if (suggestions.length === 0) {
      suggestions.push({
        id: "action-extract",
        type: "action",
        title: "Extract your patterns",
        description: "Capture more posts to unlock personalized growth insights",
        impact: "Unlock insights",
        action: "Save posts via extension",
      });
    }

    return NextResponse.json(
      {
        suggestions,
        stats: {
          totalPatterns: patterns?.length || 0,
          avgViews: Math.round(avgViews),
          avgLikes: Math.round(avgLikes),
          postsAnalyzed: recentPosts?.length || 0,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to fetch suggestions:", error);
    return NextResponse.json(
      { error: "Failed to fetch suggestions" },
      { status: 500, headers: corsHeaders }
    );
  }
}
