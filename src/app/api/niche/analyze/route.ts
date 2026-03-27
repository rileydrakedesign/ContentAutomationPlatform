import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getOpenAI } from "@/lib/openai/client";
import { corsHeaders, handleCors } from "@/lib/cors";
import { weightedEngagement } from "@/lib/utils/engagement";
import { TopicCluster } from "@/types/niche";
import { requireAiGeneration } from "@/lib/stripe/gate";

export async function OPTIONS() {
  return handleCors();
}

interface PostForAnalysis {
  post_id: string;
  text: string;
  engagement_score: number;
}

interface LLMCluster {
  name: string;
  keywords: string[];
  post_indices: number[];
}

interface LLMResponse {
  clusters: LLMCluster[];
  content_pillars: string[];
  niche_summary: string;
}

// POST /api/niche/analyze — Cluster user's posts into topic groups and produce a niche summary.
// Pulls from user_analytics (CSV + API sync) as primary source, captured_posts as supplement.
export async function POST() {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: corsHeaders }
      );
    }

    const gateError = await requireAiGeneration(user.id, "niche-analyze");
    if (gateError) return gateError;

    // ── 1. Pull data in parallel ───────────────────────────────
    const [analyticsResult, capturedResult, patternResult] = await Promise.all([
      supabase
        .from("user_analytics")
        .select("posts")
        .eq("user_id", user.id)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("captured_posts")
        .select("x_post_id, text_content, metrics")
        .eq("user_id", user.id)
        .eq("is_own_post", true)
        .order("post_timestamp", { ascending: false })
        .limit(200),
      supabase
        .from("extracted_patterns")
        .select("pattern_value")
        .eq("user_id", user.id)
        .eq("pattern_type", "topic")
        .eq("is_enabled", true),
    ]);

    // ── 2. Build deduplicated post list ────────────────────────
    // user_analytics is primary (CSV + API sync). captured_posts supplements posts not already there.
    const seenIds = new Set<string>();
    const posts: PostForAnalysis[] = [];

    // Primary: user_analytics.posts (PostAnalytics[])
    if (analyticsResult.data?.posts && Array.isArray(analyticsResult.data.posts)) {
      for (const p of analyticsResult.data.posts as Array<Record<string, unknown>>) {
        if (p.is_reply) continue;
        const text = String(p.text || "").trim();
        if (text.length < 10) continue;

        const postId = String(p.post_id || p.id || "");
        if (postId) seenIds.add(postId);

        posts.push({
          post_id: postId,
          text,
          engagement_score: Number(p.engagement_score) || weightedEngagement({
            likes: Number(p.likes) || 0,
            reposts: Number(p.reposts) || 0,
            replies: Number(p.replies) || 0,
            bookmarks: Number(p.bookmarks) || 0,
            impressions: Number(p.impressions) || 0,
          }),
        });
      }
    }

    // Supplement: captured_posts (extension + /api/x/sync) — skip if already in user_analytics
    if (capturedResult.data) {
      for (const p of capturedResult.data) {
        const xId = p.x_post_id || "";
        if (xId && seenIds.has(xId)) continue;

        const text = String(p.text_content || "").trim();
        if (text.length < 10) continue;

        const m = (p.metrics as Record<string, number>) || {};
        posts.push({
          post_id: xId,
          text,
          engagement_score: weightedEngagement({
            likes: m.likes || 0,
            reposts: m.retweets || 0,
            replies: m.replies || 0,
            bookmarks: m.bookmarks || 0,
            impressions: m.views || 0,
          }),
        });
      }
    }

    if (posts.length < 10) {
      return NextResponse.json(
        {
          error:
            "Need at least 10 posts to analyse your niche. Connect your X account or upload a CSV export to get started.",
        },
        { status: 422, headers: corsHeaders }
      );
    }

    // ── 3. Sort by engagement, take top 100 ───────────────────
    posts.sort((a, b) => b.engagement_score - a.engagement_score);
    const topPosts = posts.slice(0, 100);

    // ── 4. Collect topic keyword seeds from existing patterns ──
    const topicSeeds: string[] = [];
    if (patternResult.data) {
      for (const row of patternResult.data) {
        if (row.pattern_value) topicSeeds.push(String(row.pattern_value));
      }
    }

    // ── 5. Build LLM prompt ───────────────────────────────────
    const seedsSection =
      topicSeeds.length > 0
        ? `\nExisting topic keywords (use as clustering hints, not constraints):\n${topicSeeds.slice(0, 20).join(", ")}\n`
        : "";

    const prompt = `You are analysing a content creator's posts to identify their niche and content pillars.
${seedsSection}
Posts to analyse (top ${topPosts.length} by engagement):
${topPosts
  .map(
    (p, i) =>
      `[${i + 1}] engagement=${Math.round(p.engagement_score)} | ${p.text.slice(0, 300)}`
  )
  .join("\n")}

Task:
1. Group these posts into 3-6 topic clusters. Each cluster should represent a coherent theme the creator posts about.
2. For each cluster, list the 3-8 keywords that best describe it.
3. List 3-5 top-level "content pillars" (one or two words each) that capture the creator's main areas.
4. Write a 1-2 sentence niche summary describing who this creator is and what they consistently post about.

Return ONLY valid JSON in this exact shape:
{
  "clusters": [
    {
      "name": "string",
      "keywords": ["string"],
      "post_indices": [0, 1, 2]
    }
  ],
  "content_pillars": ["string"],
  "niche_summary": "string"
}

Rules:
- post_indices are 0-based indices into the post list above
- Every post should appear in at most one cluster
- Do not include any text outside the JSON`;

    const completion = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are an expert content strategist. Analyse posts and identify niches. Return valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 2000,
    });

    const raw = completion.choices[0]?.message?.content || "{}";

    // ── 6. Parse LLM response ─────────────────────────────────
    let llm: LLMResponse;
    try {
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      llm = jsonMatch ? JSON.parse(jsonMatch[0]) : { clusters: [], content_pillars: [], niche_summary: "" };
    } catch {
      console.error("Failed to parse niche analysis response:", raw);
      return NextResponse.json(
        { error: "Failed to parse niche analysis" },
        { status: 500, headers: corsHeaders }
      );
    }

    // ── 7. Build TopicCluster[] ───────────────────────────────
    const totalPosts = topPosts.length;

    const topicClusters: TopicCluster[] = (llm.clusters || []).map((cluster) => {
      const idxs = Array.isArray(cluster.post_indices)
        ? cluster.post_indices.filter((n) => Number.isFinite(n) && n >= 0 && n < topPosts.length)
        : [];

      const matched = idxs.map((i) => topPosts[i]).filter(Boolean);
      const avgEngagement =
        matched.length > 0
          ? Math.round(matched.reduce((s, p) => s + p.engagement_score, 0) / matched.length)
          : 0;

      return {
        name: String(cluster.name || "Untitled"),
        keywords: Array.isArray(cluster.keywords) ? cluster.keywords.map(String) : [],
        post_count: matched.length,
        avg_engagement: avgEngagement,
        top_post_ids: matched
          .slice(0, 5)
          .map((p) => p.post_id)
          .filter(Boolean),
        share_pct: totalPosts > 0 ? Math.round((matched.length / totalPosts) * 100) : 0,
      };
    });

    const contentPillars = Array.isArray(llm.content_pillars)
      ? llm.content_pillars.map(String).slice(0, 5)
      : [];

    const nicheSummary = llm.niche_summary ? String(llm.niche_summary) : null;

    // ── 8. Upsert user_niche_profile ──────────────────────────
    const now = new Date().toISOString();
    const { data: profile, error: upsertError } = await supabase
      .from("user_niche_profile")
      .upsert(
        {
          user_id: user.id,
          topic_clusters: topicClusters,
          content_pillars: contentPillars,
          niche_summary: nicheSummary,
          last_analyzed_at: now,
          total_posts_analyzed: posts.length,
          updated_at: now,
        },
        { onConflict: "user_id" }
      )
      .select()
      .single();

    if (upsertError) throw upsertError;

    return NextResponse.json(
      { profile, posts_analyzed: posts.length },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("Failed to analyse niche:", error);
    return NextResponse.json(
      { error: "Failed to analyse niche" },
      { status: 500, headers: corsHeaders }
    );
  }
}
