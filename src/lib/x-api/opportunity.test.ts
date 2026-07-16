import { describe, it, expect } from "vitest";
import { admitToQueue, assessOpportunity } from "./opportunity";
import { tractionScore, type EnrichedSearchTweet } from "./search-mapping";

const NOW = Date.parse("2026-07-08T12:00:00Z");

function target(over: {
  followers?: number | null;
  following?: number | null;
  replies?: number;
  views?: number;
  likes?: number;
  ageMinutes?: number;
  text?: string;
}): EnrichedSearchTweet {
  const ageMin = over.ageMinutes ?? 120;
  return {
    id: "t1",
    text: over.text ?? "post",
    created_at: new Date(NOW - ageMin * 60_000).toISOString(),
    metrics: {
      like_count: over.likes ?? 50,
      retweet_count: 2,
      reply_count: over.replies ?? 10,
      quote_count: 0,
      bookmark_count: 1,
      impression_count: over.views ?? 20_000,
    },
    author: {
      username: "a",
      name: "A",
      followers_count: "followers" in over ? over.followers ?? null : 20_000,
      following_count: over.following ?? null,
    },
    reply_settings: "everyone",
    is_auth_mentioned: false,
    reply_allowed: true,
    reply_eligibility: "open",
  };
}

describe("assessOpportunity — Opportunity 2.0 v0.5 (author band · competition · freshness · traction)", () => {
  it("boosts the proven 10k–100k band over a mega account with identical metrics", () => {
    const band = assessOpportunity(target({ followers: 25_000 }), NOW);
    const mega = assessOpportunity(target({ followers: 800_000 }), NOW);
    expect(band.score).toBeGreaterThan(mega.score);
    expect(band.reasons.join(" ")).toContain("10k–100k");
    expect(mega.reasons.join(" ")).toContain("buried");
  });

  it("penalizes crowded posts and rewards early low-competition windows", () => {
    const crowded = assessOpportunity(target({ replies: 200, views: 50_000 }), NOW);
    const early = assessOpportunity(target({ replies: 4, views: 50_000 }), NOW);
    expect(early.score).toBeGreaterThan(crowded.score);
    expect(crowded.reasons.join(" ")).toContain("Crowded");
    expect(early.reasons.join(" ")).toContain("Early");
  });

  it("emits a freshness reason inside the reply window, none for stale posts", () => {
    expect(
      assessOpportunity(target({ ageMinutes: 30 }), NOW).reasons.join(" ")
    ).toContain("Fresh — 30 min old");
    expect(
      assessOpportunity(target({ ageMinutes: 60 * 20 }), NOW).reasons.join(" ")
    ).not.toMatch(/Fresh|window/);
  });

  it("degrades gracefully with no author metrics: pure canonical traction, no invented reasons", () => {
    const t = target({ followers: null, replies: 10, views: 0, likes: 50 });
    const res = assessOpportunity(t, NOW);
    expect(res.score).toBeCloseTo(tractionScore(t, NOW), 10);
    expect(res.reasons.join(" ")).not.toMatch(/followers/);
  });

  it("score is built on the canonical shared traction signal", () => {
    const t = target({ followers: 25_000, replies: 4, views: 50_000 });
    expect(assessOpportunity(t, NOW).score).toBeCloseTo(
      tractionScore(t, NOW) * 1.5 * 1.2,
      10
    );
  });

  it("velocity: an accelerating candidate (pool snapshots) outranks a stalled twin", () => {
    const t = target({ followers: 25_000, replies: 10, views: 20_000, likes: 300 });
    const prevSweptAtMs = NOW - 60 * 60_000; // snapshot 1h ago
    const accelerating = assessOpportunity(t, NOW, {
      prevMetrics: { like_count: 100, retweet_count: 2, reply_count: 5, impression_count: 5_000 },
      prevSweptAtMs,
    });
    const stalled = assessOpportunity(t, NOW, {
      prevMetrics: t.metrics!, // identical snapshot — nothing moved
      prevSweptAtMs,
    });
    expect(accelerating.score).toBeGreaterThan(stalled.score);
    expect(accelerating.reasons.join(" ")).toContain("Accelerating");
    expect(stalled.reasons.join(" ")).not.toContain("Accelerating");
  });

  it("velocity needs a real interval — a snapshot 2 minutes ago is ignored", () => {
    const t = target({});
    const res = assessOpportunity(t, NOW, {
      prevMetrics: { like_count: 0 },
      prevSweptAtMs: NOW - 2 * 60_000,
    });
    expect(res.reasons.join(" ")).not.toContain("Accelerating");
    expect(res.score).toBeCloseTo(assessOpportunity(t, NOW).score, 10);
  });

  it("zero views is neutral, never a boost (no 'low competition' on undistributed posts)", () => {
    const res = assessOpportunity(target({ views: 0, replies: 2, likes: 1 }), NOW);
    expect(res.reasons.join(" ")).not.toContain("competition");
  });

  it("discussion posts (question / ask-the-crowd) get the engage-back boost", () => {
    const plain = assessOpportunity(target({}), NOW);
    const question = assessOpportunity(target({ text: "Is the AI bubble real?" }), NOW);
    expect(question.score).toBeGreaterThan(plain.score);
    expect(question.reasons.join(" ")).toContain("Invites discussion");
    // A "?" inside a URL doesn't count.
    const urlOnly = assessOpportunity(target({ text: "new post https://x.com/a?b=1" }), NOW);
    expect(urlOnly.reasons.join(" ")).not.toContain("Invites discussion");
  });

  it("minutes-old posts don't get runaway age amplification (age floor)", () => {
    const atFive = assessOpportunity(target({ ageMinutes: 5 }), NOW);
    const atThirty = assessOpportunity(target({ ageMinutes: 30 }), NOW);
    expect(atFive.score).toBeCloseTo(atThirty.score, 10);
  });
});

describe("admitToQueue — proof-of-distribution admission (Opportunity 3.0 Tier 1)", () => {
  it("rejects a fresh zero-engagement post from an out-of-band author — no proof yet", () => {
    const t = target({ followers: 4_000, likes: 0, replies: 0, views: 0, ageMinutes: 6 });
    expect(admitToQueue(t, NOW)).toEqual({ admit: false, rule: "no-proof" });
  });

  it("admits an in-band author on sight — their posts get distribution", () => {
    const t = target({ followers: 25_000, likes: 0, replies: 0, views: 0, ageMinutes: 6 });
    expect(admitToQueue(t, NOW)).toEqual({ admit: true, rule: "proof:author-band" });
  });

  it("admits demonstrated distribution: engagement above the age-scaled floor, or real views", () => {
    const engaged = target({ followers: 4_000, likes: 30, replies: 0, views: 0, ageMinutes: 30 });
    expect(admitToQueue(engaged, NOW).rule).toBe("proof:distribution");
    const viewed = target({ followers: 4_000, likes: 0, replies: 0, views: 2_500, ageMinutes: 30 });
    expect(admitToQueue(viewed, NOW).rule).toBe("proof:distribution");
  });

  it("admits on velocity: below the static floor but climbing counts as proof", () => {
    // 6h old with weighted ≈ 34.5 — under the age-scaled floor (40) — but up
    // ~32/hour since the last snapshot: distribution is arriving now.
    const t = target({ followers: 4_000, likes: 25, replies: 0, views: 500, ageMinutes: 360 });
    const res = admitToQueue(t, NOW, {
      prevMetrics: { like_count: 2, reply_count: 0, impression_count: 100 },
      prevSweptAtMs: NOW - 60 * 60_000,
    });
    expect(res.rule).toBe("proof:velocity");
  });

  it("gates bots and bait: author floor, follow-ratio, spam patterns", () => {
    expect(admitToQueue(target({ followers: 150 }), NOW).rule).toBe("gate:author-floor");
    expect(admitToQueue(target({ followers: 400, following: 9_000 }), NOW).rule).toBe(
      "gate:follow-ratio"
    );
    expect(
      admitToQueue(target({ text: "Huge giveaway! rt to win, drop your wallet" }), NOW).rule
    ).toBe("gate:spam-bait");
  });

  it("unknown author metrics fall through to distribution proof, not a gate", () => {
    const proven = target({ followers: null, likes: 50, views: 20_000 });
    expect(admitToQueue(proven, NOW).rule).toBe("proof:distribution");
    const unproven = target({ followers: null, likes: 0, replies: 0, views: 0, ageMinutes: 6 });
    expect(admitToQueue(unproven, NOW).rule).toBe("no-proof");
  });
});
