import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireClient } from "@/lib/agency/guard";
import { getAssembledPromptForUser } from "@/lib/openai/prompts/prompt-assembler";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCors();
}

// GET /api/agency/clients/[id]/context?type=post|reply — the assembled writing
// context for THIS client's voice (write-it-yourself, isolated per client).
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireClient(id);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const type = new URL(request.url).searchParams.get("type") === "reply" ? "reply" : "post";
    const systemPrompt = await getAssembledPromptForUser(ctx.admin, id, type);
    return NextResponse.json(
      { voice_type: type, system_prompt: systemPrompt, client_name: ctx.client.client_name },
      { headers: corsHeaders }
    );
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "agency/clients/context" } });
    return NextResponse.json({ error: "Failed to assemble context" }, { status: 500, headers: corsHeaders });
  }
}
