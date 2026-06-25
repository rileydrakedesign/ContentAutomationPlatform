import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { refreshOwnPostMetrics } from "@/lib/analysis/own-posts-refresh";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/metrics-refresh - Batch refresh engagement metrics on the
// user's own captured posts (everything published through any surface).
//
// Refreshing the user's OWN posts is not plan-gated — it is the seam that
// closes the analytics flywheel, and the only thing keeping the loop fresh for
// free users. The daily-ops cron drives this on a daily cadence; this route
// stays for manual / on-demand triggering.
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET is not set; refusing cron request");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get all users with X connections
    const { data: connections, error: connError } = await supabase
      .from("x_connections")
      .select("user_id")
      .not("access_token", "is", null);

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: "No connections", updated: 0 });
    }

    let totalUpdated = 0;

    for (const conn of connections) {
      try {
        const { updated } = await refreshOwnPostMetrics(supabase, conn.user_id);
        totalUpdated += updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[metrics-refresh] Failed for user ${conn.user_id}:`, msg);
      }
    }

    return NextResponse.json({ updated: totalUpdated });
  } catch (error) {
    console.error("[metrics-refresh] Cron failed:", error);
    Sentry.captureException(error, { tags: { cron: "metrics-refresh" } });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
