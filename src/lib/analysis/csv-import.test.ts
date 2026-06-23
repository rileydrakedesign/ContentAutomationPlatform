import { describe, it, expect } from "vitest";
import { parseXAnalyticsCsv } from "./csv-import";

describe("parseXAnalyticsCsv — X analytics export parsing", () => {
  const csv = [
    "Post id,Date,Post text,Impressions,Likes,Replies,Reposts,Bookmarks",
    '111,2026-06-01,"shipping in public is the cheat code",9000,120,18,30,12',
    '222,2026-06-02,"@someone totally agree with this",500,5,1,0,0',
    '333,2026-06-03,"too",10,0,0,0,0',
  ].join("\n");

  it("maps rows into PostAnalytics with metrics and ids", () => {
    const posts = parseXAnalyticsCsv(csv);
    expect(posts).toHaveLength(2); // the 3-char "too" row is dropped (<5 chars)
    const first = posts.find((p) => p.post_id === "111")!;
    expect(first.impressions).toBe(9000);
    expect(first.likes).toBe(120);
    expect(first.reposts).toBe(30);
    expect(first.engagement_score).toBeGreaterThan(0);
  });

  it("flags replies (leading @) so they don't pollute the original-post pool", () => {
    const posts = parseXAnalyticsCsv(csv);
    expect(posts.find((p) => p.post_id === "111")!.is_reply).toBe(false);
    expect(posts.find((p) => p.post_id === "222")!.is_reply).toBe(true);
  });

  it("returns empty for a headerless / empty file", () => {
    expect(parseXAnalyticsCsv("")).toEqual([]);
    expect(parseXAnalyticsCsv("just one line")).toEqual([]);
  });
});
