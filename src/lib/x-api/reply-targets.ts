/**
 * Reply-target discovery core — the server's reply intelligence in one place.
 *
 * Searches recent tweets, derives per-post reply eligibility (so we never point
 * a user at a post they can't reply to), filters out posts the user already
 * replied to (G7 — a spent opportunity is not an opportunity), and optionally
 * ranks the repliable subset by traction (momentum = weighted engagement
 * decayed by age). Shared by:
 *   - GET /api/v1/search/reply-targets  (agent/API surface, per-post credits)
 *   - GET /api/search/reply-targets     (dashboard surface, Pro-gated)
 *   - MCP `find_reply_posts`            (via the v1 route)
 *
 * Eligibility + traction live in search-mapping.ts; this composes them with the
 * X search call so every surface uses the same logic — no forks.
 */
import { searchRecentTweets, getValidAccessToken } from "@/lib/x-api";
import { createAdminClient } from "@/lib/supabase";
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
  /** How many repliable posts were dropped because the user already replied. */
  already_replied_count: number;
}

// Posts the user already replied to, out of the candidate set. Reads the reply
// pool (extension_replies — every surface that publishes a reply logs there).
// Fail-open: a lookup error must not take discovery down, it just skips dedup
// for this call.
async function fetchAlreadyRepliedIds(userId: string, candidateIds: string[]): Promise<Set<string>> {
  if (candidateIds.length === 0) return new Set();
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("extension_replies")
      .select("replied_to_post_id")
      .eq("user_id", userId)
      .in("replied_to_post_id", candidateIds);
    if (error) {
      console.warn("findReplyTargets: already-replied lookup failed:", error.message);
      return new Set();
    }
    return new Set((data || []).map((r) => String(r.replied_to_post_id)));
  } catch (e) {
    console.warn("findReplyTargets: already-replied lookup failed:", e);
    return new Set();
  }
}

export async function findReplyTargets(
  userId: string,
  opts: FindReplyTargetsOptions
): Promise<FindReplyTargetsResult> {
  const { accessToken, connection } = await getValidAccessToken(userId);
  const authUsername = (connection.x_username || "").toLowerCase();

  const result = await searchRecentTweets(accessToken, opts.query, opts.maxResults);
  const allTweets = mapSearchResults(result, authUsername);
  const repliableAll = allTweets.filter((t) => t.reply_allowed);

  // G7 (discovery half): a post the user already replied to never resurfaces
  // as an opportunity.
  const alreadyReplied = await fetchAlreadyRepliedIds(
    userId,
    repliableAll.map((t) => t.id)
  );
  const repliable = repliableAll.filter((t) => !alreadyReplied.has(t.id));

  if (opts.sort === "traction") {
    const now = opts.nowMs ?? Date.now();
    repliable.sort((a, b) => tractionScore(b, now) - tractionScore(a, now));
  }

  return {
    tweets: repliable,
    returned_count: allTweets.length,
    repliable_count: repliable.length,
    already_replied_count: repliableAll.length - repliable.length,
  };
}
