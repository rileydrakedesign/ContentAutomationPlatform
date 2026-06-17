import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;
import { createAuthClient } from "@/lib/supabase/server";
import { createChatCompletion } from "@/lib/ai";
import { requireFeature, requireAiGeneration } from "@/lib/stripe/gate";

type ChatTurn = { role: "user" | "assistant"; content: string };

function clamp(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max) + "…";
}

// POST /api/insights-chat
// Answers questions using *retrieved* user data (no web).
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Insights chat requires Pro plan
    const featureGate = await requireFeature(user.id, "insightsChat");
    if (featureGate) return featureGate;

    const aiGate = await requireAiGeneration(user.id, "insights-chat");
    if (aiGate) return aiGate;

    const body = await request.json();
    const question = String(body?.question || "").trim();
    const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    // Retrieve relevant user data (keep it small + cheap)
    const [analyticsRes, patternsRes, inspirationsRes, nicheRes, strategyRes] = await Promise.all([
      supabase
        .from("user_analytics")
        .select("posts")
        .eq("user_id", user.id)
        .order("uploaded_at", { ascending: false })
        .limit(1)
        .single(),
      supabase
        .from("extracted_patterns")
        .select("pattern_type, pattern_name, pattern_value, multiplier, confidence_score")
        .eq("user_id", user.id)
        .eq("is_enabled", true)
        .limit(50),
      supabase
        .from("inspiration_posts")
        .select("id, raw_content, author_handle, source_url, created_at, is_pinned, note")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase
        .from("user_niche_profile")
        .select("niche_summary, content_pillars, positioning")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("content_strategy")
        .select("posts_per_week, threads_per_week, replies_per_week, pillar_targets")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);

    // If any tables are missing (e.g. migrations not applied yet), respond gracefully.
    const missingTables: string[] = [];
    const errs = [
      { name: "user_analytics", err: (analyticsRes as { error?: { message?: string; code?: string } })?.error },
      { name: "extracted_patterns", err: (patternsRes as { error?: { message?: string; code?: string } })?.error },
      { name: "inspiration_posts", err: (inspirationsRes as { error?: { message?: string; code?: string } })?.error },
    ];
    for (const e of errs) {
      const msg = String(e.err?.message || "");
      if (msg.includes("Could not find the table") || e.err?.code === "PGRST205") {
        missingTables.push(e.name);
      }
    }

    if (missingTables.length > 0) {
      return NextResponse.json({
        answer:
          `I can’t answer yet because your database is missing required tables: ${missingTables.join(", ")}.\n\n` +
          `Next step: apply the Supabase migrations for this app, then retry.`,
        sources_used: ["db: schema missing (apply migrations)"]
      });
    }

    // Build a compact “knowledge bundle” as markdown
    const sourcesMd: string[] = [];

    // Niche, positioning & strategy — the same tuned context generation uses,
    // so the advice surface stays aligned with the tuner.
    const niche = nicheRes.data as {
      niche_summary?: string | null;
      content_pillars?: string[] | null;
      positioning?: { target_audience?: string; unique_angle?: string; positioning_statement?: string } | null;
    } | null;
    const strategy = strategyRes.data as {
      posts_per_week?: number;
      threads_per_week?: number;
      replies_per_week?: number;
      pillar_targets?: Array<{ pillar: string; posts_per_week: number }>;
    } | null;

    sourcesMd.push(
      `# NICHE_AND_POSITIONING\n` +
        (niche?.niche_summary ? `summary: ${niche.niche_summary}\n` : "") +
        (niche?.positioning?.positioning_statement
          ? `positioning: ${niche.positioning.positioning_statement}\n` +
            (niche.positioning.target_audience ? `audience: ${niche.positioning.target_audience}\n` : "") +
            (niche.positioning.unique_angle ? `unique angle: ${niche.positioning.unique_angle}\n` : "")
          : "") +
        (niche?.content_pillars?.length ? `pillars: ${niche.content_pillars.join(", ")}\n` : "") +
        (!niche?.niche_summary && !niche?.positioning ? "(not analyzed yet — suggest running a Voice Tune-Up)\n" : "")
    );

    sourcesMd.push(
      `# CONTENT_STRATEGY\n` +
        (strategy
          ? `posts/week: ${strategy.posts_per_week ?? 0}, threads/week: ${strategy.threads_per_week ?? 0}, replies/week: ${strategy.replies_per_week ?? 0}\n` +
            (strategy.pillar_targets?.length
              ? `pillar targets: ${strategy.pillar_targets.map((t) => `${t.pillar} (${t.posts_per_week}/wk)`).join(", ")}\n`
              : "")
          : "(no strategy set)\n")
    );

    // Analytics snapshot from CSV (sole source for "my posts")
    const csvPosts = (analyticsRes as { data?: { posts?: unknown } })?.data?.posts;
    const arr = Array.isArray(csvPosts) ? csvPosts : [];
    const ownPosts = arr.filter((p) => p && p.is_reply === false);
    const replies = arr.filter((p) => p && p.is_reply === true);

    sourcesMd.push(
      `# USER_ANALYTICS_SNAPSHOT\n` +
        `csv posts: ${ownPosts.length}\n` +
        `csv replies: ${replies.length}\n` +
        `note: timing insights depend on valid dates in the CSV.\n`
    );

    // Patterns
    const patterns = patternsRes.data || [];
    sourcesMd.push(
      `# EXTRACTED_PATTERNS_ENABLED\n` +
        (patterns.length
          ? patterns
              .map((p) =>
                `- [${p.pattern_type}] ${p.pattern_name} (x${p.multiplier ?? 1}) — ${clamp(String(p.pattern_value || ""), 240)}`
              )
              .join("\n")
          : "(none)"
        ) +
        `\n`
    );

    // Inspirations
    const insp = (inspirationsRes.data || []) as Array<{
      raw_content: string | null;
      author_handle: string | null;
      source_url: string | null;
      created_at: string;
      is_pinned: boolean | null;
      note: string | null;
    }>;

    sourcesMd.push(
      `# INSPIRATION_POSTS_RECENT\n` +
        (insp.length
          ? insp
              .map((i) => {
                const author = i.author_handle ? `@${i.author_handle}` : "unknown";
                const url = i.source_url || "";
                const pinned = i.is_pinned ? " (pinned)" : "";
                const note = i.note ? `\n  note: ${clamp(String(i.note), 140)}` : "";
                return `- ${author}${pinned}${url ? ` — ${url}` : ""}\n  ${clamp(String(i.raw_content || ""), 280)}${note}`;
              })
              .join("\n")
          : "(none)"
        ) +
        `\n`
    );

    const knowledgeBundle = sourcesMd.join("\n---\n\n");

    const system =
      "You are a strategic content assistant for an X power-user. " +
      "You must answer using ONLY the provided internal knowledge bundle. " +
      "Anchor advice in the user's niche, positioning, proven patterns, and strategy targets from the bundle — the same tuned context their content generation uses. " +
      "If data is missing (e.g., not enough posts for best-times, or no niche analyzed), say exactly what is missing and what to do next (often: run a Voice Tune-Up). " +
      "Be concrete and concise. Provide actionable next steps. " +
      "Return JSON: { answer: string, sources_used: string[] }.";

    const userPrompt =
      `QUESTION:\n${question}\n\n` +
      `KNOWLEDGE_BUNDLE (internal):\n${knowledgeBundle}`;

    const trimmedHistory = history.slice(-6).map((t) => ({ role: t.role, content: String(t.content || "") }));

    const result = await createChatCompletion({
      provider: "openai",
      modelTier: "fast",
      messages: [
        { role: "system", content: system },
        ...trimmedHistory,
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 600,
      jsonResponse: true,
    });

    let parsed: { answer?: string; sources_used?: string[] };
    try {
      parsed = JSON.parse(result.content);
    } catch {
      parsed = { answer: result.content, sources_used: [] };
    }

    return NextResponse.json({
      answer: String(parsed.answer || ""),
      sources_used: Array.isArray(parsed.sources_used) ? parsed.sources_used : [],
    });
  } catch (error) {
    console.error("insights-chat failed:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
