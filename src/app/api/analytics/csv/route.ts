import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { importAnalyticsCsv } from "@/lib/analysis/csv-import";

// GET /api/analytics/csv - Get stored analytics data
export async function GET() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("user_analytics")
      .select("*")
      .eq("user_id", user.id)
      .order("uploaded_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) {
      return NextResponse.json({ data: null });
    }

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    Sentry.captureException(error, { tags: { route: "analytics/csv" } });
    return NextResponse.json(
      { error: "Failed to fetch analytics" },
      { status: 500 }
    );
  }
}

// POST /api/analytics/csv - Upload and store CSV analytics
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const MAX_CSV_BYTES = 10 * 1024 * 1024; // 10 MB
    if (file.size > MAX_CSV_BYTES) {
      return NextResponse.json(
        { error: "File too large. Maximum size is 10MB." },
        { status: 413 }
      );
    }

    // Some browsers send an empty mime for CSV; allow that as long as the
    // extension is .csv. Otherwise the mime must be one of the CSV variants.
    const allowedMimes = new Set(["text/csv", "application/vnd.ms-excel", "application/csv", ""]);
    const hasCsvExtension = file.name.toLowerCase().endsWith(".csv");
    if (!hasCsvExtension || !allowedMimes.has(file.type)) {
      return NextResponse.json(
        { error: "Only .csv files are accepted." },
        { status: 415 }
      );
    }

    const csvContent = await file.text();

    let result;
    try {
      result = await importAnalyticsCsv(supabase, user.id, csvContent, file.name);
    } catch (e) {
      if (e instanceof Error && e.message.includes("No valid posts")) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      throw e;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to upload analytics:", error);
    Sentry.captureException(error, { tags: { route: "analytics/csv" } });
    return NextResponse.json(
      { error: "Failed to upload analytics" },
      { status: 500 }
    );
  }
}
