/**
 * Rate-limiter configuration.
 *
 * Centralizes all tier sizing and feature flags so the numbers live in one
 * place, away from the request paths. Tiers are built here and passed to
 * `enforceRateLimits` (see limiter.ts).
 */

import type { PlanId } from "@/types/subscription";
import type { TierSpec } from "./limiter";

/**
 * Master switch for the v2 limiter behavior (circuit breaker + in-memory
 * degradation). With this OFF, the shims in rate-limit.ts reproduce the legacy
 * fail-closed-in-prod / fail-open-in-dev posture exactly — a safe no-op refactor.
 */
export const RATELIMIT_V2 = process.env.RATELIMIT_V2 === "true";

/**
 * When the limiter is degraded (no Redis / breaker open), the global
 * tenant-fair tier fails CLOSED by default because it guards real upstream
 * spend. Flip this to let it degrade gracefully instead.
 */
export const RATELIMIT_GLOBAL_FAIL_OPEN =
  process.env.RATELIMIT_GLOBAL_FAIL_OPEN === "true";

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Fraction of the provider org budget we let our own traffic consume, leaving
 * headroom for retries and bursts before the provider itself starts 429ing.
 */
export const GLOBAL_SAFETY_FRACTION = num("LLM_GLOBAL_SAFETY_FRACTION", 0.7);

/**
 * Anthropic org-level ceilings (the account-wide limits the global tier
 * protects). Set these to your Anthropic console tier; defaults are deliberately
 * conservative. RPM = requests/min, ITPM/OTPM = input/output tokens/min.
 */
export const CLAUDE_ORG_RPM = num("CLAUDE_ORG_RPM", 1000);
export const CLAUDE_ORG_ITPM = num("CLAUDE_ORG_ITPM", 2_000_000);
export const CLAUDE_ORG_OTPM = num("CLAUDE_ORG_OTPM", 400_000);

/** Global request-rate budget for the whole app (safe fraction of org RPM). */
export const GLOBAL_RPM = Math.max(1, Math.floor(CLAUDE_ORG_RPM * GLOBAL_SAFETY_FRACTION));

/**
 * Combined token-per-minute budget the gateway admission gate meters against.
 * We track a single TPM bucket (input + output) sized off the tighter of the
 * two org limits, scaled by the safety fraction.
 */
export const GLOBAL_TPM = Math.max(
  1000,
  Math.floor(Math.min(CLAUDE_ORG_ITPM, CLAUDE_ORG_OTPM + CLAUDE_ORG_ITPM) * GLOBAL_SAFETY_FRACTION)
);

/**
 * Per-user burst (token bucket): a small burst allowance with steady refill,
 * scaled by plan. Capacity = max tokens; refill = tokens added per minute.
 */
const USER_BURST: Record<PlanId, { capacity: number; refillPerMin: number }> = {
  free: { capacity: 6, refillPerMin: 6 },
  pro: { capacity: 20, refillPerMin: 20 },
  agent: { capacity: 40, refillPerMin: 40 },
  agency: { capacity: 40, refillPerMin: 40 },
};

/** Per-user burst tier. `cost` lets heavier actions (agentic) consume more. */
export function userBurstTier(userId: string, plan: PlanId, cost = 1): TierSpec {
  const cfg = USER_BURST[plan] ?? USER_BURST.free;
  return {
    scope: "user",
    key: userId,
    algorithm: "tokenBucket",
    limit: cfg.capacity,
    refillRate: cfg.refillPerMin,
    window: "1 m",
    prefix: "llm:user",
    tokens: cost,
  };
}

/** Per-IP tier — backstop for unauthenticated / extension surfaces. */
export function ipTier(ip: string, cost = 1): TierSpec {
  return {
    scope: "ip",
    key: ip,
    algorithm: "tokenBucket",
    limit: num("RATELIMIT_IP_BURST", 30),
    refillRate: num("RATELIMIT_IP_REFILL", 30),
    window: "1 m",
    prefix: "llm:ip",
    tokens: cost,
  };
}

/**
 * Global tenant-fair request tier — one shared bucket protecting the upstream
 * account so no single user can starve everyone. Fails closed on degradation
 * unless RATELIMIT_GLOBAL_FAIL_OPEN is set.
 */
export function globalClaudeTier(cost = 1): TierSpec {
  return {
    scope: "global",
    key: "claude:rpm",
    algorithm: "tokenBucket",
    limit: GLOBAL_RPM,
    refillRate: GLOBAL_RPM,
    window: "1 m",
    prefix: "llm:global",
    tokens: cost,
    failOpen: RATELIMIT_GLOBAL_FAIL_OPEN,
  };
}

/**
 * Global token-per-minute admission tier used by the LLM gateway. `cost` is the
 * (estimated, then reconciled) token count for the call.
 */
export function globalTpmTier(cost: number): TierSpec {
  return {
    scope: "global_tpm",
    key: "claude:tpm",
    algorithm: "tokenBucket",
    limit: GLOBAL_TPM,
    refillRate: GLOBAL_TPM,
    window: "1 m",
    prefix: "llm:global",
    tokens: Math.max(1, Math.ceil(cost)),
    failOpen: RATELIMIT_GLOBAL_FAIL_OPEN,
  };
}
