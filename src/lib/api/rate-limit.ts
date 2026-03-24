import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { RateLimitInfo } from "./response";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  redis = new Redis({ url, token });
  return redis;
}

// Check rate limit for an API key. Returns null if rate limiting is not configured (no Redis).
export async function checkRateLimit(
  keyId: string,
  limit: number
): Promise<{ allowed: true; info: RateLimitInfo } | { allowed: false; info: RateLimitInfo }> {
  const r = getRedis();

  if (!r) {
    // No Redis configured — allow all requests (dev/local)
    return {
      allowed: true,
      info: { limit, remaining: limit, reset: Math.floor(Date.now() / 1000) + 60 },
    };
  }

  const ratelimit = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(limit, "1 m"),
    prefix: "api_v1",
  });

  const result = await ratelimit.limit(keyId);

  const info: RateLimitInfo = {
    limit: result.limit,
    remaining: result.remaining,
    reset: Math.floor(result.reset / 1000),
  };

  return { allowed: result.success, info };
}
