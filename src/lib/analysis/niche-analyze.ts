/**
 * Niche analysis — core logic shared by POST /api/niche/analyze and the
 * one-click Voice Tune-Up (/api/insights/tuneup). Clusters the user's posts
 * into topic groups and produces a niche summary + positioning.
 * Pulls from user_analytics (CSV + API sync) as primary source,
 * captured_posts as supplement.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getOpenAI } from "@/lib/openai/client";
import { getAnalyzablePosts } from "./posts-pool";
import { TopicCluster, NicheProfile } from "@/types/niche";

interface LLMCluster {
  name: string;
  keywords: string[];
  post_indices: number[];
}

interface LLMPositioning {
  target_audience: string;
  unique_angle: string;
  positioning_statement: string;
}

interface LLMResponse {
  clusters: LLMCluster[];
  content_pillars: string[];
  niche_summary: string;
  positioning?: LLMPositioning;
}

export type NicheAnalyzeResult =
  | { ok: true; profile: NicheProfile; posts_analyzed: number }
  | { ok: false; status: 422 | 500; error: string };

export async function analyzeNicheForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<NicheAnalyzeResult> {
  // ── 1. Pull the canonical post pool + topic seeds in parallel ──
  const [posts, patternResult] = await Promise.all([
    getAnalyzablePosts(supabase, userId),
    supabase
      .from("extracted_patterns")
      .select("pattern_value")
      .eq("user_id", userId)
      .eq("pattern_type", "topic")
      .eq("is_enabled", true),
  ]);

  if (posts.length < 10) {
    return {
      ok: false,
      status: 422,
      error:
        "Need at least 10 posts to analyse your niche. Connect your X account or upload a CSV export to get started.",
    };
  }

  // ── 2. Take top 100 (pool is already sorted by weighted engagement) ──
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
5. Describe the creator's positioning:
   - target_audience: who their content serves (one short phrase)
   - unique_angle: what sets their take apart from others in the same niche (one short phrase)
   - positioning_statement: ONE sentence combining audience + angle, e.g. "I help indie founders ship faster by sharing unfiltered build-in-public lessons."

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
  "niche_summary": "string",
  "positioning": {
    "target_audience": "string",
    "unique_angle": "string",
    "positioning_statement": "string"
  }
}

Rules:
- post_indices are 0-based indices into the post list above
- Every post should appear in at most one cluster
- Do not include any text outside the JSON`;

  const completion = await getOpenAI().chat.completions.create({
    model: "gpt-5.4-nano",
    messages: [
      {
        role: "system",
        content:
          "You are an expert content strategist. Analyse posts and identify niches. Return valid JSON only.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    max_completion_tokens: 2000,
  });

  const raw = completion.choices[0]?.message?.content || "{}";

  // ── 6. Parse LLM response ─────────────────────────────────
  let llm: LLMResponse;
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    llm = jsonMatch ? JSON.parse(jsonMatch[0]) : { clusters: [], content_pillars: [], niche_summary: "" };
  } catch {
    console.error("Failed to parse niche analysis response:", raw);
    return { ok: false, status: 500, error: "Failed to parse niche analysis" };
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

  const positioning =
    llm.positioning && llm.positioning.positioning_statement
      ? {
          target_audience: String(llm.positioning.target_audience || ""),
          unique_angle: String(llm.positioning.unique_angle || ""),
          positioning_statement: String(llm.positioning.positioning_statement),
        }
      : null;

  // ── 8. Upsert user_niche_profile ──────────────────────────
  const now = new Date().toISOString();
  const { data: profile, error: upsertError } = await supabase
    .from("user_niche_profile")
    .upsert(
      {
        user_id: userId,
        topic_clusters: topicClusters,
        content_pillars: contentPillars,
        niche_summary: nicheSummary,
        positioning,
        last_analyzed_at: now,
        total_posts_analyzed: posts.length,
        updated_at: now,
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (upsertError) throw upsertError;

  return { ok: true, profile: profile as NicheProfile, posts_analyzed: posts.length };
}
