import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient, createAdminClient } from "@/lib/supabase/server";
import { isRadarBetaUser } from "@/lib/radar/flag";
import { sweepUser } from "@/lib/radar/sweep";

export const maxDuration = 120;

// Manual sweeps are for "I just sat down" — the cron covers the baseline.
// Cursors make repeat sweeps nearly free, but rate-limit anyway.
const MIN_INTERVAL_MS = 10 * 60 * 1000;

// POST /api/radar/sweep — user-triggered "Sweep now" (Radar beta). Seeds topic
// watches from the niche on first run, then sweeps all the user's units on
// their own token (per-unit daily budgets enforced inside).
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
    if (!isRadarBetaUser(user.id)) {
      return NextResponse.json({ error: "Radar beta not enabled", code: "NOT_BETA" }, { status: 403 });
    }
    void request;

    const admin = createAdminClient();

    // Cooldown skipped in dev (local testing sweeps repeatedly) and whenever
    // a never-swept unit exists (a just-added watch should hunt immediately —
    // since_id cursors make re-sweeping the rest nearly free).
    if (process.env.NODE_ENV !== "development") {
      const { count: unswept } = await admin
        .from("sweep_units")
        .select("id", { count: "exact", head: true })
        .eq("owner_user_id", user.id)
        .is("last_swept_at", null);
      if ((unswept ?? 0) === 0) {
        const { data: recent } = await admin
          .from("sweep_units")
          .select("last_swept_at")
          .eq("owner_user_id", user.id)
          .not("last_swept_at", "is", null)
          .order("last_swept_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const elapsed = recent?.last_swept_at
          ? Date.now() - Date.parse(recent.last_swept_at)
          : Infinity;
        if (elapsed < MIN_INTERVAL_MS) {
          const wait = Math.max(1, Math.ceil((MIN_INTERVAL_MS - elapsed) / 60000));
          return NextResponse.json(
            {
              error: `Swept recently — the queue is fresh. Try again in ${wait} minute${wait === 1 ? "" : "s"}.`,
            },
            { status: 429 }
          );
        }
      }
    }

    const summary = await sweepUser(admin, user.id);
    return NextResponse.json({ success: true, summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("X account not connected")) {
      return NextResponse.json(
        { error: "Connect your X account to run Radar sweeps." },
        { status: 400 }
      );
    }
    console.error("Radar sweep failed:", error);
    Sentry.captureException(error, { tags: { route: "radar/sweep" } });
    return NextResponse.json({ error: "Sweep failed. Please try again." }, { status: 500 });
  }
}
