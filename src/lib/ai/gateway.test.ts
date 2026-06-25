import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Gateway behavior is tested against a non-Claude provider so the admission gate
// (Claude-only) and the Redis-backed breaker (no Redis in tests) are no-ops, and
// we can focus on retry/backoff/error-mapping. Metering is best-effort and
// swallows its own errors, so it doesn't interfere.
describe("runThroughGateway", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("retries a transient error then succeeds", async () => {
    const { runThroughGateway } = await import("./gateway");
    let calls = 0;
    const { value, usage } = await runThroughGateway({
      provider: "openai",
      model: "test-model",
      estimatedTokens: 10,
      exec: async () => {
        calls++;
        if (calls < 2) {
          const e = new Error("rate limited") as Error & { status: number };
          e.status = 429;
          throw e;
        }
        return { value: "ok", usage: { input: 5, output: 7 } };
      },
    });
    expect(value).toBe("ok");
    expect(usage).toEqual({ input: 5, output: 7 });
    expect(calls).toBe(2);
  });

  it("throws ProviderUnavailableError after exhausting transient retries", async () => {
    const { runThroughGateway, ProviderUnavailableError } = await import("./gateway");
    await expect(
      runThroughGateway({
        provider: "openai",
        model: "test-model",
        estimatedTokens: 10,
        exec: async () => {
          const e = new Error("overloaded") as Error & { status: number };
          e.status = 529;
          throw e;
        },
      })
    ).rejects.toBeInstanceOf(ProviderUnavailableError);
  });

  it("rethrows a non-transient error immediately without retrying", async () => {
    const { runThroughGateway } = await import("./gateway");
    let calls = 0;
    await expect(
      runThroughGateway({
        provider: "openai",
        model: "test-model",
        estimatedTokens: 10,
        exec: async () => {
          calls++;
          const e = new Error("bad request") as Error & { status: number };
          e.status = 400;
          throw e;
        },
      })
    ).rejects.toThrow("bad request");
    expect(calls).toBe(1);
  });
});

describe("estimateChatTokens", () => {
  it("approximates prompt chars / 4 plus the output budget", async () => {
    const { estimateChatTokens } = await import("./gateway");
    const est = estimateChatTokens([{ role: "user", content: "a".repeat(40) }], 100);
    expect(est).toBe(110);
  });
});
