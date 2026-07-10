import { describe, it, expect } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAnalyzablePosts, getAnalyzableReplies } from "./posts-pool";

/**
 * Minimal supabase mock: routes each `.from(table)` to canned rows and
 * supports the builder chains the pool functions use.
 */
function mockSupabase(tables: {
  analyticsPosts?: unknown[];
  extensionReplies?: unknown[];
  capturedPosts?: unknown[];
  candidatePosts?: Array<{ post_id: string; text: string }>;
}): SupabaseClient {
  const builder = (result: unknown) => {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const m of ["select", "eq", "order", "limit", "in"]) b[m] = chain;
    b.maybeSingle = () => Promise.resolve({ data: result });
    // Awaiting the builder itself resolves list queries.
    b.then = (resolve: (v: unknown) => void) => resolve({ data: result });
    return b;
  };
  return {
    from: (table: string) => {
      if (table === "user_analytics") return builder({ posts: tables.analyticsPosts || [] });
      if (table === "extension_replies") return builder(tables.extensionReplies || []);
      if (table === "captured_posts") return builder(tables.capturedPosts || []);
      if (table === "candidate_posts") return builder(tables.candidatePosts || []);
      throw new Error(`unexpected table: ${table}`);
    },
  } as unknown as SupabaseClient;
}

const analyticsReply = (over: Record<string, unknown> = {}) => ({
  post_id: "r1",
  text: "great point — we saw the same thing at 10k MRR",
  date: "2026-07-01T10:00:00Z",
  is_reply: true,
  likes: 12,
  replies: 2,
  reposts: 1,
  bookmarks: 0,
  impressions: 3000,
  in_reply_to_post_id: "p1",
  ...over,
});

describe("post pool / reply pool split", () => {
  it("getAnalyzablePosts returns original posts only — replies never leak in", async () => {
    const supabase = mockSupabase({
      analyticsPosts: [
        { post_id: "a", text: "an original post with enough text", is_reply: false, likes: 5 },
        analyticsReply(),
      ],
    });
    const posts = await getAnalyzablePosts(supabase, "u1");
    expect(posts.map((p) => p.post_id)).toEqual(["a"]);
    expect(posts.every((p) => !p.is_reply)).toBe(true);
  });

  it("reply pool pairs an analytics reply with its parent text from extension_replies", async () => {
    const supabase = mockSupabase({
      analyticsPosts: [analyticsReply()],
      extensionReplies: [
        {
          reply_text: "great point — we saw the same thing at 10k MRR",
          replied_to_post_id: "p1",
          replied_to_text: "Nobody talks about how hard the 5k→10k MRR stretch is",
          sent_at: "2026-07-01T09:59:00Z",
        },
      ],
    });
    const replies = await getAnalyzableReplies(supabase, "u1");
    expect(replies).toHaveLength(1); // deduped: one pair, not two rows
    expect(replies[0].source).toBe("analytics"); // metrics-bearing row wins
    expect(replies[0].engagement_score).toBeGreaterThan(0);
    expect(replies[0].parent.post_id).toBe("p1");
    expect(replies[0].parent.text).toContain("5k→10k MRR");
  });

  it("extension-only replies join with zero metrics and their stored parent text", async () => {
    const supabase = mockSupabase({
      extensionReplies: [
        {
          reply_text: "shipping beats planning, every time",
          replied_to_post_id: "p9",
          replied_to_text: "What separates founders who make it?",
          sent_at: "2026-07-02T08:00:00Z",
        },
      ],
    });
    const replies = await getAnalyzableReplies(supabase, "u1");
    expect(replies).toHaveLength(1);
    expect(replies[0].source).toBe("extension_reply");
    expect(replies[0].engagement_score).toBe(0);
    expect(replies[0].parent.text).toBe("What separates founders who make it?");
  });

  it("falls back to the Radar candidate pool for missing parent text", async () => {
    const supabase = mockSupabase({
      analyticsPosts: [analyticsReply({ in_reply_to_post_id: "p7" })],
      candidatePosts: [{ post_id: "p7", text: "a target that came through a sweep" }],
    });
    const replies = await getAnalyzableReplies(supabase, "u1");
    expect(replies[0].parent.post_id).toBe("p7");
    expect(replies[0].parent.text).toBe("a target that came through a sweep");
  });

  it("ranks metric-bearing replies first (top-performing reply style)", async () => {
    const supabase = mockSupabase({
      analyticsPosts: [
        analyticsReply({ post_id: "big", text: "the reply that popped off yesterday", likes: 400 }),
        analyticsReply({ post_id: "small", text: "a quiet reply from last week", likes: 1, impressions: 50, replies: 0 }),
      ],
      extensionReplies: [
        { reply_text: "a fresh unsynced reply", replied_to_post_id: null, replied_to_text: null, sent_at: "2026-07-03T00:00:00Z" },
      ],
    });
    const replies = await getAnalyzableReplies(supabase, "u1");
    expect(replies.map((r) => r.post_id)).toEqual(["big", "small", ""]);
  });
});
