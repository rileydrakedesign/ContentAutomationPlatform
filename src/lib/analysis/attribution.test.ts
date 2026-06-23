import { describe, it, expect, vi } from "vitest";
import { getOutcomeAttribution } from "./attribution";

function supabaseWith(posts: unknown[]) {
  const b: Record<string, unknown> = {
    select: () => b,
    eq: () => b,
    limit: () => Promise.resolve({ data: posts }),
  };
  return { from: () => b } as never;
}

const M = (likes: number, views: number) => ({ likes, views, retweets: 0, replies: 0 });

describe("getOutcomeAttribution — AFX-assisted vs baseline", () => {
  it("withholds a verdict until both groups have enough refreshed posts", async () => {
    const res = await getOutcomeAttribution(
      supabaseWith([
        { metrics: M(10, 100), afx_assisted: true },
        { metrics: M(10, 100), afx_assisted: false },
      ]),
      "u1"
    );
    expect(res.has_enough_data).toBe(false);
    expect(res.lift_pct).toBeNull();
  });

  it("skips posts whose metrics haven't been refreshed yet", async () => {
    const res = await getOutcomeAttribution(
      supabaseWith([
        { metrics: {}, afx_assisted: true }, // just published — excluded
        { metrics: M(50, 500), afx_assisted: true },
      ]),
      "u1"
    );
    expect(res.assisted.count).toBe(1);
  });

  it("computes a positive lift when assisted posts outperform baseline", async () => {
    const assistedPosts = Array.from({ length: 3 }, () => ({
      metrics: M(100, 1000),
      afx_assisted: true,
    }));
    const baselinePosts = Array.from({ length: 3 }, () => ({
      metrics: M(10, 100),
      afx_assisted: false,
    }));
    const res = await getOutcomeAttribution(
      supabaseWith([...assistedPosts, ...baselinePosts]),
      "u1"
    );
    expect(res.has_enough_data).toBe(true);
    expect(res.assisted.avg_engagement).toBeGreaterThan(res.baseline.avg_engagement);
    expect(res.lift_pct).toBeGreaterThan(0);
  });
});
