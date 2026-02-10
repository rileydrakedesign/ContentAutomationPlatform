import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai/client";
import { corsHeaders, handleCors } from "@/lib/cors";
import { weightedEngagement } from "@/lib/utils/engagement";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

interface PostForAnalysis {
  text: string;
  impressions: number;
  likes: number;
  retweets: number;
  replies: number;
  bookmarks: number;
  engagement: number;
  posted_at: string;
}

interface ExtractedPattern {
  pattern_type: string;
  pattern_name: string;
  pattern_value: string;
  confidence_score: number;
  matched_post_indices: number[];
}

// POST /api/patterns/extract - Trigger pattern extraction from posts
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    // ── 1. Try CSV data first ──────────────────────────────────
    let posts: PostForAnalysis[] = [];
    let dataSource: "csv" | "captured" = "csv";

    const { data: analyticsRow } = await supabase
      .from("user_analytics")
      .select("posts")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    if (analyticsRow?.posts && Array.isArray(analyticsRow.posts)) {
      const csvPosts = (analyticsRow.posts as Array<Record<string, unknown>>)
        .filter((p) => !p.is_reply)
        .map((p) => {
          const m = {
            likes: Number(p.likes) || 0,
            reposts: Number(p.reposts) || 0,
            replies: Number(p.replies) || 0,
            bookmarks: Number(p.bookmarks) || 0,
            impressions: Number(p.impressions) || 0,
          };
          return {
            text: String(p.text || ""),
            impressions: m.impressions,
            likes: m.likes,
            retweets: m.reposts,
            replies: m.replies,
            bookmarks: m.bookmarks,
            engagement: weightedEngagement(m),
            posted_at: String(p.date || ""),
          };
        })
        .filter((p) => p.text.length >= 10);

      if (csvPosts.length >= 5) {
        posts = csvPosts;
      }
    }

    // ── 2. Fallback to captured_posts (own posts only) ─────────
    if (posts.length === 0) {
      dataSource = "captured";
      const { data: ownPosts, error: ownPostsError } = await supabase
        .from("captured_posts")
        .select("text_content, metrics, post_timestamp")
        .eq("user_id", user.id)
        .eq("is_own_post", true)
        .order("post_timestamp", { ascending: false })
        .limit(200);

      if (ownPostsError) throw ownPostsError;

      posts = (ownPosts || []).map((p) => {
        const m = (p.metrics || {}) as Record<string, number | undefined>;
        return {
          text: p.text_content,
          impressions: m.views ?? 0,
          likes: m.likes ?? 0,
          retweets: m.retweets ?? 0,
          replies: m.replies ?? 0,
          bookmarks: m.bookmarks ?? 0,
          engagement: weightedEngagement(m),
          posted_at: p.post_timestamp || "",
        };
      });
    }

    if (posts.length < 5) {
      return NextResponse.json(
        { error: "Need at least 5 posts to extract patterns", patterns: [] },
        { status: 400, headers: corsHeaders }
      );
    }

    // ── 3. Sort by engagement DESC, take top 50 ───────────────
    posts.sort((a, b) => b.engagement - a.engagement);
    const topPosts = posts.slice(0, 50);

    const allEngagements = posts.map((p) => p.engagement);
    const baselineAvg =
      allEngagements.reduce((sum, v) => sum + v, 0) / allEngagements.length;

    // ── 4. Send to GPT-4o-mini ─────────────────────────────────
    const analysisPrompt = `Analyze these social media posts and identify growth patterns. Look for:

1. HOOK STYLES - How posts start (questions, statements, lists, stories, etc.)
2. FORMATS - Structure patterns (threads, single posts, numbered lists, etc.)
3. TIMING - Day/time patterns in high-performing posts
4. TOPICS - Subject matter that gets high engagement
5. ENGAGEMENT TRIGGERS - Elements that drive replies/shares (controversy, humor, value, etc.)

Posts to analyze (sorted best-performing first):
${topPosts.map((p, i) => `
[Post ${i + 1}]
Text: ${p.text.slice(0, 500)}
Impressions: ${p.impressions}
Likes: ${p.likes}
Retweets: ${p.retweets}
Replies: ${p.replies}
Bookmarks: ${p.bookmarks}
Engagement score: ${Math.round(p.engagement)}
Posted: ${p.posted_at || 'Unknown'}
`).join('\n')}

Return a JSON array of patterns found. Each pattern must have:
- pattern_type: one of "hook_style", "format", "timing", "topic", "engagement_trigger"
- pattern_name: short name (e.g., "Question Hook", "Tuesday Morning")
- pattern_value: actionable description (what to do, not just what you saw)
- confidence_score: 0-1 based on consistency
- matched_post_indices: array of 0-based indices of posts (from the list above) that best match this pattern

Rules:
- matched_post_indices must be valid indices into the provided post list
- aim for 3–12 indices per pattern (fewer is fine if data is sparse)

Return ONLY the JSON array, no other text.`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an expert social media analyst. Analyze posts and extract actionable growth patterns. Return valid JSON only.",
        },
        {
          role: "user",
          content: analysisPrompt,
        },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const responseText = completion.choices[0]?.message?.content || "[]";

    let extractedPatterns: ExtractedPattern[] = [];
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        extractedPatterns = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse pattern extraction response:", parseError);
      return NextResponse.json(
        { error: "Failed to parse patterns", patterns: [] },
        { status: 500, headers: corsHeaders }
      );
    }

    // ── 5. Compute per-pattern multiplier ──────────────────────
    const patternsToInsert = extractedPatterns.map((pattern) => {
      const idxs = Array.isArray(pattern.matched_post_indices)
        ? pattern.matched_post_indices.filter((n) => Number.isFinite(n))
        : [];

      const matched = idxs
        .map((i) => topPosts[i])
        .filter(Boolean)
        .slice(0, 50);

      const matchedEngagements = matched.map((p) => p.engagement);
      const avg = matchedEngagements.length
        ? matchedEngagements.reduce((sum, v) => sum + v, 0) / matchedEngagements.length
        : 0;

      const multiplier = baselineAvg > 0 ? avg / baselineAvg : 1.0;

      return {
        user_id: user.id,
        pattern_type: pattern.pattern_type,
        pattern_name: pattern.pattern_name,
        pattern_value: pattern.pattern_value,
        confidence_score: pattern.confidence_score || 0.5,
        sample_count: matched.length,
        avg_engagement: Math.round(avg),
        multiplier: Number.isFinite(multiplier) ? multiplier : 1.0,
        source_post_ids: [] as string[],
        is_enabled: true,
        extraction_batch: new Date().toISOString(),
      };
    });

    // ── 6. Non-destructive insert ──────────────────────────────
    // Disable all existing patterns for this user
    await supabase
      .from("extracted_patterns")
      .update({ is_enabled: false })
      .eq("user_id", user.id);

    // Insert new batch with is_enabled = true
    const { data: insertedPatterns, error: insertError } = await supabase
      .from("extracted_patterns")
      .insert(patternsToInsert)
      .select();

    if (insertError) throw insertError;

    return NextResponse.json(
      {
        patterns: insertedPatterns,
        analyzed_posts: posts.length,
        data_source: dataSource,
      },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to extract patterns:", error);
    return NextResponse.json(
      { error: "Failed to extract patterns" },
      { status: 500, headers: corsHeaders }
    );
  }
}
