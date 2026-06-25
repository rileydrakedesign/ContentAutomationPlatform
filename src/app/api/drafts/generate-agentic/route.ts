import { NextRequest } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient, createAdminClient } from "@/lib/supabase/server";
import { requireAiGeneration } from "@/lib/stripe/gate";
import { guardLlmRoute } from "@/lib/api/with-llm-guard";
import { enqueueLlmJob } from "@/lib/qstash/enqueue-llm";
import { isGenerationApplicablePattern } from "@/lib/analysis/pattern-applicability";
import { runPostPipeline, type DraftType, type PipelinePattern } from "@/lib/ai/agentic/post-pipeline";

// When on, the heavy chain runs in a QStash worker (enqueue → poll) instead of
// holding this function open for up to 300s. Off = the original SSE stream.
const AGENTIC_ASYNC = process.env.AGENTIC_ASYNC === "true";

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

  // Burst guard — Pro/Agent have unlimited daily generations, but this pipeline
  // runs up to 300s of web-search + multiple Claude calls; the weight-3 cost on
  // the per-user burst + global tenant-fair tiers stops a loop from fanning out
  // unbounded LLM spend. Runs before the daily gate so a throttle doesn't burn
  // generation slots.
  const guard = await guardLlmRoute({ request, userId: user.id, cost: 3 });
  if (!guard.ok) return guard.response;

  // The Agent pipeline is heavier (web search + draft + voice checks + refine),
  // so it consumes 3 daily generation slots vs Quick's 1.
  const gateError = await requireAiGeneration(user.id, "generate-agentic", 3);
  if (gateError) return gateError;

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

  // Async path: enqueue the job and return its id; the client polls
  // /api/drafts/generation-jobs/[id]. Smooths provider load under spikes.
  if (AGENTIC_ASYNC) {
    const admin = await createAdminClient();
    const { data: job, error: jobErr } = await admin
      .from("generation_jobs")
      .insert({
        user_id: user.id,
        type: "agentic_post",
        status: "queued",
        input: {
          topic: topic.trim(),
          draftType,
          patterns,
          explicitPatternSelection: explicit,
          inspiration: inspirationPost || null,
          instructions: instructions || null,
          previousVariations: previousVariations || null,
        },
      })
      .select("id")
      .single();

    if (jobErr || !job) {
      console.error("[generate-agentic] failed to create job", jobErr);
      return json({ error: "Could not start generation. Please try again." }, 500);
    }

    const { messageId } = await enqueueLlmJob({ jobId: job.id, userId: user.id });
    if (!messageId) {
      await admin
        .from("generation_jobs")
        .update({ status: "failed", error: "Could not enqueue job" })
        .eq("id", job.id);
      return json({ error: "Generation is busy right now. Please try again." }, 503);
    }

    return json({ jobId: job.id, mode: "async" }, 202);
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
