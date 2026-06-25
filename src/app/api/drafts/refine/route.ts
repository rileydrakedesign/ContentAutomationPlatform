import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireAiGeneration } from "@/lib/stripe/gate";
import { guardLlmRoute, withLlmRateLimitHeaders } from "@/lib/api/with-llm-guard";
import { getAssembledPromptForUser } from "@/lib/openai/prompts/prompt-assembler";
import { getClaude } from "@/lib/ai/providers/claude";
import { runThroughGateway } from "@/lib/ai/gateway";
import {
  cleanDraft,
  splitThread,
  PIPELINE_MODEL,
  type DraftType,
} from "@/lib/ai/agentic/post-pipeline";

export const maxDuration = 60;

export async function OPTIONS() {
  return handleCors();
}

// POST /api/drafts/refine
// Lightweight, mode-agnostic refinement: take an existing draft (Quick or
// Agent) and revise it per the user's feedback in a single Claude call. Does
// NOT run research or the agentic pipeline. Costs 1 daily generation slot.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const guard = await guardLlmRoute({ request, userId: user.id });
    if (!guard.ok) return guard.response;

    const gateError = await requireAiGeneration(user.id, "drafts-refine");
    if (gateError) return gateError;

    const body = await request.json();
    const { text, tweets, draftType = "X_POST", feedback, topic } = body as {
      text?: string;
      tweets?: string[];
      draftType?: DraftType;
      feedback?: string;
      topic?: string;
    };

    const current =
      draftType === "X_THREAD" && Array.isArray(tweets)
        ? tweets.join("\n---\n")
        : String(text || "");

    if (!current.trim()) {
      return NextResponse.json({ error: "Nothing to refine" }, { status: 400, headers: corsHeaders });
    }
    if (!feedback || !feedback.trim()) {
      return NextResponse.json(
        { error: "Refinement feedback is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // Scoped voice prompt (default patterns not force-injected).
    const systemPrompt = await getAssembledPromptForUser(supabase, user.id, "post", {
      includePatterns: false,
    });

    const userPrompt = [
      `Here is the current ${draftType === "X_THREAD" ? "thread" : "post"}${topic ? ` (about "${topic}")` : ""}:`,
      `"""\n${current}\n"""`,
      `Revise it according to this feedback. The feedback is an explicit instruction and takes priority over default voice tendencies — apply it fully, even where it changes length, format, or structure:`,
      feedback.trim(),
      `Keep the user's voice for tone, vocabulary, and personality, and preserve any specific facts. Don't change things the feedback didn't ask about.${
        draftType === "X_THREAD" ? ` Separate each post with a line containing only "---".` : ""
      }`,
      `Output ONLY the revised post text — no preamble, no surrounding quotes, no explanation, no JSON.`,
    ].join("\n\n");

    const { value: response } = await runThroughGateway({
      provider: "claude",
      model: PIPELINE_MODEL,
      estimatedTokens: Math.ceil((systemPrompt.length + userPrompt.length) / 4) + 1200,
      meta: { route: "drafts/refine", userId: user.id },
      exec: async () => {
        const r = await getClaude().messages.create({
          model: PIPELINE_MODEL,
          max_tokens: 1200,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });
        return { value: r, usage: { input: r.usage.input_tokens, output: r.usage.output_tokens } };
      },
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const refined = cleanDraft(textBlock && textBlock.type === "text" ? textBlock.text : "");

    if (!refined) {
      return NextResponse.json(
        { error: "Refinement produced no content" },
        { status: 500, headers: corsHeaders }
      );
    }

    const option = {
      type: draftType,
      content: draftType === "X_THREAD" ? { tweets: splitThread(refined) } : { text: refined },
      topic: topic || "",
      applied_patterns: [],
      metadata: { generation_type: "refined" },
    };

    return withLlmRateLimitHeaders(
      NextResponse.json({ option }, { status: 200, headers: corsHeaders }),
      guard.info
    );
  } catch (error) {
    console.error("Failed to refine draft:", error);
    Sentry.captureException(error, { tags: { route: "drafts/refine" } });
    return NextResponse.json({ error: "Failed to refine" }, { status: 500, headers: corsHeaders });
  }
}
