import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { corsHeaders, handleCors } from "@/lib/cors";
import { requireClient } from "@/lib/agency/guard";
import { importAnalyticsCsv } from "@/lib/analysis/csv-import";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/agency/clients/[id]/csv — import a client's X analytics CSV into
// their isolated data island (so a per-client tune-up can mine their voice).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireClient(id);
  if (ctx instanceof NextResponse) return ctx;

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400, headers: corsHeaders });
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)." }, { status: 413, headers: corsHeaders });
    }
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "Only .csv files are accepted." }, { status: 415, headers: corsHeaders });
    }

    const csv = await file.text();
    const result = await importAnalyticsCsv(ctx.admin, id, csv, file.name);
    return NextResponse.json(result, { headers: corsHeaders });
  } catch (error) {
    if (error instanceof Error && error.message.includes("No valid posts")) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: corsHeaders });
    }
    Sentry.captureException(error, { tags: { route: "agency/clients/csv" } });
    return NextResponse.json({ error: "Failed to import CSV" }, { status: 500, headers: corsHeaders });
  }
}
