import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireClient } from "@/lib/agency/guard";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { runVoiceTuneup } from "@/lib/analysis/tuneup";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function OPTIONS() {
  return handleCors();
}

// POST /api/agency/clients/[id]/tuneup — per-client Voice Report. Reuses the
// exact tune-up engine over the client's isolated pool, so each client's niche,
// patterns (with provenance), and examples come only from THEIR posts.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireClient(id);
  if (ctx instanceof NextResponse) return ctx;

  // Burst guard — per-client tune-up runs the full 300s multi-model pipeline.
  const rl = await checkRateLimit(`agency-tuneup:${id}`, 3);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "A tune-up just ran for this client — please wait a moment." },
      { status: 429, headers: { ...corsHeaders, "Retry-After": "60" } }
    );
  }

  try {
    const result = await runVoiceTuneup(ctx.admin, id, { allowPatternExtraction: true });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 200, headers: corsHeaders });
    }
    return NextResponse.json({ report: result.report }, { headers: corsHeaders });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "agency/clients/tuneup" } });
    return NextResponse.json({ error: "Tune-up failed" }, { status: 500, headers: corsHeaders });
  }
}
