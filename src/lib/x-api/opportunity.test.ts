import { describe, it, expect } from "vitest";
import { assessOpportunity } from "./opportunity";
import { tractionScore, type EnrichedSearchTweet } from "./search-mapping";

const NOW = Date.parse("2026-07-08T12:00:00Z");

function target(over: {
  followers?: number | null;
  replies?: number;
  views?: number;
  likes?: number;
  ageMinutes?: number;
}): EnrichedSearchTweet {
  const ageMin = over.ageMinutes ?? 120;
  return {
    id: "t1",
    text: "post",
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
    },
    reply_settings: "everyone",
    is_auth_mentioned: false,
    reply_allowed: true,
    reply_eligibility: "open",
    post_url: "https://x.com/a/status/t1",
    intent_url: "https://x.com/intent/post?in_reply_to=t1",
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
});
