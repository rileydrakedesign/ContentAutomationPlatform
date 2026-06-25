/**
 * Unified rate-limiting core.
 *
 * Single place the Upstash Redis limiter is touched. Both the public-API path
 * (withApiAuth) and the in-app path (with-llm-guard) delegate here via tiers.
 *
 * Two behaviors, selected by the RATELIMIT_V2 flag (see limiter-config.ts):
 *
 *  - V2 OFF (default): legacy posture — sliding-window only, fail CLOSED in
 *    production when Redis is unavailable, fail OPEN in development. Byte-for-byte
 *    the same as the original rate-limit.ts so flipping nothing changes nothing.
 *
 *  - V2 ON: adds a per-instance circuit breaker + in-memory token-bucket
 *    fallback so a Redis blip degrades (per-instance, conservative) instead of
 *    taking the whole product down. Tiers that guard real upstream spend can opt
 *    into fail-closed-on-degradation via `failOpen: false`.
 */

import { Ratelimit, type Duration } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";
import type { RateLimitInfo } from "./response";
import { RATELIMIT_V2 } from "./limiter-config";

export type LimiterAlgorithm = "slidingWindow" | "tokenBucket";

export interface TierSpec {
  /** Human-readable scope name, surfaced in 429 bodies/metrics (user/ip/key/global). */
  scope: string;
  /** The identity value to limit on (userId, ip, keyId, "claude:rpm", ...). */
  key: string;
  algorithm: LimiterAlgorithm;
  /** Sliding window: max requests per window. Token bucket: bucket capacity. */
  limit: number;
  /** Token bucket only: tokens refilled per `window`. Defaults to `limit`. */
  refillRate?: number;
  window: Duration;
  /** Redis key namespace. Preserved across the legacy shims ("api_v1", "auth"). */
  prefix: string;
  /** Cost of this request in tokens. Defaults to 1. */
  tokens?: number;
  /**
   * Degradation posture (V2 only). `false` => fail CLOSED when degraded (block);
   * anything else => degrade gracefully via the in-memory fallback bucket.
   */
  failOpen?: boolean;
}

export interface EnforceResult {
  allowed: boolean;
  info: RateLimitInfo;
  failedScope: string | null;
}

// ---------------------------------------------------------------------------
// Redis singleton + Ratelimit cache
// ---------------------------------------------------------------------------

let redis: Redis | null = null;
let redisResolved = false;

function getRedis(): Redis | null {
  if (redisResolved) return redis;
  redisResolved = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) redis = new Redis({ url, token });
  return redis;
}

const limiters = new Map<string, Ratelimit>();

function getLimiter(r: Redis, t: TierSpec): Ratelimit {
  const id = `${t.algorithm}:${t.prefix}:${t.limit}:${t.refillRate ?? 0}:${t.window}`;
  let rl = limiters.get(id);
  if (!rl) {
    const limiter =
      t.algorithm === "tokenBucket"
        ? Ratelimit.tokenBucket(t.refillRate ?? t.limit, t.window, t.limit)
        : Ratelimit.slidingWindow(t.limit, t.window);
    rl = new Ratelimit({ redis: r, limiter, prefix: t.prefix });
    limiters.set(id, rl);
  }
  return rl;
}

// ---------------------------------------------------------------------------
// Circuit breaker (in-process, per serverless instance) — V2 only
// ---------------------------------------------------------------------------

const BREAKER_THRESHOLD = 5; // consecutive Redis failures before opening
const BREAKER_COOLDOWN_MS = 10_000;

let consecutiveFailures = 0;
let breakerOpenUntil = 0;

function breakerIsOpen(now: number): boolean {
  return now < breakerOpenUntil;
}

function recordRedisSuccess(): void {
  consecutiveFailures = 0;
}

function recordRedisFailure(now: number, err: unknown): void {
  consecutiveFailures++;
  if (consecutiveFailures >= BREAKER_THRESHOLD) {
    breakerOpenUntil = now + BREAKER_COOLDOWN_MS;
    consecutiveFailures = 0;
    Sentry.captureMessage("redis_circuit_open", {
      level: "warning",
      tags: { component: "ratelimit" },
      extra: { error: String(err), cooldownMs: BREAKER_COOLDOWN_MS },
    });
  }
}

// ---------------------------------------------------------------------------
// In-memory fallback token bucket (V2 degradation) — per instance, conservative
// ---------------------------------------------------------------------------

interface FallbackBucket {
  tokens: number;
  last: number;
}

const fallbackBuckets = new Map<string, FallbackBucket>();

function windowMs(window: Duration): number {
  const m = /^(\d+)\s*([smhd])$/.exec(window.trim());
  if (!m) return 60_000;
  const n = Number(m[1]);
  const unit = m[2];
  const mult = unit === "s" ? 1000 : unit === "m" ? 60_000 : unit === "h" ? 3_600_000 : 86_400_000;
  return n * mult;
}

function fallbackLimit(t: TierSpec, now: number): { allowed: boolean; info: RateLimitInfo } {
  const cost = t.tokens ?? 1;
  const capacity = t.limit;
  const refillPerMs = (t.refillRate ?? t.limit) / windowMs(t.window);
  const id = `${t.prefix}:${t.key}`;

  let b = fallbackBuckets.get(id);
  if (!b) {
    b = { tokens: capacity, last: now };
    fallbackBuckets.set(id, b);
  }
  b.tokens = Math.min(capacity, b.tokens + (now - b.last) * refillPerMs);
  b.last = now;

  let allowed: boolean;
  if (b.tokens >= cost) {
    b.tokens -= cost;
    allowed = true;
  } else {
    allowed = false;
  }
  const deficit = allowed ? 0 : cost - b.tokens;
  const reset = Math.floor((now + (refillPerMs > 0 ? deficit / refillPerMs : windowMs(t.window))) / 1000);
  return { allowed, info: { limit: capacity, remaining: Math.max(0, Math.floor(b.tokens)), reset } };
}

// ---------------------------------------------------------------------------
// Tier evaluation
// ---------------------------------------------------------------------------

function failClosed(t: TierSpec, now: number): { allowed: false; info: RateLimitInfo } {
  return { allowed: false, info: { limit: t.limit, remaining: 0, reset: Math.floor(now / 1000) + 60 } };
}

function failOpen(t: TierSpec, now: number): { allowed: true; info: RateLimitInfo } {
  return { allowed: true, info: { limit: t.limit, remaining: t.limit, reset: Math.floor(now / 1000) + 60 } };
}

function degrade(t: TierSpec, now: number): { allowed: boolean; info: RateLimitInfo } {
  // Tiers guarding upstream spend (failOpen === false) block when degraded;
  // everything else degrades gracefully through the per-instance bucket.
  if (t.failOpen === false) return failClosed(t, now);
  Sentry.addBreadcrumb({
    category: "ratelimit",
    level: "warning",
    message: "ratelimit_fallback_active",
    data: { scope: t.scope },
  });
  return fallbackLimit(t, now);
}

async function checkTier(t: TierSpec): Promise<{ allowed: boolean; info: RateLimitInfo }> {
  const now = Date.now();
  const r = getRedis();
  const cost = t.tokens ?? 1;
  const limitOpts = cost === 1 ? undefined : { rate: cost };

  if (!RATELIMIT_V2) {
    // ----- Legacy path: mirrors the original rate-limit.ts exactly. Errors
    // propagate (no catch) just like before; no breaker, no fallback. -----
    if (!r) {
      if (process.env.NODE_ENV === "production") {
        console.error(
          "Rate limiter has no Redis configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN). Rejecting request."
        );
        return failClosed(t, now);
      }
      return failOpen(t, now);
    }
    const result = await getLimiter(r, t).limit(t.key, limitOpts);
    return {
      allowed: result.success,
      info: { limit: result.limit, remaining: result.remaining, reset: Math.floor(result.reset / 1000) },
    };
  }

  // ----- V2 path: breaker + graceful degradation -----
  if (!r || breakerIsOpen(now)) {
    return degrade(t, now);
  }
  try {
    const result = await getLimiter(r, t).limit(t.key, limitOpts);
    recordRedisSuccess();
    return {
      allowed: result.success,
      info: { limit: result.limit, remaining: result.remaining, reset: Math.floor(result.reset / 1000) },
    };
  } catch (err) {
    recordRedisFailure(now, err);
    return degrade(t, now);
  }
}

/**
 * Evaluate tiers most-specific → broadest, first failure wins. On success the
 * returned info reflects the most restrictive tier (lowest remaining) so the
 * X-RateLimit-* headers tell the client the tightest budget they're under.
 */
export async function enforceRateLimits(tiers: TierSpec[]): Promise<EnforceResult> {
  let mostRestrictive: RateLimitInfo | null = null;
  for (const t of tiers) {
    const { allowed, info } = await checkTier(t);
    if (!allowed) {
      return { allowed: false, info, failedScope: t.scope };
    }
    if (!mostRestrictive || info.remaining < mostRestrictive.remaining) {
      mostRestrictive = info;
    }
  }
  return {
    allowed: true,
    info: mostRestrictive ?? { limit: 0, remaining: 0, reset: Math.floor(Date.now() / 1000) + 60 },
    failedScope: null,
  };
}
