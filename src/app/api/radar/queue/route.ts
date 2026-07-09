import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient, createAdminClient } from "@/lib/supabase/server";
import { isRadarBetaUser } from "@/lib/radar/flag";

// The bound is the product promise: a curated session, never a feed.
const QUEUE_BOUND = 15;

// GET /api/radar/queue — the user's ranked target queue (Radar beta).
// Returns actionable (new + snoozed) items joined with their pool candidates,
// plus watch labels and sweep freshness for the header.
export async function GET(request: NextRequest) {
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
    const { data: items, error } = await admin
      .from("user_target_queue")
      .select("id, candidate_post_id, watch_id, score, reasons, state, created_at")
      .eq("user_id", user.id)
      .in("state", ["new", "snoozed"])
      .order("score", { ascending: false })
      .limit(QUEUE_BOUND);
    if (error) throw error;

    const postIds = (items || []).map((i) => i.candidate_post_id);
    const { data: candidates } = postIds.length
      ? await admin
          .from("candidate_posts")
          .select("post_id, text, author_username, author_name, author_followers, posted_at, metrics")
          .in("post_id", postIds)
      : { data: [] };
    const byId = new Map((candidates || []).map((c) => [c.post_id, c]));

    const { data: watches } = await admin
      .from("watches")
      .select("id, label, type, enabled")
      .eq("user_id", user.id);
    const watchLabels = new Map((watches || []).map((w) => [w.id, w.label]));

    const { data: units } = await admin
      .from("sweep_units")
      .select("last_swept_at, status, reads_today, daily_read_budget")
      .eq("owner_user_id", user.id);
    const lastSweptAt = (units || [])
      .map((u) => u.last_swept_at)
      .filter(Boolean)
      .sort()
      .pop() ?? null;

    return NextResponse.json({
      items: (items || [])
        .filter((i) => byId.has(i.candidate_post_id))
        .map((i) => ({
          id: i.id,
          state: i.state,
          score: i.score,
          reasons: i.reasons || [],
          watch_label: i.watch_id ? watchLabels.get(i.watch_id) ?? null : null,
          post: byId.get(i.candidate_post_id),
        })),
      watches: watches || [],
      last_swept_at: lastSweptAt,
      units_paused: (units || []).filter((u) => u.status === "paused_budget").length,
    });
  } catch (error) {
    console.error("Radar queue fetch failed:", error);
    Sentry.captureException(error, { tags: { route: "radar/queue" } });
    return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
  }
}
