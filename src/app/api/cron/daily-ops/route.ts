import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { resetDueAllowances } from "@/lib/billing/credits";
import { computeDailyUsage, storeDailyUsage } from "@/lib/billing/telemetry";

export const runtime = "nodejs";
export const maxDuration = 60;

// Alert thresholds (estimated COGS): trip early — a runaway agent or a URL-
// detection regression shows up here before the X invoice does.
const DAILY_TOTAL_ALERT_USD = 25;
const PER_USER_ALERT_USD = 5;

// GET /api/cron/daily-ops — Consolidated daily housekeeping, one cron slot
// (Vercel Hobby allows two once-daily crons total; the other is the
// publish-scheduled safety net):
//   1. reset due monthly credit allowances (idempotent — nothing due twice)
//   2. roll up yesterday's agent-surface spend into usage_daily + alerts
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("CRON_SECRET is not set; refusing cron request");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The two jobs are independent — one failing must not block the other.
  let reset: number | null = null;
  let rollup: Awaited<ReturnType<typeof computeDailyUsage>> | null = null;
  const errors: string[] = [];

  try {
    reset = await resetDueAllowances();
  } catch (err) {
    Sentry.captureException(err);
    console.error("daily-ops: credits reset failed:", err);
    errors.push("credits_reset");
  }

  try {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000)
      .toISOString()
      .split("T")[0];
    rollup = await computeDailyUsage(yesterday);
    await storeDailyUsage(rollup);

    if (rollup.estCogsUsd > DAILY_TOTAL_ALERT_USD) {
      const msg = `Agent-surface spend alert: est. $${rollup.estCogsUsd} X/LLM COGS on ${yesterday} (threshold $${DAILY_TOTAL_ALERT_USD})`;
      console.error(msg);
      Sentry.captureMessage(msg, "error");
    }
    if (rollup.topUserCogsUsd > PER_USER_ALERT_USD) {
      const msg = `Per-user spend alert: user ${rollup.topUserId} est. $${rollup.topUserCogsUsd} on ${yesterday} (threshold $${PER_USER_ALERT_USD})`;
      console.error(msg);
      Sentry.captureMessage(msg, "error");
    }
  } catch (err) {
    Sentry.captureException(err);
    console.error("daily-ops: usage rollup failed:", err);
    errors.push("usage_rollup");
  }

  return NextResponse.json(
    { reset, rollup, errors },
    { status: errors.length === 2 ? 500 : 200 }
  );
}
