import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the X API before importing the refresh lib (it imports from @/lib/x-api).
const getTweetsBatch = vi.fn();
const getValidAccessToken = vi.fn();
vi.mock("@/lib/x-api", () => ({
  getTweetsBatch: (...a: unknown[]) => getTweetsBatch(...a),
  getValidAccessToken: (...a: unknown[]) => getValidAccessToken(...a),
}));

import { getAnalyzablePosts } from "./posts-pool";
import { refreshOwnPostMetrics } from "./own-posts-refresh";

/**
 * A minimal thenable Supabase query-builder fake: every chain method returns
 * `this`, and awaiting the builder (or calling .maybeSingle()) resolves to the
 * canned `{ data }` for that table.
 */
function fakeSupabase(tableData: Record<string, { data: unknown }>) {
  function builder(table: string) {
    const result = tableData[table] ?? { data: null };
    const b: Record<string, unknown> = {
      select: () => b,
      eq: () => b,
      not: () => b,
      order: () => b,
      limit: () => b,
      in: () => b,
      maybeSingle: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
      update: () => b,
      then: (onF: (v: unknown) => unknown) => Promise.resolve(result).then(onF),
    };
    return b;
  }
  const updates: Array<{ table: string; values: unknown }> = [];
  return {
    updates,
    from(table: string) {
      const b = builder(table) as Record<string, unknown>;
      // capture .update().eq().eq() chains for assertions
      b.update = (values: unknown) => {
        updates.push({ table, values });
        return b;
      };
      return b;
    },
  };
}

describe("flywheel: own published posts become rankable once metrics land", () => {
  const POOL_TEXT =
    "shipping in public is the cheat code: build, post the receipts, repeat";

  it("a just-published post (metrics: {}) sits in the pool with zero engagement", async () => {
    const supabase = fakeSupabase({
      user_analytics: { data: null },
      captured_posts: {
        data: [
          {
            x_post_id: "111",
            text_content: POOL_TEXT,
            metrics: {}, // backfilled at publish time — no engagement yet
            post_timestamp: "2026-06-19T00:00:00Z",
          },
        ],
      },
    });

    const pool = await getAnalyzablePosts(supabase as never, "user-1");
    expect(pool).toHaveLength(1);
    expect(pool[0].post_id).toBe("111");
    expect(pool[0].engagement_score).toBe(0); // in the pool, but unrankable
  });

  it("after metrics land, the same post ranks above older low-engagement posts", async () => {
    const supabase = fakeSupabase({
      user_analytics: { data: null },
      captured_posts: {
        data: [
          {
            x_post_id: "999",
            text_content: "an older post that did not land with the audience",
            metrics: { likes: 1, retweets: 0, replies: 0, views: 50 },
            post_timestamp: "2026-01-01T00:00:00Z",
          },
          {
            x_post_id: "111",
            text_content: POOL_TEXT,
            metrics: { likes: 120, retweets: 30, replies: 18, views: 9000 },
            post_timestamp: "2026-06-19T00:00:00Z",
          },
        ],
      },
    });

    const pool = await getAnalyzablePosts(supabase as never, "user-1");
    expect(pool[0].post_id).toBe("111"); // the freshly-metricked post now leads
    expect(pool[0].engagement_score).toBeGreaterThan(pool[1].engagement_score);
  });
});

describe("refreshOwnPostMetrics maps live X metrics onto captured posts", () => {
  beforeEach(() => {
    getTweetsBatch.mockReset();
    getValidAccessToken.mockReset();
  });

  it("fetches metrics for own posts and writes them back", async () => {
    getValidAccessToken.mockResolvedValue({ accessToken: "tok" });
    getTweetsBatch.mockResolvedValue([
      {
        id: "111",
        public_metrics: {
          like_count: 120,
          retweet_count: 30,
          reply_count: 18,
          quote_count: 4,
          impression_count: 9000,
        },
      },
    ]);

    const supabase = fakeSupabase({
      captured_posts: { data: [{ id: "row-1", x_post_id: "111" }] },
    });

    const res = await refreshOwnPostMetrics(supabase as never, "user-1");
    expect(res.scanned).toBe(1);
    expect(res.updated).toBe(1);

    const update = supabase.updates.find((u) => u.table === "captured_posts");
    expect(update).toBeTruthy();
    const metrics = (update!.values as { metrics: Record<string, number> }).metrics;
    expect(metrics).toMatchObject({ likes: 120, retweets: 30, replies: 18, views: 9000 });
  });

  it("no-ops cleanly when the user has no captured posts", async () => {
    const supabase = fakeSupabase({ captured_posts: { data: [] } });
    const res = await refreshOwnPostMetrics(supabase as never, "user-1");
    expect(res).toEqual({ scanned: 0, updated: 0 });
    expect(getValidAccessToken).not.toHaveBeenCalled();
  });
});
