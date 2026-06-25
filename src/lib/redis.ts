/**
 * Shared Upstash Redis client (lazy singleton).
 *
 * Used by the LLM gateway (admission counters, provider circuit breaker) and
 * token-usage metering. Returns null when Redis isn't configured so callers can
 * degrade gracefully rather than throw. The rate limiter keeps its own instance
 * in limiter.ts to avoid perturbing its legacy-parity behavior.
 */

import { Redis } from "@upstash/redis";

let client: Redis | null = null;
let resolved = false;

export function getRedisClient(): Redis | null {
  if (resolved) return client;
  resolved = true;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) client = new Redis({ url, token });
  return client;
}
