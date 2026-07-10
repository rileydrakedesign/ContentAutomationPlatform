import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getUserSubscription } from "@/lib/stripe/subscription";
import { PLANS, isSubscriptionActive, type PlanConfig } from "@/types/subscription";
import { apiError } from "@/lib/api/response";
import { findLinks } from "@/lib/x-api/tweet-text";

// Credit costs for the agent surface (v1 API + MCP). Retail: 1 credit = $0.01.
// Source of truth: MCP_PROD_READINESS_PLAN.md §B2 — keep the two in sync.
// publish.tweet_with_url is 10x because X bills $0.20 for a post containing a
// URL vs $0.015 for a plain one (pay-per-use pricing, Feb 2026).
export const CREDIT_COSTS = {
  "drafts.generate": 3,
  "voice.check": 3,
  "insights.tuneup": 5,
  "publish.tweet": 3,
  "publish.tweet_with_url": 30,
  "tweets.read": 1,
  "search.per_post": 1,
  "analytics.read": 1,
  "analytics.sync": 15,
  "inspiration.create": 3,
} as const;

export type CreditAction = keyof typeof CREDIT_COSTS;

// Ledger action strings for debits beyond the cost map keys.
export const PUBLISH_DEBIT_ACTIONS = [
  "publish.tweet",
  "publish.tweet_with_url",
  "publish.thread",
  "publish.schedule",
] as const;

export interface CreditBalance {
  total: number;
  balance: number;
  packBalance: number;
  monthlyAllowance: number;
  resetsAt: string | null;
}

/**
 * Whether X would bill this post at the URL rate ($0.20 vs $0.015). Uses the
 * canonical link detection in tweet-text (LINKED_TLDS allowlist, emails
 * excluded) so billing, char counting, and the assistant's link findings can
 * never disagree on "does this post contain a link". A miss undercharges one
 * post by ~$0.19; a false positive overcharges a user 27 cents.
 */
export function containsUrl(text: string): boolean {
  return findLinks(text).length > 0;
}

/** Credit cost for publishing these tweet texts (thread = sum of tweets). */
export function publishCreditCost(texts: string[]): number {
  return texts.reduce(
    (sum, t) =>
      sum +
      (containsUrl(t)
        ? CREDIT_COSTS["publish.tweet_with_url"]
        : CREDIT_COSTS["publish.tweet"]),
    0
  );
}

export async function effectivePlan(userId: string): Promise<PlanConfig> {
  const sub = await getUserSubscription(userId);
  const plan = PLANS[sub.plan_id] || PLANS.free;
  return isSubscriptionActive(sub) ? plan : PLANS.free;
}

/**
 * Initialize the user's credits row (first metered request) and apply any due
 * monthly reset. Safe and cheap to call on every metered request.
 */
export async function ensureCredits(userId: string): Promise<void> {
  const plan = await effectivePlan(userId);
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("ensure_user_credits", {
    p_user_id: userId,
    p_allowance: plan.limits.monthlyCredits,
  });
  if (error) throw new Error(`ensure_user_credits failed: ${error.message}`);
}

export type DebitResult =
  | { ok: true; total: number }
  | { ok: false; total: number; required: number };

/** Atomically debit credits (allowance bucket first, then packs). */
export async function debitCredits(
  userId: string,
  amount: number,
  action: string,
  referenceId?: string
): Promise<DebitResult> {
  await ensureCredits(userId);

  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("debit_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_action: action,
    p_reference: referenceId ?? null,
  });
  if (error) throw new Error(`debit_credits failed: ${error.message}`);

  const result = data as { ok: boolean; total: number; required?: number };
  if (result.ok) return { ok: true, total: result.total };
  return { ok: false, total: result.total ?? 0, required: result.required ?? amount };
}

/**
 * Refund a failed debit. Goes to the allowance bucket, never packs —
 * refunding into packs would let schedule+cancel launder expiring monthly
 * credits into non-expiring pack credits.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  action: string,
  referenceId?: string
): Promise<void> {
  if (amount <= 0) return;
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_action: action,
    p_to_pack: false,
    p_pack_id: null,
    p_reference: referenceId ?? null,
  });
  if (error) throw new Error(`refund grant_credits failed: ${error.message}`);
}

/** Grant purchased pack credits (Stripe webhook fulfillment). */
export async function grantPackCredits(
  userId: string,
  amount: number,
  packId: string,
  referenceId: string
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: amount,
    p_action: "pack.purchase",
    p_to_pack: true,
    p_pack_id: packId,
    p_reference: referenceId,
  });
  if (error) throw new Error(`pack grant_credits failed: ${error.message}`);
}

export async function getCredits(userId: string): Promise<CreditBalance> {
  await ensureCredits(userId);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_credits")
    .select("balance, pack_balance, monthly_allowance, allowance_resets_at")
    .eq("user_id", userId)
    .single();
  if (error || !data) throw new Error(`getCredits failed: ${error?.message}`);
  return {
    total: data.balance + data.pack_balance,
    balance: data.balance,
    packBalance: data.pack_balance,
    monthlyAllowance: data.monthly_allowance,
    resetsAt: data.allowance_resets_at,
  };
}

/** Cron entrypoint: reset all due monthly allowances. Returns users reset. */
export async function resetDueAllowances(): Promise<number> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("reset_due_allowances");
  if (error) throw new Error(`reset_due_allowances failed: ${error.message}`);
  return (data as number) ?? 0;
}

/**
 * Per-plan daily action caps — abuse backstop on top of credits. Counted from
 * today's ledger debits, so only successful charges count and refunds (which
 * use distinct `refund.*` actions) don't offset.
 */
export async function checkDailyActionCap(
  userId: string,
  kind: "publish" | "generate"
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const plan = await effectivePlan(userId);
  const limit =
    kind === "publish"
      ? plan.limits.apiPublishPerDay
      : plan.limits.apiGeneratePerDay;

  const actions =
    kind === "publish" ? [...PUBLISH_DEBIT_ACTIONS] : ["drafts.generate"];

  const supabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];
  const { count, error } = await supabase
    .from("credit_ledger")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .lt("delta", 0)
    .in("action", actions)
    .gte("created_at", `${today}T00:00:00Z`);
  if (error) throw new Error(`daily cap check failed: ${error.message}`);

  const used = count ?? 0;
  return { allowed: used < limit, used, limit };
}

/**
 * Route helper: charge credits or return the ready-made error response.
 * Usage:
 *   const charge = await requireCredits(userId, cost, "publish.tweet", id);
 *   if (charge instanceof NextResponse) return charge;
 *   // ... on hard external failure: await refundCredits(...)
 */
export async function requireCredits(
  userId: string,
  amount: number,
  action: string,
  referenceId?: string
): Promise<NextResponse | { charged: number; remaining: number }> {
  if (amount <= 0) return { charged: 0, remaining: (await getCredits(userId)).total };

  const result = await debitCredits(userId, amount, action, referenceId);
  if (!result.ok) {
    return apiError("Insufficient credits", "INSUFFICIENT_CREDITS", 402, {
      balance: result.total,
      required: result.required,
      topup_url: "/settings?tab=billing",
    });
  }
  return { charged: amount, remaining: result.total };
}

/** Stamp credit headers on a metered response. */
export function withCreditHeaders(
  response: NextResponse,
  charge: { charged: number; remaining: number }
): NextResponse {
  response.headers.set("X-Credits-Charged", String(charge.charged));
  response.headers.set("X-Credits-Remaining", String(charge.remaining));
  return response;
}
