import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { computeDailyUsage, storeDailyUsage } from "@/lib/billing/telemetry";

export const runtime = "nodejs";
export const maxDuration = 60;

// Alert thresholds (estimated COGS): trip early — a runaway agent or a URL-
// detection regression shows up here before the X invoice does.
const DAILY_TOTAL_ALERT_USD = 25;
const PER_USER_ALERT_USD = 5;

// GET /api/cron/usage-rollup — Roll up yesterday's agent-surface spend into
// usage_daily and alert on anomalies. Idempotent (upsert by day).
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

    const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
      .toISOString()
      .split("T")[0];

    const usage = await computeDailyUsage(yesterday);
    await storeDailyUsage(usage);

    if (usage.estCogsUsd > DAILY_TOTAL_ALERT_USD) {
      const msg = `Agent-surface spend alert: est. $${usage.estCogsUsd} X/LLM COGS on ${yesterday} (threshold $${DAILY_TOTAL_ALERT_USD})`;
      console.error(msg);
      Sentry.captureMessage(msg, "error");
    }
    if (usage.topUserCogsUsd > PER_USER_ALERT_USD) {
      const msg = `Per-user spend alert: user ${usage.topUserId} est. $${usage.topUserCogsUsd} on ${yesterday} (threshold $${PER_USER_ALERT_USD})`;
      console.error(msg);
      Sentry.captureMessage(msg, "error");
    }

    return NextResponse.json(usage);
  } catch (err) {
    Sentry.captureException(err);
    console.error("usage-rollup cron failed:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
