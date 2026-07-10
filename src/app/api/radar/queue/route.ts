import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient, createAdminClient } from "@/lib/supabase/server";
import { isRadarBetaUser } from "@/lib/radar/flag";

// The bound is the product promise: a curated session, never a feed.
const QUEUE_BOUND = 15;
// Replied history is a review surface, not a session — bounded separately.
// (It will grow outcome badges; pagination comes with the outcome loop.)
const SETTLED_BOUND = 50;

const ACTIONABLE_STATES = ["new", "snoozed"] as const;
const SETTLED_STATES = ["replied", "skipped"] as const;
const ALL_STATES = [...ACTIONABLE_STATES, ...SETTLED_STATES] as string[];

// GET /api/radar/queue?states=new,snoozed,replied — the user's ranked target
// queue (Radar beta), joined with pool candidates, plus watch labels and sweep
// freshness for the header. Actionable states rank by score (bounded session);
// settled states order by recency. Default (no param) stays new+snoozed.
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
    const statesParam = request.nextUrl.searchParams.get("states");
    const requested = statesParam
      ? statesParam.split(",").map((s) => s.trim()).filter((s) => ALL_STATES.includes(s))
      : [...ACTIONABLE_STATES];
    const actionable = requested.filter((s) => (ACTIONABLE_STATES as readonly string[]).includes(s));
    const settled = requested.filter((s) => (SETTLED_STATES as readonly string[]).includes(s));

    const admin = createAdminClient();
    const select = "id, candidate_post_id, watch_id, score, reasons, state, skip_reason, created_at, updated_at";

    const [actionableRes, settledRes] = await Promise.all([
      actionable.length
        ? admin
            .from("user_target_queue")
            .select(select)
            .eq("user_id", user.id)
            .in("state", actionable)
            .order("score", { ascending: false })
            .limit(QUEUE_BOUND)
        : Promise.resolve({ data: [], error: null }),
      settled.length
        ? admin
            .from("user_target_queue")
            .select(select)
            .eq("user_id", user.id)
            .in("state", settled)
            .order("updated_at", { ascending: false })
            .limit(SETTLED_BOUND)
        : Promise.resolve({ data: [], error: null }),
    ]);
    if (actionableRes.error) throw actionableRes.error;
    if (settledRes.error) throw settledRes.error;
    const items = [...(actionableRes.data || []), ...(settledRes.data || [])];

    // Note: settled items older than the candidate-pool TTL (~7 days) lose
    // their post join below and drop out of the response — acceptable until
    // the outcome loop persists reply snapshots.
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
          skip_reason: i.skip_reason ?? null,
          updated_at: i.updated_at,
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
