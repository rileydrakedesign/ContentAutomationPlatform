/**
 * Pattern extraction — core logic shared by POST /api/patterns/extract and
 * the one-click Voice Tune-Up (/api/insights/tuneup). Reads the canonical
 * analyzable-post pool (CSV + captured + synced, one engagement currency).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAI } from "@/lib/openai/client";
import { runThroughGateway } from "@/lib/ai/gateway";
import { getAnalyzablePosts } from "./posts-pool";
import { isGenerationApplicablePattern } from "./pattern-applicability";

interface ExtractedPattern {
  pattern_type: string;
  pattern_name: string;
  pattern_value: string;
  confidence_score: number;
  matched_post_indices: number[];
}

export type PatternExtractResult =
  | { ok: true; patterns: unknown[]; analyzed_posts: number; data_source: "pool" }
  | { ok: false; status: 400 | 500; error: string };

export async function extractPatternsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<PatternExtractResult> {
  // ── 1. Read the canonical post pool ────────────────────────
  const posts = await getAnalyzablePosts(supabase, userId);

  if (posts.length < 5) {
    return {
      ok: false,
      status: 400,
      error:
        "Need at least 5 posts to extract patterns. Connect your X account to sync analytics, or upload a CSV export.",
    };
  }

  // ── 2. Take top 50 (pool is already sorted by weighted engagement) ──
  const topPosts = posts.slice(0, 50);

  const allEngagements = posts.map((p) => p.engagement_score);
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
Impressions: ${p.metrics.impressions}
Likes: ${p.metrics.likes}
Retweets: ${p.metrics.reposts}
Replies: ${p.metrics.replies}
Bookmarks: ${p.metrics.bookmarks}
Engagement score: ${Math.round(p.engagement_score)}
Posted: ${p.posted_at || 'Unknown'}
`).join('\n')}

Return a JSON array of patterns found. Each pattern must have:
- pattern_type: one of "hook_style", "format", "topic", "engagement_trigger"
- pattern_name: short name (e.g., "Question Hook", "Hot Takes")
- pattern_value: actionable description (what to do, not just what you saw)
- confidence_score: 0-1 based on consistency
- matched_post_indices: array of 0-based indices of posts (from the list above) that best match this pattern

Rules:
- matched_post_indices must be valid indices into the provided post list
- aim for 3–12 indices per pattern (fewer is fine if data is sparse)

Return ONLY the JSON array, no other text.`;

  const { value: responseText } = await runThroughGateway({
    provider: "openai",
    model: "gpt-5.4-nano",
    estimatedTokens: Math.ceil(analysisPrompt.length / 4) + 2000,
    meta: { route: "patterns/extract" },
    exec: async () => {
      const completion = await getOpenAI().chat.completions.create({
        model: "gpt-5.4-nano",
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
        max_completion_tokens: 2000,
      });
      return {
        value: completion.choices[0]?.message?.content || "[]",
        usage: {
          input: completion.usage?.prompt_tokens ?? 0,
          output: completion.usage?.completion_tokens ?? 0,
        },
      };
    },
  });

  let extractedPatterns: ExtractedPattern[] = [];
  try {
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      extractedPatterns = JSON.parse(jsonMatch[0]);
    }
  } catch (parseError) {
    console.error("Failed to parse pattern extraction response:", parseError);
    return { ok: false, status: 500, error: "Failed to parse patterns" };
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

    const matchedEngagements = matched.map((p) => p.engagement_score);
    const avg = matchedEngagements.length
      ? matchedEngagements.reduce((sum, v) => sum + v, 0) / matchedEngagements.length
      : 0;

    const multiplier = baselineAvg > 0 ? avg / baselineAvg : 1.0;

    // Provenance for the visible Voice Report: the user's own top posts this
    // pattern was mined from (highest engagement first), with text + score so
    // the report can show "this came from THESE posts, ×N" — not just a claim.
    const sourceExamples = [...matched]
      .sort((a, b) => b.engagement_score - a.engagement_score)
      .slice(0, 3)
      .map((p) => ({
        text: p.text.length > 160 ? `${p.text.slice(0, 157)}...` : p.text,
        engagement_score: Math.round(p.engagement_score),
      }));

    return {
      user_id: userId,
      pattern_type: pattern.pattern_type,
      pattern_name: pattern.pattern_name,
      pattern_value: pattern.pattern_value,
      // Decide once, at extraction time, whether this pattern shapes the text
      // the generation model writes. Timing/post-type/visual patterns are kept
      // (visible in the Voice Report) but not applied to generation.
      applies_to_generation: isGenerationApplicablePattern({
        pattern_type: pattern.pattern_type,
        pattern_name: pattern.pattern_name,
        pattern_value: pattern.pattern_value,
      }),
      confidence_score: pattern.confidence_score || 0.5,
      sample_count: matched.length,
      avg_engagement: Math.round(avg),
      multiplier: Number.isFinite(multiplier) ? multiplier : 1.0,
      source_post_ids: matched.map((p) => p.post_id).filter(Boolean).slice(0, 25),
      source_post_examples: sourceExamples,
      is_enabled: true,
      extraction_batch: new Date().toISOString(),
    };
  });

  // ── 6. Non-destructive insert ──────────────────────────────
  // Disable all existing patterns for this user
  await supabase
    .from("extracted_patterns")
    .update({ is_enabled: false })
    .eq("user_id", userId)
    .eq("is_enabled", true);

  // Insert new batch with is_enabled = true
  const { data: insertedPatterns, error: insertError } = await supabase
    .from("extracted_patterns")
    .insert(patternsToInsert)
    .select();

  if (insertError) throw insertError;

  return {
    ok: true,
    patterns: insertedPatterns ?? [],
    analyzed_posts: posts.length,
    data_source: "pool",
  };
}
