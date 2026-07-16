/**
 * Radar sweep runner — beta (per-user, user-token) implementation of the
 * Phase-1 pipeline: sweep → candidate pool → score → user_target_queue.
 *
 * Pool-shaped by design (REPLY_RADAR_SCOPE §4): every unit has an owner in
 * beta, but candidates land in the SHARED candidate_posts pool and scoring is
 * a separate pass — so flipping to pooled app-level sweeps at scale changes
 * who runs the sweep, not the pipeline. `since_id` cursors mean each pass
 * pays only for NEW posts; per-unit daily read budgets hard-cap spend
 * (25 reads/day/unit ≈ $3.75/mo worst case; 6 units ≈ $22/user ceiling).
 *
 * Invoked by:
 *   - POST /api/radar/sweep       (user-triggered "Sweep now", flag-gated)
 *   - /api/cron/daily-ops         (daily pass for radar-beta users)
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { searchRecentTweets, getValidAccessToken } from "@/lib/x-api";
import { mapSearchResults } from "@/lib/x-api/search-mapping";
import { admitToQueue, assessOpportunity, type MetricsSnapshot } from "@/lib/x-api/opportunity";
import { compileWatchQueries } from "@/lib/x-api/watch-queries";
import { isRadarUnlimitedUser } from "@/lib/radar/flag";

export interface SweepSummary {
  units_swept: number;
  units_paused_budget: number;
  reads: number;
  candidates_upserted: number;
  queued: number;
  seeded_watches: number;
  expired: number;
  /** Fetched but not queued: failed a gate or showed no distribution proof. */
  screened_out: number;
}

interface SweepUnitRow {
  id: string;
  owner_user_id: string;
  watch_id: string | null;
  query: string;
  since_id: string | null;
  daily_read_budget: number;
  reads_today: number;
  reads_date: string | null;
  reads_total: number;
  status: string;
}

const SWEEP_PAGE_SIZE = 25; // per pass; the daily budget is the real cap
const QUEUE_STATE_NEW = "new";
// The queue is today's edition (PRD §3.4): an un-triaged card that sat a full
// day is stale — its reply window closed, and its score (frozen at sweep time,
// when it WAS fresh) would forever outrank genuinely fresh finds. Age it out.
// Deleted rows can't resurrect: since_id cursors never re-fetch old posts.
const QUEUE_MAX_AGE_HOURS = 24;

/** Retire un-triaged queue cards older than the reply window. */
export async function expireStaleQueueItems(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const cutoff = new Date(Date.now() - QUEUE_MAX_AGE_HOURS * 3600 * 1000).toISOString();
  const { data: expired, error } = await supabase
    .from("user_target_queue")
    .delete()
    .eq("user_id", userId)
    .eq("state", QUEUE_STATE_NEW)
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.warn("radar sweep: stale-queue expiry failed:", error.message);
    return 0;
  }
  return (expired || []).length;
}

/** Numeric string compare for tweet IDs (longer = larger; then lexicographic). */
export function maxTweetId(a: string | null, b: string): string {
  if (!a) return b;
  if (a.length !== b.length) return a.length > b.length ? a : b;
  return a > b ? a : b;
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Seed topic watches from the user's analyzed niche (G2) if they have none.
 * One watch + one owned sweep unit per compiled cluster query.
 */
export async function seedWatchesFromNiche(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const { count } = await supabase
    .from("watches")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  if ((count ?? 0) > 0) return 0;

  const { data: profile } = await supabase
    .from("user_niche_profile")
    .select("topic_clusters")
    .eq("user_id", userId)
    .maybeSingle();
  const clusters = Array.isArray(profile?.topic_clusters) ? profile.topic_clusters : [];
  const compiled = compileWatchQueries(
    [...clusters].sort(
      (a: { avg_engagement?: number }, b: { avg_engagement?: number }) =>
        (b.avg_engagement || 0) - (a.avg_engagement || 0)
    )
  );
  if (compiled.length === 0) return 0;

  for (const w of compiled) {
    const { data: watch, error } = await supabase
      .from("watches")
      .insert({
        user_id: userId,
        type: "topic",
        label: w.label,
        query: w.query,
        keywords: [],
      })
      .select("id")
      .single();
    if (error || !watch) continue;
    await supabase.from("sweep_units").insert({
      owner_user_id: userId,
      watch_id: watch.id,
      type: "topic",
      query: w.query,
    });
  }
  return compiled.length;
}

/**
 * Run all of a user's active sweep units once: fetch new posts since the
 * cursor, upsert the candidate pool (shifting metric snapshots for velocity),
 * then score repliable candidates into the user's queue.
 */
export async function sweepUser(
  supabase: SupabaseClient,
  userId: string
): Promise<SweepSummary> {
  const summary: SweepSummary = {
    units_swept: 0,
    units_paused_budget: 0,
    reads: 0,
    candidates_upserted: 0,
    queued: 0,
    seeded_watches: 0,
    expired: 0,
    screened_out: 0,
  };

  summary.expired = await expireStaleQueueItems(supabase, userId);
  summary.seeded_watches = await seedWatchesFromNiche(supabase, userId);

  // Budget-exempt (dev + testing allowlist): sweep every unit regardless of
  // its daily read count, so the queue can be exercised repeatedly.
  const unlimited = isRadarUnlimitedUser(userId);

  const { data: unitsRaw } = await supabase
    .from("sweep_units")
    .select("id, owner_user_id, watch_id, query, since_id, daily_read_budget, reads_today, reads_date, reads_total, status")
    .eq("owner_user_id", userId)
    .neq("status", "disabled");
  const units = (unitsRaw || []) as SweepUnitRow[];
  if (units.length === 0) return summary;

  // Disabled watches pause their units.
  const watchIds = units.map((u) => u.watch_id).filter(Boolean) as string[];
  const { data: watchRows } = watchIds.length
    ? await supabase.from("watches").select("id, enabled").in("id", watchIds)
    : { data: [] };
  const watchEnabled = new Map((watchRows || []).map((w) => [w.id, w.enabled !== false]));

  const { accessToken, connection } = await getValidAccessToken(userId);
  const authUsername = (connection.x_username || "").toLowerCase();
  const today = todayUtc();
  const nowMs = Date.now();

  for (const unit of units) {
    if (unit.watch_id && watchEnabled.get(unit.watch_id) === false) continue;

    // Roll the daily budget window.
    const readsToday = unit.reads_date === today ? unit.reads_today : 0;
    if (!unlimited && readsToday >= unit.daily_read_budget) {
      if (unit.status !== "paused_budget") {
        await supabase
          .from("sweep_units")
          .update({ status: "paused_budget" })
          .eq("id", unit.id);
      }
      summary.units_paused_budget++;
      continue;
    }

    // X requires max_results >= 10; the daily budget still caps actuals
    // (a full page for budget-exempt users).
    const remaining = unlimited ? SWEEP_PAGE_SIZE : unit.daily_read_budget - readsToday;
    const pageSize = Math.max(10, Math.min(SWEEP_PAGE_SIZE, remaining));

    let result: Awaited<ReturnType<typeof searchRecentTweets>>;
    try {
      result = await searchRecentTweets(
        accessToken,
        unit.query,
        pageSize,
        unit.since_id ?? undefined
      );
    } catch (e) {
      console.warn(`radar sweep: unit ${unit.id} search failed:`, e);
      continue;
    }

    const tweets = mapSearchResults(result, authUsername);
    const reads = (result.data || []).length;
    const newSinceId = tweets.reduce(
      (acc, t) => maxTweetId(acc, t.id),
      unit.since_id
    );

    await supabase
      .from("sweep_units")
      .update({
        since_id: newSinceId,
        reads_today: readsToday + reads,
        reads_date: today,
        reads_total: (unit.reads_total || 0) + reads,
        last_swept_at: new Date().toISOString(),
        status: !unlimited && readsToday + reads >= unit.daily_read_budget ? "paused_budget" : "active",
      })
      .eq("id", unit.id);

    summary.units_swept++;
    summary.reads += reads;
    if (tweets.length === 0) continue;

    // ── Candidate pool upsert (snapshot shift for velocity) ────────────────
    const ids = tweets.map((t) => t.id);
    const { data: existingRows } = await supabase
      .from("candidate_posts")
      .select("post_id, metrics, last_swept_at, source_unit_ids")
      .in("post_id", ids);
    const existing = new Map((existingRows || []).map((r) => [r.post_id, r]));

    const nowIso = new Date().toISOString();
    const rows = tweets.map((t) => {
      const prior = existing.get(t.id);
      return {
        post_id: t.id,
        text: t.text,
        author_username: t.author?.username ?? null,
        author_name: t.author?.name ?? null,
        author_followers: t.author?.followers_count ?? null,
        posted_at: t.created_at,
        reply_settings: t.reply_settings,
        metrics: t.metrics ?? {},
        prev_metrics: prior ? prior.metrics : null,
        prev_swept_at: prior ? prior.last_swept_at : null,
        // first_seen_at: column default on insert; upsert-update leaves it alone
        last_swept_at: nowIso,
        source_unit_ids: prior
          ? Array.from(new Set([...(prior.source_unit_ids || []), unit.id]))
          : [unit.id],
      };
    });
    const { error: poolError } = await supabase
      .from("candidate_posts")
      .upsert(rows, { onConflict: "post_id" });
    if (poolError) {
      console.warn("radar sweep: candidate pool upsert failed:", poolError.message);
      continue;
    }
    summary.candidates_upserted += rows.length;

    // ── Scoring pass → user queue ───────────────────────────────────────────
    const repliable = tweets.filter((t) => t.reply_allowed);
    if (repliable.length === 0) continue;

    // Never queue a post the user already replied to (any surface).
    const { data: replied } = await supabase
      .from("extension_replies")
      .select("replied_to_post_id")
      .eq("user_id", userId)
      .in("replied_to_post_id", repliable.map((t) => t.id));
    const repliedSet = new Set((replied || []).map((r) => String(r.replied_to_post_id)));

    const queueRows = repliable
      .filter((t) => !repliedSet.has(t.id))
      .flatMap((t) => {
        const prior = existing.get(t.id);
        const extras = {
          prevMetrics: (prior?.metrics as MetricsSnapshot) ?? null,
          prevSweptAtMs: prior?.last_swept_at ? Date.parse(prior.last_swept_at) : null,
        };
        // Admission before scoring: a card must show proof of coming
        // distribution (in-band author / engagement-for-age / velocity) and
        // pass the bot/bait gates. Screened posts stay in the candidate pool.
        const admission = admitToQueue(t, nowMs, extras);
        if (!admission.admit) {
          summary.screened_out++;
          return [];
        }
        const assessment = assessOpportunity(t, nowMs, extras);
        return [
          {
            user_id: userId,
            candidate_post_id: t.id,
            watch_id: unit.watch_id,
            score: assessment.score,
            reasons: assessment.reasons,
            state: QUEUE_STATE_NEW,
          },
        ];
      });

    if (queueRows.length > 0) {
      // ignoreDuplicates: an existing row keeps its state (snoozed/skipped/
      // replied are user decisions — a re-sweep must never resurrect a card).
      const { error: queueError } = await supabase
        .from("user_target_queue")
        .upsert(queueRows, { onConflict: "user_id,candidate_post_id", ignoreDuplicates: true });
      if (queueError) {
        console.warn("radar sweep: queue upsert failed:", queueError.message);
      } else {
        summary.queued += queueRows.length;
      }
    }
  }

  return summary;
}

/** Delete pool candidates older than the recent-search horizon (~7 days). */
export async function cleanupCandidatePool(supabase: SupabaseClient): Promise<void> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  await supabase.from("candidate_posts").delete().lt("last_swept_at", cutoff);
}
