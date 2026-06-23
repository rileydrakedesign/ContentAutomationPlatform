import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireClient } from "@/lib/agency/guard";
import { updateAgencyClient, deleteAgencyClientData } from "@/lib/agency/clients";

export async function OPTIONS() {
  return handleCors();
}

// GET /api/agency/clients/[id] — one client profile.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireClient(id);
  if (ctx instanceof NextResponse) return ctx;
  return NextResponse.json({ client: ctx.client }, { headers: corsHeaders });
}

// PATCH /api/agency/clients/[id] — rename / handle / approval / white-label.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireClient(id);
  if (ctx instanceof NextResponse) return ctx;
  try {
    const body = await request.json().catch(() => ({}));
    const client = await updateAgencyClient(ctx.authClient, id, {
      client_name: body.client_name,
      client_handle: body.client_handle,
      approval_required: body.approval_required,
      white_label: body.white_label,
    });
    return NextResponse.json({ client }, { headers: corsHeaders });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "agency/clients:update" } });
    return NextResponse.json({ error: "Failed to update client" }, { status: 500, headers: corsHeaders });
  }
}

// DELETE /api/agency/clients/[id] — remove the client and purge its data island.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireClient(id);
  if (ctx instanceof NextResponse) return ctx;
  try {
    await deleteAgencyClientData(ctx.authClient, ctx.admin, id);
    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "agency/clients:delete" } });
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500, headers: corsHeaders });
  }
}
