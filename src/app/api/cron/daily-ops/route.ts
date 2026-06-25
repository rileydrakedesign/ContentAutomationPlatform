import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { resetDueAllowances } from "@/lib/billing/credits";
import { computeDailyUsage, storeDailyUsage } from "@/lib/billing/telemetry";
import { refreshOwnPostMetrics } from "@/lib/analysis/own-posts-refresh";
import { syncUserTimeline } from "@/lib/analysis/timeline-sync";
import { refreshVoiceExamples } from "@/lib/analysis/voice-refresh";
import { refreshVoiceVectors } from "@/lib/analysis/assistant/vectors";
import { getUserSubscription } from "@/lib/stripe/subscription";
import { PLANS, isSubscriptionActive } from "@/types/subscription";

export const runtime = "nodejs";
export const maxDuration = 300;

// Alert thresholds (estimated COGS): trip early — a runaway agent or a URL-
// detection regression shows up here before the X invoice does.
const DAILY_TOTAL_ALERT_USD = 25;
const PER_USER_ALERT_USD = 5;

// Max connected users to run loop-upkeep for per invocation. Ordered by stalest
// sync first so coverage rotates if the connected base ever outgrows one run.
const LOOP_UPKEEP_MAX = 200;

// GET /api/cron/daily-ops — Consolidated daily housekeeping, one cron slot
// (Vercel Hobby allows two once-daily crons total; the other is the
// publish-scheduled safety net):
//   1. reset due monthly credit allowances (idempotent — nothing due twice)
//   2. roll up yesterday's agent-surface spend into usage_daily + alerts
//   3. loop upkeep — refresh own-post metrics (all), sync timelines (paid), and
//      refresh voice examples (auto-refresh users). This is what closes the
//      analytics flywheel on a daily cadence: a post published through any
//      surface gets real engagement metrics — and so can rank as a voice
//      example / be mined as a pattern — within ~1 day, with no manual CSV.
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

  // The jobs are independent — one failing must not block the others.
  let reset: number | null = null;
  let rollup: Awaited<ReturnType<typeof computeDailyUsage>> | null = null;
  let upkeep: { users: number; metrics_updated: number; synced: number; examples_refreshed: number } | null = null;
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

  try {
    upkeep = await runLoopUpkeep();
  } catch (err) {
    Sentry.captureException(err);
    console.error("daily-ops: loop upkeep failed:", err);
    errors.push("loop_upkeep");
  }

  return NextResponse.json(
    { reset, rollup, upkeep, errors },
    { status: errors.length === 3 ? 500 : 200 }
  );
}

// Refresh the analytics flywheel for connected users. Per-user failures are
// swallowed (logged) so one bad token never stalls the whole sweep.
async function runLoopUpkeep() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: connections } = await supabase
    .from("x_connections")
    .select("user_id")
    .not("access_token", "is", null)
    .not("x_user_id", "is", null)
    .order("last_api_sync_at", { ascending: true, nullsFirst: true })
    .limit(LOOP_UPKEEP_MAX);

  const today = new Date().getDay(); // 0-6, Sunday-Saturday

  let users = 0;
  let metricsUpdated = 0;
  let synced = 0;
  let examplesRefreshed = 0;

  for (const conn of connections || []) {
    users++;
    const userId = conn.user_id;

    // 1. Own-post metrics refresh — ungated. The seam that closes the loop.
    try {
      const { updated } = await refreshOwnPostMetrics(supabase, userId);
      metricsUpdated += updated;
    } catch (err) {
      console.error(`[daily-ops] metrics refresh failed for ${userId}:`, err);
    }

    // 2. Timeline analytics sync — paid feature (updates the primary pool).
    try {
      const sub = await getUserSubscription(userId);
      const plan = isSubscriptionActive(sub)
        ? PLANS[sub.plan_id] || PLANS.free
        : PLANS.free;
      if (plan.limits.xApiSync) {
        const { synced: n } = await syncUserTimeline(supabase, userId);
        synced += n;
      }
    } catch (err) {
      console.error(`[daily-ops] timeline sync failed for ${userId}:`, err);
    }

    // 3. Voice example refresh — for users who opted into auto-refresh on this
    //    weekday. Cheap (re-ranks the pool; no LLM) so the freshly-metricked
    //    posts flow into the voice examples automatically.
    try {
      const { data: setting } = await supabase
        .from("user_voice_settings")
        .select("user_id")
        .eq("user_id", userId)
        .eq("voice_type", "post")
        .eq("auto_refresh_enabled", true)
        .eq("refresh_day_of_week", today)
        .maybeSingle();
      if (setting) {
        await refreshVoiceExamples(supabase, userId);
        examplesRefreshed++;
        // The corpus just moved → rebuild the writing-assistant L2 centroids so
        // the live Voice Match tracks it. Best-effort; the assistant cold-starts
        // a refresh on its own if this is skipped.
        await refreshVoiceVectors(supabase, userId).catch((err) =>
          console.error(`[daily-ops] vector refresh failed for ${userId}:`, err)
        );
      }
    } catch (err) {
      console.error(`[daily-ops] voice refresh failed for ${userId}:`, err);
    }
  }

  return { users, metrics_updated: metricsUpdated, synced, examples_refreshed: examplesRefreshed };
}
