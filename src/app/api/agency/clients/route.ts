import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireAgency } from "@/lib/agency/guard";
import { listAgencyClients, createAgencyClient } from "@/lib/agency/clients";

export async function OPTIONS() {
  return handleCors();
}

// GET /api/agency/clients — the agency's client roster (Agency tier).
export async function GET() {
  try {
    const ctx = await requireAgency();
    if (ctx instanceof NextResponse) return ctx;
    const clients = await listAgencyClients(ctx.authClient, ctx.userId);
    return NextResponse.json({ clients }, { headers: corsHeaders });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "agency/clients:list" } });
    return NextResponse.json({ error: "Failed to list clients" }, { status: 500, headers: corsHeaders });
  }
}

// POST /api/agency/clients — add a client (creates an isolated voice profile).
export async function POST(request: NextRequest) {
  try {
    const ctx = await requireAgency();
    if (ctx instanceof NextResponse) return ctx;

    const body = await request.json().catch(() => ({}));
    const name = String(body.client_name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "client_name is required" }, { status: 400, headers: corsHeaders });
    }

    const client = await createAgencyClient(ctx.authClient, ctx.userId, {
      client_name: name,
      client_handle: body.client_handle,
      approval_required: Boolean(body.approval_required),
    });
    return NextResponse.json({ client }, { status: 201, headers: corsHeaders });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "agency/clients:create" } });
    return NextResponse.json({ error: "Failed to create client" }, { status: 500, headers: corsHeaders });
  }
}
