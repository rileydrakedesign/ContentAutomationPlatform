import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createClient } from "@supabase/supabase-js";
import { refreshVoiceExamples } from "@/lib/analysis/voice-refresh";

// Vercel Cron configuration
export const runtime = "nodejs";
export const maxDuration = 60;

// GET /api/cron/voice-refresh - Weekly cron job to refresh voice examples
export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (Vercel sends this header)
    const authHeader = request.headers.get("authorization");
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error("CRON_SECRET is not set; refusing cron request");
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
    }
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Create admin client to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const today = new Date().getDay(); // 0-6, Sunday-Saturday

    // Get users whose refresh day matches today and have auto-refresh enabled
    const { data: settings, error } = await supabase
      .from("user_voice_settings")
      .select("user_id")
      .eq("auto_refresh_enabled", true)
      .eq("refresh_day_of_week", today);

    if (error) {
      console.error("[voice-refresh] Failed to fetch users:", error);
      return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
    }

    if (!settings || settings.length === 0) {
      return NextResponse.json({
        message: "No users scheduled for refresh today",
        users_refreshed: 0,
      });
    }

    // Refresh examples for each user
    let totalRefreshed = 0;
    const results: { userId: string; examplesUpdated: number }[] = [];

    for (const setting of settings) {
      try {
        const result = await refreshVoiceExamples(supabase, setting.user_id);
        results.push({ userId: setting.user_id, examplesUpdated: result.examples_updated });
        totalRefreshed++;
      } catch (err) {
        console.error(`[voice-refresh] Failed for user ${setting.user_id}:`, err);
      }
    }

    console.log(`[voice-refresh] Completed. Refreshed ${totalRefreshed} users.`);

    return NextResponse.json({
      message: `Refreshed ${totalRefreshed} users`,
      users_refreshed: totalRefreshed,
      results,
    });
  } catch (error) {
    console.error("[voice-refresh] Cron job failed:", error);
    Sentry.captureException(error, { tags: { cron: "voice-refresh" } });
    return NextResponse.json(
      { error: "Cron job failed" },
      { status: 500 }
    );
  }
}
