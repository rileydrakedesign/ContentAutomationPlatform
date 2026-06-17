import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

const rpcMock = vi.fn();
const countResult: { count: number | null; error: null } = { count: 0, error: null };

// Chainable query stub: any method returns the chain; awaiting it resolves to
// the configured count result (only checkDailyActionCap awaits a from() chain
// in these tests).
function makeChain() {
  const chain: Record<string, unknown> = {};
  for (const m of ["select", "eq", "lt", "in", "gte", "single"]) {
    chain[m] = vi.fn(() => chain);
  }
  (chain as { then: unknown }).then = (resolve: (v: unknown) => void) =>
    resolve(countResult);
  return chain;
}

vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: () => ({
    rpc: rpcMock,
    from: () => makeChain(),
  }),
}));

vi.mock("@/lib/stripe/subscription", () => ({
  getUserSubscription: vi.fn(async () => ({
    plan_id: "free",
    stripe_customer_id: null,
    stripe_subscription_id: null,
    status: "active",
    current_period_end: null,
    cancel_at_period_end: false,
  })),
}));

import {
  requireCredits,
  refundCredits,
  debitCredits,
  checkDailyActionCap,
  withCreditHeaders,
  publishCreditCost,
  CREDIT_COSTS,
} from "./credits";

const USER = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  rpcMock.mockReset();
  countResult.count = 0;
  // ensure_user_credits succeeds by default
  rpcMock.mockImplementation(async (fn: string) => {
    if (fn === "ensure_user_credits") return { data: null, error: null };
    return { data: { ok: true, total: 97 }, error: null };
  });
});

describe("requireCredits", () => {
  it("returns a 402 with the documented shape when credits are insufficient", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "ensure_user_credits") return { data: null, error: null };
      return {
        data: { ok: false, error: "insufficient_credits", total: 2, required: 30 },
        error: null,
      };
    });

    const result = await requireCredits(USER, 30, "publish.tweet_with_url");
    expect(result).toBeInstanceOf(NextResponse);

    const res = result as NextResponse;
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe("INSUFFICIENT_CREDITS");
    expect(body.balance).toBe(2);
    expect(body.required).toBe(30);
    expect(body.topup_url).toBeTruthy();
  });

  it("returns charge info on success", async () => {
    const result = await requireCredits(USER, 3, "publish.tweet", "draft-1");
    expect(result).toEqual({ charged: 3, remaining: 97 });

    const debitCall = rpcMock.mock.calls.find(([fn]) => fn === "debit_credits");
    expect(debitCall?.[1]).toMatchObject({
      p_user_id: USER,
      p_amount: 3,
      p_action: "publish.tweet",
      p_reference: "draft-1",
    });
  });
});

describe("debitCredits", () => {
  it("maps an insufficient result with total and required", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "ensure_user_credits") return { data: null, error: null };
      return {
        data: { ok: false, error: "insufficient_credits", total: 5, required: 15 },
        error: null,
      };
    });
    const result = await debitCredits(USER, 15, "analytics.sync");
    expect(result).toEqual({ ok: false, total: 5, required: 15 });
  });

  it("throws when the RPC itself errors", async () => {
    rpcMock.mockImplementation(async (fn: string) => {
      if (fn === "ensure_user_credits") return { data: null, error: null };
      return { data: null, error: { message: "boom" } };
    });
    await expect(debitCredits(USER, 3, "drafts.generate")).rejects.toThrow("boom");
  });
});

describe("refundCredits", () => {
  it("grants back to the allowance bucket (never packs)", async () => {
    await refundCredits(USER, 9, "refund.thread_partial", "draft-2");
    const grantCall = rpcMock.mock.calls.find(([fn]) => fn === "grant_credits");
    expect(grantCall?.[1]).toMatchObject({
      p_user_id: USER,
      p_amount: 9,
      p_action: "refund.thread_partial",
      p_to_pack: false,
      p_reference: "draft-2",
    });
  });

  it("is a no-op for zero or negative amounts", async () => {
    await refundCredits(USER, 0, "refund.publish_failed");
    await refundCredits(USER, -3, "refund.publish_failed");
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("checkDailyActionCap", () => {
  it("allows under the free-plan publish cap and blocks at it", async () => {
    countResult.count = 4; // free plan: 5 publishes/day
    expect(await checkDailyActionCap(USER, "publish")).toEqual({
      allowed: true,
      used: 4,
      limit: 5,
    });

    countResult.count = 5;
    expect(await checkDailyActionCap(USER, "publish")).toEqual({
      allowed: false,
      used: 5,
      limit: 5,
    });
  });
});

describe("partial-thread refund math", () => {
  it("refunds exactly the un-posted remainder, preserving URL surcharges", () => {
    const tweets = ["one", "two with example.com", "three"];
    // Suppose only the first tweet posted before X failed:
    const refund = publishCreditCost(tweets.slice(1));
    expect(refund).toBe(30 + 3);
    // The posted prefix stays charged:
    expect(publishCreditCost(tweets) - refund).toBe(3);
  });
});

describe("voice check metering", () => {
  it("prices voice.check at 3 credits, consistent with generation", () => {
    expect(CREDIT_COSTS["voice.check"]).toBe(3);
    expect(CREDIT_COSTS["voice.check"]).toBe(CREDIT_COSTS["drafts.generate"]);
  });

  it("prices insights.tuneup at 5 credits (multiple model calls)", () => {
    expect(CREDIT_COSTS["insights.tuneup"]).toBe(5);
  });

  it("charges and reports the voice.check debit", async () => {
    const result = await requireCredits(USER, CREDIT_COSTS["voice.check"], "voice.check");
    expect(result).toEqual({ charged: 3, remaining: 97 });

    const debitCall = rpcMock.mock.calls.find(([fn]) => fn === "debit_credits");
    expect(debitCall?.[1]).toMatchObject({
      p_user_id: USER,
      p_amount: 3,
      p_action: "voice.check",
    });
  });
});

describe("withCreditHeaders", () => {
  it("stamps charge headers on the response", () => {
    const res = withCreditHeaders(NextResponse.json({ ok: true }), {
      charged: 3,
      remaining: 42,
    });
    expect(res.headers.get("X-Credits-Charged")).toBe("3");
    expect(res.headers.get("X-Credits-Remaining")).toBe("42");
  });
});
