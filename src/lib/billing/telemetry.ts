import { createAdminClient } from "@/lib/supabase/server";

/**
 * Estimated X/LLM COGS per credit, by ledger action. Deliberately worst-case
 * (URL-post ratio for publishes, Sonnet-rate for generation) so the daily
 * alert fires early rather than late. Source: MCP_PROD_READINESS_PLAN.md §B.
 */
const COGS_PER_CREDIT: Array<[prefix: string, usd: number]> = [
  ["publish.", 0.0067], // $0.20 / 30 credits (URL) ≈ $0.015 / 3 (plain)
  ["drafts.generate", 0.008], // sonnet worst case $0.024 / 3
  ["inspiration.create", 0.008],
  ["tweets.read", 0.005],
  ["search.per_post", 0.005],
  ["analytics.sync", 0.033], // standard-rate 100-post sync $0.50 / 15
  ["analytics.read", 0],
];

function cogsFactor(action: string): number {
  for (const [prefix, usd] of COGS_PER_CREDIT) {
    if (action.startsWith(prefix)) return usd;
  }
  return 0.005;
}

export interface DailyUsage {
  day: string;
  debitCount: number;
  creditsDebited: number;
  creditsRefunded: number;
  estCogsUsd: number;
  topUserId: string | null;
  topUserCogsUsd: number;
}

/** Roll up one UTC day of credit_ledger into spend estimates. */
export async function computeDailyUsage(day: string): Promise<DailyUsage> {
  const supabase = createAdminClient();
  const start = `${day}T00:00:00Z`;
  const end = new Date(new Date(start).getTime() + 24 * 3600 * 1000).toISOString();

  const { data: rows, error } = await supabase
    .from("credit_ledger")
    .select("user_id, action, delta")
    .gte("created_at", start)
    .lt("created_at", end)
    .limit(50000);
  if (error) throw new Error(`usage rollup query failed: ${error.message}`);

  let debitCount = 0;
  let creditsDebited = 0;
  let creditsRefunded = 0;
  let estCogsUsd = 0;
  const perUser = new Map<string, number>();

  for (const row of rows ?? []) {
    if (row.delta < 0) {
      const credits = -row.delta;
      const cogs = credits * cogsFactor(row.action);
      debitCount++;
      creditsDebited += credits;
      estCogsUsd += cogs;
      perUser.set(row.user_id, (perUser.get(row.user_id) ?? 0) + cogs);
    } else if (row.action.startsWith("refund.")) {
      // Refund = the external call failed, so its estimated cost didn't land.
      creditsRefunded += row.delta;
      const cogs = row.delta * 0.0067;
      estCogsUsd -= cogs;
      const prev = perUser.get(row.user_id) ?? 0;
      perUser.set(row.user_id, prev - cogs);
    }
  }

  let topUserId: string | null = null;
  let topUserCogsUsd = 0;
  for (const [userId, cogs] of perUser) {
    if (cogs > topUserCogsUsd) {
      topUserId = userId;
      topUserCogsUsd = cogs;
    }
  }

  return {
    day,
    debitCount,
    creditsDebited,
    creditsRefunded,
    estCogsUsd: Math.max(0, Math.round(estCogsUsd * 100) / 100),
    topUserId,
    topUserCogsUsd: Math.round(topUserCogsUsd * 100) / 100,
  };
}

export async function storeDailyUsage(usage: DailyUsage): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("usage_daily").upsert(
    {
      day: usage.day,
      debit_count: usage.debitCount,
      credits_debited: usage.creditsDebited,
      credits_refunded: usage.creditsRefunded,
      est_cogs_usd: usage.estCogsUsd,
      top_user_id: usage.topUserId,
      top_user_cogs_usd: usage.topUserCogsUsd,
    },
    { onConflict: "day" }
  );
  if (error) throw new Error(`usage rollup store failed: ${error.message}`);
}
