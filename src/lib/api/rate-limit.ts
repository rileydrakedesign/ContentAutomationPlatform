/**
 * Thin compatibility shims over the unified limiter core (limiter.ts).
 *
 * These preserve the exact signatures and Redis-key prefixes of the original
 * functions so every existing call site (v1 handler, the in-app burst guards,
 * auth/login/oauth endpoints) keeps working unchanged. With RATELIMIT_V2 off,
 * behavior is identical to the pre-refactor implementation; with it on, the
 * core adds graceful degradation.
 */

import { enforceRateLimits } from "./limiter";
import { RateLimitInfo } from "./response";

// Check rate limit for an API key (or any keyed identity). Sliding window, 1m,
// "api_v1" namespace — matches the legacy behavior and existing Redis keys.
export async function checkRateLimit(
  keyId: string,
  limit: number
): Promise<{ allowed: true; info: RateLimitInfo } | { allowed: false; info: RateLimitInfo }> {
  const res = await enforceRateLimits([
    {
      scope: "key",
      key: keyId,
      algorithm: "slidingWindow",
      limit,
      window: "1 m",
      prefix: "api_v1",
    },
  ]);
  return res.allowed
    ? { allowed: true, info: res.info }
    : { allowed: false, info: res.info };
}

// Rate limit auth endpoints by an arbitrary identifier (IP, email). Sliding
// window in the "auth" namespace — matches legacy behavior and Redis keys.
export async function checkAuthRateLimit(
  identifier: string,
  limit: number,
  window: "1 m" | "1 h"
): Promise<boolean> {
  const res = await enforceRateLimits([
    {
      scope: "auth",
      key: identifier,
      algorithm: "slidingWindow",
      limit,
      window,
      prefix: "auth",
    },
  ]);
  return res.allowed;
}
