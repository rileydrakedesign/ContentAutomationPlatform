// Shared mapping for X v2 search results: derives per-post reply eligibility
// and an optional traction score. Used by /api/v1/search and
// /api/v1/search/reply-targets so the two stay in lockstep.
import { opportunityTraction } from "@/lib/utils/engagement";
import type { XTweetV2, XUserV2 } from "./client";

export type ReplyEligibility = "open" | "open_mentioned" | "restricted" | "unknown";

export interface EnrichedSearchTweet {
  id: string;
  text: string;
  created_at: string | null;
  metrics: XTweetV2["public_metrics"] | null;
  author: {
    username: string | null;
    name: string | null;
    followers_count?: number | null;
  } | null;
  reply_settings: string | null;
  is_auth_mentioned: boolean;
  reply_allowed: boolean;
  reply_eligibility: ReplyEligibility;
  /** Canonical permalink. Null when the author isn't resolvable from includes. */
  post_url: string | null;
  /**
   * Reply handoff target — the ONLY sanctioned way to reply (replies are never
   * published via the API; see PRODUCT_SLIM_2026-07 §4 Tier 2). Callers append
   * `&text=<url-encoded reply>` and open it; X's composer opens pre-filled with
   * the human in control of the send.
   */
  intent_url: string;
}

// Derive reply eligibility from the author's reply_settings + whether our
// authenticated account is mentioned. Best-effort: a publish can still 403
// (author blocked us, spam heuristics, conversation-level limits) — the publish
// step catches that. Policy: nothing is "allowed" unless it is *provably* open.
//
// X v2 reply_settings enum (audited 2026-06-20): "everyone", "mentionedUsers",
// "following", "subscribers", "verified". X has historically used a couple of
// spellings ("followers"/"following"), so we normalize and allow-list rather
// than deny-list — any value we don't recognize as open is treated as
// restricted, never surfaced as repliable.
//
// Reply is provably allowed only when:
//   - reply_settings === "everyone", or
//   - reply_settings === "mentionedUsers" AND our handle is mentioned.
// "following"/"subscribers"/"verified" depend on a relationship we can't see in
// the payload → restricted. Absent/empty → unknown (still not allowed).
function normalizeReplySettings(raw: string | null): string {
  return (raw ?? "").trim().toLowerCase();
}

function deriveEligibility(
  replySettings: string | null,
  isAuthMentioned: boolean
): { reply_allowed: boolean; reply_eligibility: ReplyEligibility } {
  const v = normalizeReplySettings(replySettings);

  if (v === "everyone") {
    return { reply_allowed: true, reply_eligibility: "open" };
  }

  if (v === "mentionedusers") {
    return isAuthMentioned
      ? { reply_allowed: true, reply_eligibility: "open_mentioned" }
      : { reply_allowed: false, reply_eligibility: "restricted" };
  }

  // Absent/empty → unknown (we never surface unknown as repliable).
  if (v === "") {
    return { reply_allowed: false, reply_eligibility: "unknown" };
  }

  // Everything else that's provably gated by a relationship we can't see —
  // following, followers, subscribers, verified, or any future value.
  return { reply_allowed: false, reply_eligibility: "restricted" };
}

// Detect X's "you can't reply here" rejection from a publish error. Some reply
// restrictions are undetectable pre-flight (the author limited who can reply to
// a specific conversation), so X only 403s at publish time. Every surface
// (dashboard, v1, MCP) uses this to turn that into a clean, expected outcome —
// a clear message + dropping the post — instead of a raw 500.
export function isReplyForbiddenError(message: string): boolean {
  const m = (message || "").toLowerCase();
  if (!m.includes("403")) return false;
  return (
    m.includes("reply to this conversation is not allowed") ||
    m.includes("not allowed to reply") ||
    m.includes("you have not been mentioned") ||
    m.includes("limited who can reply")
  );
}

// Map a raw search response into enriched tweets with reply-eligibility fields.
export function mapSearchResults(
  result: { data?: XTweetV2[]; includes?: { users?: XUserV2[] } },
  authUsername: string
): EnrichedSearchTweet[] {
  const handle = (authUsername || "").toLowerCase();
  const users = new Map((result.includes?.users || []).map((u) => [u.id, u]));

  return (result.data || []).map((tweet) => {
    const replySettings = tweet.reply_settings ?? null;
    const isAuthMentioned = Boolean(
      handle &&
        tweet.entities?.mentions?.some((m) => m.username?.toLowerCase() === handle)
    );
    const { reply_allowed, reply_eligibility } = deriveEligibility(
      replySettings,
      isAuthMentioned
    );

    const authorUsername = tweet.author_id
      ? users.get(tweet.author_id)?.username ?? null
      : null;

    return {
      id: tweet.id,
      // Long-form posts: prefer the full note_tweet body over the truncated
      // ~280-char `text` (which ends in a "… https://t.co/…" stub).
      text: tweet.note_tweet?.text || tweet.text,
      created_at: tweet.created_at ?? null,
      metrics: tweet.public_metrics ?? null,
      author: tweet.author_id
        ? {
            username: authorUsername,
            name: users.get(tweet.author_id)?.name ?? null,
            followers_count:
              users.get(tweet.author_id)?.public_metrics?.followers_count ?? null,
          }
        : null,
      reply_settings: replySettings,
      is_auth_mentioned: isAuthMentioned,
      reply_allowed,
      reply_eligibility,
      post_url: authorUsername
        ? `https://x.com/${authorUsername}/status/${tweet.id}`
        : null,
      intent_url: `https://x.com/intent/post?in_reply_to=${encodeURIComponent(tweet.id)}`,
    };
  });
}

// Light traction score for ranking reply candidates: the canonical
// opportunityTraction (engagement.ts) — weighted engagement decayed by post
// age, so fresh posts with momentum outrank old saturated ones. A reply on a
// still-rising post gets more eyeballs than one buried under thousands on a
// day-old post. The extension pill ranks with the same function (bundled via
// chrome-extension/src/engine-entry.ts), so the two orderings cannot drift.
export function tractionScore(
  tweet: EnrichedSearchTweet,
  nowMs: number
): number {
  const pm = tweet.metrics;
  if (!pm) return 0;

  const createdMs = tweet.created_at ? Date.parse(tweet.created_at) : NaN;
  const ageHours = Number.isFinite(createdMs)
    ? (nowMs - createdMs) / 3_600_000
    : 1;

  return opportunityTraction(
    {
      likes: pm.like_count,
      retweets: pm.retweet_count,
      replies: pm.reply_count,
      bookmarks: pm.bookmark_count,
      impressions: pm.impression_count,
    },
    ageHours
  );
}
