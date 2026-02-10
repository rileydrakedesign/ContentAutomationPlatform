import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { createChatCompletion } from "@/lib/ai";

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

    const body = await request.json();
    const question = String(body?.question || "").trim();
    const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

    if (!question) {
      return NextResponse.json({ error: "Missing question" }, { status: 400 });
    }

    // Retrieve relevant user data (keep it small + cheap)
    const [analyticsRes, patternsRes, inspirationsRes] = await Promise.all([
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
    ]);

    // If any tables are missing (e.g. migrations not applied yet), respond gracefully.
    const missingTables: string[] = [];
    const errs = [
      { name: "user_analytics", err: (analyticsRes as any)?.error },
      { name: "extracted_patterns", err: (patternsRes as any)?.error },
      { name: "inspiration_posts", err: (inspirationsRes as any)?.error },
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

    // Analytics snapshot from CSV (sole source for "my posts")
    const csvPosts = (analyticsRes as any)?.data?.posts;
    const arr = Array.isArray(csvPosts) ? csvPosts : [];
    const ownPosts = arr.filter((p: any) => p && p.is_reply === false);
    const replies = arr.filter((p: any) => p && p.is_reply === true);

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
      "If data is missing (e.g., not enough posts for best-times), say exactly what is missing and what to do next. " +
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

    let parsed: any;
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
