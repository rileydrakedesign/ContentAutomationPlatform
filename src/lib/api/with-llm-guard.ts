/**
 * In-app LLM route guard.
 *
 * Per-request rate limiting for the cookie/extension-authenticated LLM routes
 * (the public v1 API uses withApiAuth instead). This is the burst protection
 * that closes the gap where in-app routes only had a daily quota — a user (or a
 * looping extension) could otherwise hammer e.g. /api/generate-reply all day
 * within their daily allowance.
 *
 * It runs ALONGSIDE the daily quota (requireAiGeneration / credits): a rate
 * limit caps requests-per-minute, the quota caps requests-per-day. Both apply.
 */

import { NextRequest, NextResponse } from "next/server";
import type { PlanId } from "@/types/subscription";
import { PLANS, isSubscriptionActive } from "@/types/subscription";
import { getUserSubscription } from "@/lib/stripe/subscription";
import { getCorsHeaders } from "@/lib/cors";
import { enforceRateLimits, type TierSpec } from "./limiter";
import { rateLimited, withRateLimitHeaders, type RateLimitInfo } from "./response";
import { userBurstTier, ipTier, globalClaudeTier } from "./limiter-config";

/** Trusted client IP: x-real-ip (Vercel, unspoofable) then the proxy-appended
 *  rightmost x-forwarded-for entry. Mirrors the auth routes. */
export function clientIp(request: NextRequest): string {
  return (
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    "unknown"
  );
}

/** Resolve the user's effective plan (downgrades to free if sub is inactive). */
async function effectivePlanId(userId: string, planHint?: PlanId): Promise<PlanId> {
  if (planHint) return planHint;
  const sub = await getUserSubscription(userId);
  return isSubscriptionActive(sub) ? (PLANS[sub.plan_id]?.id ?? "free") : "free";
}

export interface LlmGuardOptions {
  /** The incoming request — used to attach origin-correct CORS to the 429. */
  request: NextRequest;
  /** Authenticated user id (resolve via getDualAuthUser / getUser first). */
  userId: string;
  /** Pass if the caller already loaded the subscription, to skip a DB round-trip. */
  plan?: PlanId;
  /** Token cost of this action — heavier actions use >1. */
  cost?: number;
  /** Also apply the per-IP tier (extension / high-volume surfaces). */
  ip?: string;
}

export type LlmGuardResult =
  | { ok: true; info: RateLimitInfo }
  | { ok: false; response: NextResponse };

/**
 * Enforce the in-app LLM rate-limit tiers (per-user burst + optional per-IP +
 * global tenant-fair). Returns a ready-to-send 429 (with the route's CORS, so
 * the extension/web can read it) on failure, or the rate-limit info to stamp
 * onto the success response on pass.
 */
export async function guardLlmRoute(options: LlmGuardOptions): Promise<LlmGuardResult> {
  const { request, userId, cost = 1, ip } = options;
  const plan = await effectivePlanId(userId, options.plan);

  const tiers: TierSpec[] = [userBurstTier(userId, plan, cost)];
  if (ip) tiers.push(ipTier(ip, cost));
  tiers.push(globalClaudeTier(cost));

  const res = await enforceRateLimits(tiers);
  if (!res.allowed) {
    const response = rateLimited(res.info, res.failedScope ?? undefined);
    // Overlay origin-aware CORS (extension/app) over the v1 defaults.
    Object.entries(getCorsHeaders(request)).forEach(([k, v]) => response.headers.set(k, v));
    return { ok: false, response };
  }
  return { ok: true, info: res.info };
}

/** Stamp X-RateLimit-* headers from a successful guard onto a Response. */
export function withLlmRateLimitHeaders(response: NextResponse, info: RateLimitInfo): NextResponse {
  return withRateLimitHeaders(response, info);
}
