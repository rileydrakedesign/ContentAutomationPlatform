import { describe, it, expect } from "vitest";
import { compileWatchQueries } from "./watch-queries";

describe("compileWatchQueries — niche clusters → ready-to-run searches (G2)", () => {
  it("compiles keywords into an OR group with hygiene filters", () => {
    const [q] = compileWatchQueries([
      { label: "indie SaaS marketing", keywords: ["indie saas", "solo founder", "mrr"] },
    ]);
    expect(q.label).toBe("indie SaaS marketing");
    expect(q.query).toBe('("indie saas" OR "solo founder" OR mrr) lang:en -is:retweet -is:reply');
  });

  it("single keyword needs no OR group", () => {
    const [q] = compileWatchQueries([{ label: "devtools", keywords: ["devtools"] }]);
    expect(q.query).toBe("devtools lang:en -is:retweet -is:reply");
  });

  it("caps at 6 watches and 3 keywords each, skips empty/dup clusters", () => {
    const clusters = Array.from({ length: 10 }, (_, i) => ({
      label: i === 1 ? "" : `cluster ${i}`,
      keywords: ["a1", "b2", "c3", "d4", "e5"],
    }));
    clusters.push({ label: "cluster 0", keywords: ["dup"] }); // dup label
    const out = compileWatchQueries(clusters);
    expect(out.length).toBe(6);
    expect(out[0].query.match(/OR/g)?.length).toBe(2); // 3 keywords → 2 ORs
  });

  it("strips stray quotes from phrases and honors the lang option", () => {
    const [q] = compileWatchQueries(
      [{ label: "x", keywords: ['ai "writing" pain'] }],
      { lang: "de" }
    );
    expect(q.query).toContain('"ai writing pain"');
    expect(q.query).toContain("lang:de");
  });

  it("returns [] for a missing or unanalyzed niche", () => {
    expect(compileWatchQueries([])).toEqual([]);
    expect(compileWatchQueries([{ label: "x", keywords: [] }])).toEqual([]);
  });
});
