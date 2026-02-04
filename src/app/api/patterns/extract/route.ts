import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai/client";
import { corsHeaders, handleCors } from "@/lib/cors";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

interface PostForAnalysis {
  id: string;
  text_content: string;
  metrics: {
    views?: number;
    likes?: number;
    retweets?: number;
    replies?: number;
  };
  post_timestamp: string;
}

interface ExtractedPattern {
  pattern_type: string;
  pattern_name: string;
  pattern_value: string;
  confidence_score: number;
  sample_count: number;
  avg_engagement: number;
  multiplier: number;
  source_post_ids: string[];
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

    // Get user's own posts from captured_posts
    const { data: ownPosts, error: ownPostsError } = await supabase
      .from("captured_posts")
      .select("id, text_content, metrics, post_timestamp")
      .eq("user_id", user.id)
      .eq("is_own_post", true)
      .order("post_timestamp", { ascending: false })
      .limit(100);

    if (ownPostsError) throw ownPostsError;

    // Get niche posts for comparison
    const { data: nichePosts, error: nichePostsError } = await supabase
      .from("niche_posts")
      .select("id, text_content, metrics, post_timestamp")
      .eq("user_id", user.id)
      .order("post_timestamp", { ascending: false })
      .limit(100);

    if (nichePostsError) throw nichePostsError;

    const allPosts: PostForAnalysis[] = [
      ...(ownPosts || []).map(p => ({ ...p, source: "own" })),
      ...(nichePosts || []).map(p => ({ ...p, source: "niche" })),
    ];

    if (allPosts.length < 5) {
      return NextResponse.json(
        { error: "Need at least 5 posts to extract patterns", patterns: [] },
        { status: 400, headers: corsHeaders }
      );
    }

    // Use OpenAI to analyze patterns
    const analysisPrompt = `Analyze these social media posts and identify growth patterns. Look for:

1. HOOK STYLES - How posts start (questions, statements, lists, stories, etc.)
2. FORMATS - Structure patterns (threads, single posts, numbered lists, etc.)
3. TIMING - Day/time patterns in high-performing posts
4. TOPICS - Subject matter that gets high engagement
5. ENGAGEMENT TRIGGERS - Elements that drive replies/shares (controversy, humor, value, etc.)

Posts to analyze:
${allPosts.slice(0, 50).map((p, i) => `
[Post ${i + 1}]
Text: ${p.text_content.slice(0, 500)}
Views: ${p.metrics?.views || 'N/A'}
Likes: ${p.metrics?.likes || 0}
Retweets: ${p.metrics?.retweets || 0}
Replies: ${p.metrics?.replies || 0}
Posted: ${p.post_timestamp || 'Unknown'}
`).join('\n')}

Return a JSON array of patterns found. Each pattern should have:
- pattern_type: one of "hook_style", "format", "timing", "topic", "engagement_trigger"
- pattern_name: short name for the pattern (e.g., "Question Hook", "Tuesday Morning")
- pattern_value: detailed description of the pattern
- confidence_score: 0-1 based on how consistent the pattern is
- avg_engagement: average engagement rate for posts with this pattern
- multiplier: how much better this performs vs average (e.g., 2.3 means 2.3x better)

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
      // Try to parse JSON, handling potential markdown code blocks
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

    // Store patterns in database
    const patternsToInsert = extractedPatterns.map(pattern => ({
      user_id: user.id,
      pattern_type: pattern.pattern_type,
      pattern_name: pattern.pattern_name,
      pattern_value: pattern.pattern_value,
      confidence_score: pattern.confidence_score || 0.5,
      sample_count: allPosts.length,
      avg_engagement: pattern.avg_engagement || 0,
      multiplier: pattern.multiplier || 1.0,
      source_post_ids: allPosts.slice(0, 10).map(p => p.id),
      is_enabled: true,
    }));

    // Delete old patterns and insert new ones
    await supabase
      .from("extracted_patterns")
      .delete()
      .eq("user_id", user.id);

    const { data: insertedPatterns, error: insertError } = await supabase
      .from("extracted_patterns")
      .insert(patternsToInsert)
      .select();

    if (insertError) throw insertError;

    return NextResponse.json(
      {
        patterns: insertedPatterns,
        analyzed_posts: allPosts.length,
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
