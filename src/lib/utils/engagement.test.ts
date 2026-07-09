import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { weightedEngagement, opportunityTraction, TRACTION_MIN_AGE_HOURS } from "./engagement";
import { tractionScore, type EnrichedSearchTweet } from "@/lib/x-api/search-mapping";

describe("weightedEngagement", () => {
  it("applies the recalibrated weights (replies 10, retweets 3, bookmarks 3, likes 1, impressions 0.001)", () => {
    expect(weightedEngagement({ likes: 1 })).toBe(1);
    expect(weightedEngagement({ retweets: 1 })).toBe(3);
    expect(weightedEngagement({ replies: 1 })).toBe(10);
    expect(weightedEngagement({ bookmarks: 1 })).toBe(3);
    expect(weightedEngagement({ impressions: 1000 })).toBe(1);
  });

  it("ranks reply > retweet ≈ bookmark > like (anchored to X's documented ranker ordering)", () => {
    const reply = weightedEngagement({ replies: 1 });
    const retweet = weightedEngagement({ retweets: 1 });
    const bookmark = weightedEngagement({ bookmarks: 1 });
    const like = weightedEngagement({ likes: 1 });
    expect(reply).toBeGreaterThan(retweet);
    expect(retweet).toEqual(bookmark);
    expect(retweet).toBeGreaterThan(like);
  });

  it("accepts both PostMetrics and PostAnalytics field names", () => {
    expect(weightedEngagement({ retweets: 2 })).toBe(weightedEngagement({ reposts: 2 }));
    expect(weightedEngagement({ views: 1000 })).toBe(weightedEngagement({ impressions: 1000 }));
  });

  it("sums a full metric set", () => {
    // 10 likes(10) + 2 retweets(6) + 3 replies(30) + 4 bookmarks(12) + 5000 imp(5) = 63
    expect(
      weightedEngagement({ likes: 10, retweets: 2, replies: 3, bookmarks: 4, impressions: 5000 })
    ).toBe(63);
  });
});

// G5: the reply Opportunity Score used to exist twice with drifted weights
// (extension content.js 3/4/5 vs server engagement.ts 1/3/10). It is now ONE
// implementation — opportunityTraction here — consumed by the server's
// tractionScore and bundled into the extension via engine-entry.ts (the same
// consolidation pattern as the engagement-bait lists in x-algorithm.ts). These
// tests fail if either surface grows its own formula again.
describe("opportunity score parity (server ranking ↔ extension pill)", () => {
  const post = (
    id: string,
    metrics: NonNullable<EnrichedSearchTweet["metrics"]>,
    ageHours: number,
    nowMs: number
  ): EnrichedSearchTweet => ({
    id,
    text: "t",
    created_at: new Date(nowMs - ageHours * 3_600_000).toISOString(),
    metrics,
    author: null,
    reply_settings: "everyone",
    is_auth_mentioned: false,
    reply_allowed: true,
    reply_eligibility: "open",
  });

  it("server tractionScore ordering === canonical opportunityTraction ordering", () => {
    const nowMs = Date.parse("2026-07-08T12:00:00Z");
    const fixtures: Array<{
      id: string;
      m: NonNullable<EnrichedSearchTweet["metrics"]>;
      ageHours: number;
    }> = [
      { id: "fresh-rising", m: { like_count: 20, retweet_count: 2, reply_count: 3, quote_count: 0, bookmark_count: 1, impression_count: 4000 }, ageHours: 0.5 },
      { id: "old-saturated", m: { like_count: 900, retweet_count: 120, reply_count: 400, quote_count: 0, bookmark_count: 60, impression_count: 500000 }, ageHours: 20 },
      { id: "mid", m: { like_count: 50, retweet_count: 5, reply_count: 8, quote_count: 0, bookmark_count: 2, impression_count: 20000 }, ageHours: 4 },
      { id: "tiny", m: { like_count: 2, retweet_count: 0, reply_count: 1, quote_count: 0, bookmark_count: 0, impression_count: 300 }, ageHours: 2 },
      { id: "reply-heavy", m: { like_count: 10, retweet_count: 1, reply_count: 40, quote_count: 0, bookmark_count: 0, impression_count: 9000 }, ageHours: 6 },
    ];

    const serverOrder = fixtures
      .map((f) => ({ id: f.id, s: tractionScore(post(f.id, f.m, f.ageHours, nowMs), nowMs) }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.id);

    // The extension pill's raw score path (content.js calculateOpportunityScore):
    // AFXAssistant.opportunityTraction(metrics, ageHours) with view-shaped fields.
    const extensionOrder = fixtures
      .map((f) => ({
        id: f.id,
        s: opportunityTraction(
          { likes: f.m.like_count, retweets: f.m.retweet_count, replies: f.m.reply_count, bookmarks: f.m.bookmark_count, views: f.m.impression_count },
          f.ageHours
        ),
      }))
      .sort((a, b) => b.s - a.s)
      .map((x) => x.id);

    expect(extensionOrder).toEqual(serverOrder);
  });

  it("both surfaces apply the same sub-hour age floor", () => {
    const m = { likes: 10, replies: 2 };
    expect(opportunityTraction(m, 0.1)).toBe(
      weightedEngagement(m) / TRACTION_MIN_AGE_HOURS
    );
  });

  it("the extension has no local formula — it delegates to the bundled canonical one", () => {
    const contentJs = readFileSync(
      new URL("../../../chrome-extension/src/content/content.js", import.meta.url),
      "utf8"
    );
    // Consumes the canonical functions exposed by engine-entry.ts…
    expect(contentJs).toContain("window.AFXAssistant.weightedEngagement");
    expect(contentJs).toContain("window.AFXAssistant.opportunityTraction");
    // …and carries no hand-copied weight arithmetic (the G5 drift vector).
    expect(contentJs).not.toMatch(/likes\s*\*\s*\d|replies\s*\*\s*\d|retweets\s*\*\s*\d/);

    const engineEntry = readFileSync(
      new URL("../../../chrome-extension/src/engine-entry.ts", import.meta.url),
      "utf8"
    );
    expect(engineEntry).toContain("weightedEngagement");
    expect(engineEntry).toContain("opportunityTraction");
    expect(engineEntry).toContain('from "@/lib/utils/engagement"');
  });
});
