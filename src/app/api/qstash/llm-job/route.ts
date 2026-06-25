import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { Receiver } from "@upstash/qstash";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  runPostPipeline,
  type PipelineEvent,
  type PipelinePattern,
  type DraftType,
} from "@/lib/ai/agentic/post-pipeline";

export const runtime = "nodejs";
// Same generous budget as the synchronous agentic route — the worker runs the
// full research + draft + voice-check + iterate chain.
export const maxDuration = 300;

interface JobInput {
  topic: string;
  draftType: DraftType;
  patterns: PipelinePattern[];
  explicitPatternSelection: boolean;
  inspiration?: { text: string; author: string } | null;
  instructions?: string | null;
  previousVariations?: string[] | null;
}

function admin(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

async function verify(rawBody: string, request: NextRequest): Promise<boolean> {
  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;
  try {
    const receiver = new Receiver({
      currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
      nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
    });
    await receiver.verify({ signature, body: rawBody });
    return true;
  } catch {
    return false;
  }
}

// POST /api/qstash/llm-job
// QStash worker that runs an agentic generation job and persists progress/result
// to generation_jobs. With ?failure=1 it's the dead-letter callback that flips a
// job to `failed` when QStash exhausts delivery retries.
export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!(await verify(rawBody, request))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const supabase = admin();

  // Dead-letter callback: mark the job failed and stop.
  if (request.nextUrl.searchParams.get("failure") === "1") {
    const jobId = request.nextUrl.searchParams.get("jobId");
    if (jobId) {
      await supabase
        .from("generation_jobs")
        .update({ status: "failed", error: "Job delivery failed after retries", updated_at: new Date().toISOString() })
        .eq("id", jobId)
        .neq("status", "done");
    }
    return NextResponse.json({ ok: true });
  }

  let jobId: string | undefined;
  let userId: string | undefined;
  try {
    ({ jobId, userId } = JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Bad body" }, { status: 400 });
  }
  if (!jobId || !userId) {
    return NextResponse.json({ error: "Missing jobId or userId" }, { status: 400 });
  }

  // Claim the job: queued → running. If it's not claimable (already running/done),
  // skip — this makes redelivery idempotent.
  const { data: claimed } = await supabase
    .from("generation_jobs")
    .update({ status: "running", updated_at: new Date().toISOString() })
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("status", "queued")
    .select("id, input")
    .maybeSingle();

  if (!claimed) {
    return NextResponse.json({ skipped: true });
  }

  const input = claimed.input as JobInput;
  const progress: PipelineEvent[] = [];
  let result: PipelineEvent | null = null;

  // Persist coarse progress so the client poller can render the chain. Token
  // deltas are dropped (too chatty for a polled row); steps/scores/research are
  // kept, and `complete` becomes the result.
  const flush = async () => {
    await supabase
      .from("generation_jobs")
      .update({ progress, updated_at: new Date().toISOString() })
      .eq("id", jobId);
  };

  try {
    for await (const event of runPostPipeline({
      supabase,
      userId,
      topic: input.topic,
      draftType: input.draftType,
      patterns: input.patterns || [],
      explicitPatternSelection: !!input.explicitPatternSelection,
      inspiration: input.inspiration || null,
      instructions: input.instructions || null,
      previousVariations: input.previousVariations || null,
    })) {
      if (event.type === "draft_delta") continue; // too chatty to persist
      if (event.type === "complete") {
        result = event;
        continue;
      }
      progress.push(event);
      if (event.type === "step" || event.type === "voice_score" || event.type === "research") {
        await flush();
      }
    }

    await supabase
      .from("generation_jobs")
      .update({
        status: "done",
        progress,
        result: result ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[qstash/llm-job] pipeline error", error);
    Sentry.captureException(error, { tags: { route: "qstash/llm-job" }, extra: { jobId } });
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error: "Generation failed. Please try again.",
        updated_at: new Date().toISOString(),
      })
      .eq("id", jobId);
    // 200 so QStash doesn't retry an application-level failure.
    return NextResponse.json({ ok: false });
  }
}
