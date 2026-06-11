import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { resetDueAllowances } from "@/lib/billing/credits";

export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/cron/credits-reset — Reset due monthly credit allowances.
// The reset itself is a single SQL statement (reset_due_allowances), so a
// re-run after success is a no-op: nothing is due until next month.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET is not set; refusing cron request");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reset = await resetDueAllowances();
    return NextResponse.json({ reset });
  } catch (err) {
    Sentry.captureException(err);
    console.error("credits-reset cron failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
