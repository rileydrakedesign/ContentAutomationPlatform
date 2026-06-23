import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { requireAiGeneration } from "@/lib/stripe/gate";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { isGenerationApplicablePattern } from "@/lib/analysis/pattern-applicability";
import { runPostPipeline, type DraftType, type PipelinePattern } from "@/lib/ai/agentic/post-pipeline";

// The agentic chain makes several Claude calls plus a web-search loop, so give
// it generous headroom over the one-shot route's 60s.
export const maxDuration = 300;

const json = (body: unknown, status: number) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// POST /api/drafts/generate-agentic
// Streams the research → draft → voice-check → iterate chain as Server-Sent
// Events. Each `data:` line is one PipelineEvent (see post-pipeline.ts).
export async function POST(request: NextRequest) {
  const supabase = await createAuthClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return json({ error: "Unauthorized" }, 401);

  // The Agent pipeline is heavier (web search + draft + voice checks + refine),
  // so it consumes 3 daily generation slots vs Quick's 1.
  const gateError = await requireAiGeneration(user.id, "generate-agentic", 3);
  if (gateError) return gateError;

  // Burst guard — Pro/Agent have unlimited daily generations, but this pipeline
  // runs up to 300s of web-search + multiple Claude calls; cap concurrency/burst
  // so a loop can't fan out unbounded LLM spend.
  const rl = await checkRateLimit(`generate-agentic:${user.id}`, 5);
  if (!rl.allowed) {
    return json({ error: "Slow down — too many generations in a row." }, 429);
  }

  const body = await request.json();
  const {
    topic,
    draftType = "X_POST",
    patternIds = [],
    inspirationPost,
    instructions,
    previousVariations,
  } = body as {
    topic: string;
    draftType?: DraftType;
    patternIds?: string[];
    inspirationPost?: { text: string; author: string };
    instructions?: string;
    previousVariations?: string[];
  };

  if (!topic || topic.trim().length < 3) {
    return json({ error: "Topic must be at least 3 characters" }, 400);
  }

  // Resolve patterns exactly like the one-shot route: explicit selection or the
  // top-3 enabled, generation-applicable patterns. Non-fatal on failure.
  const explicit = Array.isArray(patternIds) && patternIds.length > 0;
  let patterns: PipelinePattern[] = [];
  try {
    const query = supabase
      .from("extracted_patterns")
      .select("id, pattern_type, pattern_name, pattern_value, multiplier, applies_to_generation")
      .eq("user_id", user.id);
    const { data } = explicit
      ? await query.in("id", patternIds)
      : await query.eq("is_enabled", true).order("multiplier", { ascending: false }).limit(10);
    const applicable = (data || []).filter(isGenerationApplicablePattern);
    patterns = (explicit ? applicable : applicable.slice(0, 3)).map((p) => ({
      id: p.id,
      pattern_name: p.pattern_name,
      pattern_value: p.pattern_value,
    }));
  } catch (e) {
    console.error("[generate-agentic] pattern fetch failed", e);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      try {
        for await (const event of runPostPipeline({
          supabase,
          userId: user.id,
          topic: topic.trim(),
          draftType,
          patterns,
          explicitPatternSelection: explicit,
          inspiration: inspirationPost || null,
          instructions: instructions || null,
          previousVariations: previousVariations || null,
        })) {
          send(event);
        }
      } catch (error) {
        console.error("[generate-agentic] pipeline error", error);
        Sentry.captureException(error, { tags: { route: "drafts/generate-agentic" } });
        send({ type: "error", message: "Generation failed. Please try again." });
      } finally {
        send({ type: "end" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering so events flush immediately.
      "X-Accel-Buffering": "no",
    },
  });
}
