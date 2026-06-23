/**
 * Reply-target discovery core — the server's reply intelligence in one place.
 *
 * Searches recent tweets, derives per-post reply eligibility (so we never point
 * a user at a post they can't reply to), and optionally ranks the repliable
 * subset by traction (momentum = weighted engagement decayed by age). Shared by:
 *   - GET /api/v1/search/reply-targets  (agent/API surface, per-post credits)
 *   - GET /api/search/reply-targets     (dashboard surface, Pro-gated)
 *   - MCP `find_reply_posts`            (via the v1 route)
 *
 * Eligibility + traction live in search-mapping.ts; this composes them with the
 * X search call so every surface uses the same logic — no forks.
 */
import { searchRecentTweets, getValidAccessToken } from "@/lib/x-api";
import { mapSearchResults, tractionScore, type EnrichedSearchTweet } from "./search-mapping";

export interface FindReplyTargetsOptions {
  query: string;
  maxResults: number;
  sort: "relevance" | "traction";
  /** Injectable clock for deterministic traction ordering in tests. */
  nowMs?: number;
}

export interface FindReplyTargetsResult {
  /** Only posts the authenticated account can actually reply to. */
  tweets: EnrichedSearchTweet[];
  /** How many X returned (what we paid X for). */
  returned_count: number;
  /** How many of those were repliable. */
  repliable_count: number;
}

export async function findReplyTargets(
  userId: string,
  opts: FindReplyTargetsOptions
): Promise<FindReplyTargetsResult> {
  const { accessToken, connection } = await getValidAccessToken(userId);
  const authUsername = (connection.x_username || "").toLowerCase();

  const result = await searchRecentTweets(accessToken, opts.query, opts.maxResults);
  const allTweets = mapSearchResults(result, authUsername);
  const repliable = allTweets.filter((t) => t.reply_allowed);

  if (opts.sort === "traction") {
    const now = opts.nowMs ?? Date.now();
    repliable.sort((a, b) => tractionScore(b, now) - tractionScore(a, now));
  }

  return {
    tweets: repliable,
    returned_count: allTweets.length,
    repliable_count: repliable.length,
  };
}
