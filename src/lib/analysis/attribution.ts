/**
 * Outcome attribution — "did writing with Agents For X actually grow me?"
 *
 * Compares the weighted engagement of the user's AFX-assisted posts (published
 * through the app/API/MCP, flagged `afx_assisted`) against their baseline posts
 * (their own posts synced from X that weren't written here). This is the empty
 * lane in the market (Phase 2: no competitor credibly demonstrates results) and
 * the retention/advocacy proof that justifies the subscription.
 *
 * Only posts with refreshed metrics count — a just-published post sits with
 * empty metrics until the daily flywheel fills them in (see own-posts-refresh).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { weightedEngagement } from "@/lib/utils/engagement";

export interface OutcomeGroup {
  count: number;
  avg_engagement: number;
}

export interface OutcomeAttribution {
  assisted: OutcomeGroup;
  baseline: OutcomeGroup;
  /** % the assisted average is above (positive) / below the baseline average. */
  lift_pct: number | null;
  /** True once both groups have enough refreshed posts to compare honestly. */
  has_enough_data: boolean;
}

const MIN_PER_GROUP = 3;

function hasMetrics(m: Record<string, unknown> | null): boolean {
  return Boolean(m && Object.keys(m).length > 0);
}

export async function getOutcomeAttribution(
  supabase: SupabaseClient,
  userId: string
): Promise<OutcomeAttribution> {
  const { data: posts } = await supabase
    .from("captured_posts")
    .select("metrics, afx_assisted")
    .eq("user_id", userId)
    .eq("is_own_post", true)
    .limit(2000);

  const assisted: number[] = [];
  const baseline: number[] = [];

  for (const p of posts ?? []) {
    const metrics = (p.metrics as Record<string, number> | null) ?? null;
    if (!hasMetrics(metrics)) continue; // not yet refreshed — skip
    const score = weightedEngagement({
      likes: Number(metrics!.likes) || 0,
      reposts: Number(metrics!.retweets ?? metrics!.reposts) || 0,
      replies: Number(metrics!.replies) || 0,
      bookmarks: Number(metrics!.bookmarks) || 0,
      impressions: Number(metrics!.views ?? metrics!.impressions) || 0,
    });
    if (p.afx_assisted) assisted.push(score);
    else baseline.push(score);
  }

  const avg = (xs: number[]) =>
    xs.length ? Math.round(xs.reduce((s, v) => s + v, 0) / xs.length) : 0;

  const assistedAvg = avg(assisted);
  const baselineAvg = avg(baseline);

  const hasEnough = assisted.length >= MIN_PER_GROUP && baseline.length >= MIN_PER_GROUP;
  const liftPct =
    hasEnough && baselineAvg > 0
      ? Math.round(((assistedAvg - baselineAvg) / baselineAvg) * 100)
      : null;

  return {
    assisted: { count: assisted.length, avg_engagement: assistedAvg },
    baseline: { count: baseline.length, avg_engagement: baselineAvg },
    lift_pct: liftPct,
    has_enough_data: hasEnough,
  };
}
