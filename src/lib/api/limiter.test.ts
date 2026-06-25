import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// These exercise the V2 graceful-degradation path: with RATELIMIT_V2 on and no
// Redis configured, enforceRateLimits falls back to the per-instance in-memory
// token bucket (or fails closed for tiers that guard upstream spend).
describe("enforceRateLimits — in-memory fallback (RATELIMIT_V2, no Redis)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("RATELIMIT_V2", "true");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("allows up to bucket capacity, then blocks", async () => {
    const { enforceRateLimits } = await import("./limiter");
    const tier = {
      scope: "test",
      key: "user-1",
      algorithm: "tokenBucket" as const,
      limit: 2,
      refillRate: 1,
      window: "1 m" as const,
      prefix: "test",
    };
    const r1 = await enforceRateLimits([tier]);
    const r2 = await enforceRateLimits([tier]);
    const r3 = await enforceRateLimits([tier]);

    expect(r1.allowed).toBe(true);
    expect(r2.allowed).toBe(true);
    expect(r3.allowed).toBe(false);
    expect(r3.failedScope).toBe("test");
    expect(r3.info.remaining).toBe(0);
  });

  it("isolates buckets per key", async () => {
    const { enforceRateLimits } = await import("./limiter");
    const mk = (key: string) => ({
      scope: "test",
      key,
      algorithm: "tokenBucket" as const,
      limit: 1,
      refillRate: 1,
      window: "1 m" as const,
      prefix: "test",
    });
    expect((await enforceRateLimits([mk("a")])).allowed).toBe(true);
    expect((await enforceRateLimits([mk("a")])).allowed).toBe(false);
    // Different key has its own bucket.
    expect((await enforceRateLimits([mk("b")])).allowed).toBe(true);
  });

  it("fails closed for tiers marked failOpen:false when degraded", async () => {
    const { enforceRateLimits } = await import("./limiter");
    const r = await enforceRateLimits([
      {
        scope: "global",
        key: "claude",
        algorithm: "tokenBucket" as const,
        limit: 1000,
        window: "1 m" as const,
        prefix: "global",
        failOpen: false,
      },
    ]);
    expect(r.allowed).toBe(false);
    expect(r.failedScope).toBe("global");
  });
});

describe("checkRateLimit shim — legacy posture (RATELIMIT_V2 off, no Redis)", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("RATELIMIT_V2", "false");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("fails open in non-production when Redis is absent (matches legacy dev behavior)", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const { checkRateLimit } = await import("./rate-limit");
    const res = await checkRateLimit("key-1", 10);
    expect(res.allowed).toBe(true);
  });

  it("fails closed in production when Redis is absent (matches legacy prod behavior)", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const { checkRateLimit } = await import("./rate-limit");
    const res = await checkRateLimit("key-1", 10);
    expect(res.allowed).toBe(false);
    expect(res.info.remaining).toBe(0);
  });
});
