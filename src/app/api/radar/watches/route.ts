import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient, createAdminClient } from "@/lib/supabase/server";
import { isRadarBetaUser } from "@/lib/radar/flag";
import { compileWatchQueries } from "@/lib/x-api/watch-queries";

// Watches are budgeted read units — cap how many a user can hold so a chip
// spree can't multiply sweep spend (each unit: 25 reads/day default).
const MAX_WATCHES = 10;

// POST /api/radar/watches — create a custom watch from a phrase. v1 of the
// custom tracker (REPLY_RADAR_SCOPE §3.2): phrase → compiled query → watch +
// owned sweep unit. The test-sweep preview ("~N matches/24h") comes later.
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

    let body: { phrase?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const phrase = String(body.phrase || "").trim();
    if (phrase.length < 2 || phrase.length > 80) {
      return NextResponse.json(
        { error: "Give the watch a phrase between 2 and 80 characters." },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const { count } = await admin
      .from("watches")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id);
    if ((count ?? 0) >= MAX_WATCHES) {
      return NextResponse.json(
        { error: `Watch limit reached (${MAX_WATCHES}).` },
        { status: 400 }
      );
    }

    const compiled = compileWatchQueries([{ label: phrase, keywords: [phrase] }]);
    if (compiled.length === 0) {
      return NextResponse.json({ error: "Couldn't compile a query from that phrase." }, { status: 400 });
    }

    const { data: watch, error } = await admin
      .from("watches")
      .insert({
        user_id: user.id,
        type: "custom",
        label: phrase,
        query: compiled[0].query,
        keywords: [phrase],
      })
      .select("id, label, type, enabled")
      .single();
    if (error || !watch) throw error ?? new Error("watch insert returned nothing");

    const { error: unitError } = await admin.from("sweep_units").insert({
      owner_user_id: user.id,
      watch_id: watch.id,
      type: "custom",
      query: compiled[0].query,
    });
    if (unitError) throw unitError;

    return NextResponse.json({ success: true, watch });
  } catch (error) {
    console.error("Radar watch create failed:", error);
    Sentry.captureException(error, { tags: { route: "radar/watch-create" } });
    return NextResponse.json({ error: "Failed to add watch" }, { status: 500 });
  }
}
