import { describe, it, expect } from "vitest";
import { weightedEngagement } from "./engagement";

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
