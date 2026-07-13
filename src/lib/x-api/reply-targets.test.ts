import { describe, it, expect, vi, beforeEach } from "vitest";

const searchRecentTweets = vi.fn();
const getValidAccessToken = vi.fn();
vi.mock("@/lib/x-api", () => ({
  searchRecentTweets: (...a: unknown[]) => searchRecentTweets(...a),
  getValidAccessToken: (...a: unknown[]) => getValidAccessToken(...a),
}));

// Already-replied lookup (extension_replies). Tests set `repliedRows` to the
// rows the mock returns, or `repliedError` to simulate a failed lookup.
let repliedRows: Array<{ replied_to_post_id: string }> = [];
let repliedError: { message: string } | null = null;
vi.mock("@/lib/supabase", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          in: (_col: string, ids: string[]) =>
            Promise.resolve({
              data: repliedError ? null : repliedRows.filter((r) => ids.includes(r.replied_to_post_id)),
              error: repliedError,
            }),
        }),
      }),
    }),
  }),
}));

import { findReplyTargets } from "./reply-targets";

function tweet(
  id: string,
  reply_settings: string,
  metrics: Partial<{ like_count: number; retweet_count: number; reply_count: number; impression_count: number; bookmark_count: number; quote_count: number }>,
  created_at: string
) {
  return {
    id,
    text: `post ${id}`,
    created_at,
    reply_settings,
    author_id: "u1",
    public_metrics: {
      like_count: 0,
      retweet_count: 0,
      reply_count: 0,
      impression_count: 0,
      bookmark_count: 0,
      quote_count: 0,
      ...metrics,
    },
  };
}

describe("findReplyTargets — server reply eligibility + traction", () => {
  beforeEach(() => {
    searchRecentTweets.mockReset();
    getValidAccessToken.mockReset();
    getValidAccessToken.mockResolvedValue({
      accessToken: "tok",
      connection: { x_username: "me", x_user_id: "1" },
    });
    repliedRows = [];
    repliedError = null;
  });

  it("returns only repliable posts — never one the account can't reply to", async () => {
    searchRecentTweets.mockResolvedValue({
      data: [
        tweet("open", "everyone", { like_count: 10 }, "2026-06-19T00:00:00Z"),
        tweet("restricted", "following", { like_count: 999 }, "2026-06-19T00:00:00Z"),
        tweet("mentioned_only", "mentionedUsers", { like_count: 50 }, "2026-06-19T00:00:00Z"),
      ],
      includes: { users: [{ id: "u1", username: "someone", name: "Someone" }] },
    });

    const res = await findReplyTargets("user-1", {
      query: "ai",
      maxResults: 10,
      sort: "relevance",
    });

    const ids = res.tweets.map((t) => t.id);
    expect(ids).toContain("open");
    expect(ids).not.toContain("restricted"); // following-only → not repliable
    expect(ids).not.toContain("mentioned_only"); // we're not mentioned → not repliable
    expect(res.returned_count).toBe(3);
    expect(res.repliable_count).toBe(1);
  });

  it("excludes verified/subscribers/unknown reply audiences (only provably-open posts surface)", async () => {
    searchRecentTweets.mockResolvedValue({
      data: [
        tweet("everyone", "everyone", { like_count: 1 }, "2026-06-19T00:00:00Z"),
        tweet("verified", "verified", { like_count: 999 }, "2026-06-19T00:00:00Z"),
        tweet("subscribers", "subscribers", { like_count: 999 }, "2026-06-19T00:00:00Z"),
        // absent reply_settings → unknown, never surfaced
        tweet("absent", "", { like_count: 999 }, "2026-06-19T00:00:00Z"),
      ],
      includes: { users: [{ id: "u1", username: "someone", name: "Someone" }] },
    });

    const res = await findReplyTargets("user-1", {
      query: "ai",
      maxResults: 10,
      sort: "relevance",
    });

    const ids = res.tweets.map((t) => t.id);
    expect(ids).toEqual(["everyone"]);
    expect(res.repliable_count).toBe(1);
  });

  it("allows a mentionedUsers post when our handle is mentioned (case-insensitive)", async () => {
    searchRecentTweets.mockResolvedValue({
      data: [
        {
          ...tweet("mentioned", "MentionedUsers", { like_count: 5 }, "2026-06-19T00:00:00Z"),
          entities: { mentions: [{ username: "ME" }] },
        },
      ],
      includes: { users: [{ id: "u1", username: "someone", name: "Someone" }] },
    });

    const res = await findReplyTargets("user-1", {
      query: "ai",
      maxResults: 10,
      sort: "relevance",
    });

    expect(res.tweets.map((t) => t.id)).toEqual(["mentioned"]);
    expect(res.tweets[0].reply_eligibility).toBe("open_mentioned");
  });

  it("sort=traction ranks repliable posts by momentum (engagement / age)", async () => {
    const now = Date.parse("2026-06-19T12:00:00Z");
    searchRecentTweets.mockResolvedValue({
      data: [
        // older, high raw engagement
        tweet("old_big", "everyone", { like_count: 500, reply_count: 50 }, "2026-06-17T12:00:00Z"),
        // fresh, modest engagement but rising fast
        tweet("fresh_rising", "everyone", { like_count: 120, reply_count: 40 }, "2026-06-19T11:00:00Z"),
      ],
      includes: { users: [{ id: "u1", username: "someone", name: "Someone" }] },
    });

    const res = await findReplyTargets("user-1", {
      query: "ai",
      maxResults: 10,
      sort: "traction",
      nowMs: now,
    });

    expect(res.tweets[0].id).toBe("fresh_rising"); // momentum beats raw, saturated totals
  });

  // G7 (discovery half): a spent opportunity is not an opportunity.
  it("never resurfaces a post the user already replied to", async () => {
    searchRecentTweets.mockResolvedValue({
      data: [
        tweet("already_done", "everyone", { like_count: 500 }, "2026-06-19T00:00:00Z"),
        tweet("fresh_target", "everyone", { like_count: 10 }, "2026-06-19T00:00:00Z"),
      ],
      includes: { users: [{ id: "u1", username: "someone", name: "Someone" }] },
    });
    repliedRows = [{ replied_to_post_id: "already_done" }];

    const res = await findReplyTargets("user-1", {
      query: "ai",
      maxResults: 10,
      sort: "relevance",
    });

    expect(res.tweets.map((t) => t.id)).toEqual(["fresh_target"]);
    expect(res.repliable_count).toBe(1);
    expect(res.already_replied_count).toBe(1);
  });

  it("serves the full note_tweet body for long-form posts (not the truncated text + t.co stub)", async () => {
    const fullBody = "long-form post body ".repeat(40).trim();
    searchRecentTweets.mockResolvedValue({
      data: [
        {
          ...tweet("long1", "everyone", { like_count: 10 }, "2026-06-19T00:00:00Z"),
          text: "long-form post body long-form… https://t.co/abc123",
          note_tweet: { text: fullBody },
        },
        tweet("short1", "everyone", { like_count: 10 }, "2026-06-19T00:00:00Z"),
      ],
      includes: { users: [{ id: "u1", username: "someone", name: "Someone" }] },
    });

    const res = await findReplyTargets("user-1", {
      query: "ai",
      maxResults: 10,
      sort: "relevance",
    });

    const long = res.tweets.find((t) => t.id === "long1");
    const short = res.tweets.find((t) => t.id === "short1");
    expect(long?.text).toBe(fullBody);
    expect(long?.text).not.toContain("https://t.co/");
    expect(short?.text).toBe("post short1");
  });

  it("fails open when the already-replied lookup errors (discovery still works)", async () => {
    searchRecentTweets.mockResolvedValue({
      data: [tweet("open", "everyone", { like_count: 10 }, "2026-06-19T00:00:00Z")],
      includes: { users: [{ id: "u1", username: "someone", name: "Someone" }] },
    });
    repliedError = { message: "db down" };

    const res = await findReplyTargets("user-1", {
      query: "ai",
      maxResults: 10,
      sort: "relevance",
    });

    expect(res.tweets.map((t) => t.id)).toEqual(["open"]);
    expect(res.already_replied_count).toBe(0);
  });
});
