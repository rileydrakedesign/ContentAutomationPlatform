import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { syncUserTimeline } from "@/lib/analysis/timeline-sync";
import { getUserSubscription } from "@/lib/stripe/subscription";
import { PLANS, isSubscriptionActive } from "@/types/subscription";

export const runtime = "nodejs";
export const maxDuration = 300;

// GET /api/cron/analytics-sync - Automated timeline analytics sync for all
// paid users. The daily-ops cron drives this on a daily cadence; this route
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
      .not("access_token", "is", null)
      .not("x_user_id", "is", null);

    if (connError) throw connError;
    if (!connections || connections.length === 0) {
      return NextResponse.json({ message: "No connections to sync", synced: 0 });
    }

    const results: Array<{
      userId: string;
      synced: number;
      error?: string;
      skipped?: string;
    }> = [];

    // Process users sequentially to respect rate limits
    for (const conn of connections) {
      try {
        // Timeline sync is a paid-plan feature — apply the same gate as the UI
        const sub = await getUserSubscription(conn.user_id);
        const plan = isSubscriptionActive(sub)
          ? PLANS[sub.plan_id] || PLANS.free
          : PLANS.free;
        if (!plan.limits.xApiSync) {
          results.push({ userId: conn.user_id, synced: 0, skipped: "plan" });
          continue;
        }

        const { synced } = await syncUserTimeline(supabase, conn.user_id);
        results.push({ userId: conn.user_id, synced });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[analytics-sync] Failed for user ${conn.user_id}:`, msg);
        results.push({ userId: conn.user_id, synced: 0, error: msg });
      }
    }

    return NextResponse.json({
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error("[analytics-sync] Cron failed:", error);
    Sentry.captureException(error, { tags: { cron: "analytics-sync" } });
    return NextResponse.json({ error: "Cron failed" }, { status: 500 });
  }
}
