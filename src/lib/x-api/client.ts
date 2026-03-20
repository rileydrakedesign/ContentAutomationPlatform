// X API client using OAuth 2.0 PKCE
import crypto from "crypto";
import { weightedEngagement } from "@/lib/utils/engagement";
import type { PostAnalytics } from "@/types/analytics";
import type { SupabaseClient } from "@supabase/supabase-js";

const X_API_BASE = "https://api.twitter.com";

// ── v2 Types ─────────────────────────────────────────────────────

export interface XUserV2 {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
}

export interface XTweetV2 {
  id: string;
  text: string;
  created_at?: string;
  referenced_tweets?: Array<{ type: string; id: string }>;
  public_metrics?: {
    retweet_count: number;
    reply_count: number;
    like_count: number;
    quote_count: number;
    bookmark_count?: number;
    impression_count?: number;
  };
  organic_metrics?: {
    impression_count: number;
    url_link_clicks: number;
    user_profile_clicks: number;
  };
}

// ── OAuth 2.0 PKCE ──────────────────────────────────────────────

export function generatePKCE(): { codeVerifier: string; codeChallenge: string } {
  const codeVerifier = crypto.randomBytes(32).toString("base64url");
  const codeChallenge = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return { codeVerifier, codeChallenge };
}

export function getOAuth2AuthorizationUrl(state: string, codeChallenge: string): string {
  const clientId = process.env.X_CLIENT_ID!;
  const redirectUri = process.env.X_REDIRECT_URI!;
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read tweet.write users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });
  return `https://x.com/i/oauth2/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;
  const redirectUri = process.env.X_REDIRECT_URI!;

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(`${X_API_BASE}/2/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to exchange code for tokens: ${text}`);
  }

  return response.json();
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.X_CLIENT_ID!;
  const clientSecret = process.env.X_CLIENT_SECRET!;

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  // Confidential clients must use Basic auth header
  if (clientSecret) {
    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    headers.Authorization = `Basic ${basicAuth}`;
  }

  const response = await fetch(`${X_API_BASE}/2/oauth2/token`, {
    method: "POST",
    headers,
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh access token: ${text}`);
  }

  return response.json();
}

/**
 * Gets a valid access token for the user, refreshing if needed.
 * Race-safe: uses WHERE refresh_token = <old> to prevent double-refresh.
 */
export async function getValidAccessToken(
  supabase: SupabaseClient,
  userId: string
): Promise<{ accessToken: string; connection: { x_user_id: string; x_username: string } }> {
  const { data: conn, error } = await supabase
    .from("x_connections")
    .select("access_token, refresh_token, access_token_expires_at, x_user_id, x_username")
    .eq("user_id", userId)
    .single();

  if (error || !conn?.access_token) {
    throw new Error("X account not connected");
  }

  const expiresAt = conn.access_token_expires_at
    ? new Date(conn.access_token_expires_at).getTime()
    : Infinity;
  const bufferMs = 5 * 60 * 1000; // 5 minutes

  // Token still valid
  if (Date.now() < expiresAt - bufferMs) {
    return {
      accessToken: conn.access_token,
      connection: { x_user_id: conn.x_user_id, x_username: conn.x_username },
    };
  }

  // Need to refresh
  if (!conn.refresh_token) {
    throw new Error("No refresh token available — reconnect X account");
  }

  const tokens = await refreshAccessToken(conn.refresh_token);
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  // Race-safe update: only update if refresh_token hasn't changed
  const { data: updated, error: updateErr } = await supabase
    .from("x_connections")
    .update({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      access_token_expires_at: newExpiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("refresh_token", conn.refresh_token)
    .select("access_token, x_user_id, x_username")
    .single();

  if (updateErr || !updated) {
    // Another process already refreshed — re-read
    const { data: reread } = await supabase
      .from("x_connections")
      .select("access_token, x_user_id, x_username")
      .eq("user_id", userId)
      .single();

    if (!reread?.access_token) {
      throw new Error("Failed to get valid access token after refresh race");
    }

    return {
      accessToken: reread.access_token,
      connection: { x_user_id: reread.x_user_id, x_username: reread.x_username },
    };
  }

  return {
    accessToken: updated.access_token,
    connection: { x_user_id: updated.x_user_id, x_username: updated.x_username },
  };
}

// ── Bearer request ───────────────────────────────────────────────

async function makeBearerRequest(
  method: string,
  url: string,
  accessToken: string,
  queryParams: Record<string, string> = {}
): Promise<Response> {
  const queryString = Object.keys(queryParams).length > 0
    ? "?" + new URLSearchParams(queryParams).toString()
    : "";

  return fetch(`${url}${queryString}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

// ── v2 API functions ─────────────────────────────────────────────

export async function verifyCredentials(
  accessToken: string
): Promise<XUserV2> {
  const url = `${X_API_BASE}/2/users/me`;

  const response = await makeBearerRequest(
    "GET",
    url,
    accessToken,
    { "user.fields": "id,name,username,profile_image_url" }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to verify credentials: ${text}`);
  }

  const json = await response.json();
  return json.data;
}

export async function getUserTimeline(
  accessToken: string,
  userId: string,
  maxResults: number = 100,
  paginationToken?: string
): Promise<{ data: XTweetV2[]; meta: { next_token?: string; result_count: number } }> {
  const url = `${X_API_BASE}/2/users/${userId}/tweets`;

  const queryParams: Record<string, string> = {
    "tweet.fields": "created_at,public_metrics,organic_metrics,referenced_tweets",
    exclude: "retweets",
    max_results: Math.min(maxResults, 100).toString(),
  };

  if (paginationToken) {
    queryParams.pagination_token = paginationToken;
  }

  const response = await makeBearerRequest("GET", url, accessToken, queryParams);

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get timeline: ${text}`);
  }

  const json = await response.json();
  return {
    data: json.data || [],
    meta: json.meta || { result_count: 0 },
  };
}

export async function getTweet(
  accessToken: string,
  tweetId: string
): Promise<XTweetV2> {
  const url = `${X_API_BASE}/2/tweets/${tweetId}`;

  const response = await makeBearerRequest(
    "GET",
    url,
    accessToken,
    { "tweet.fields": "created_at,public_metrics" }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get tweet: ${text}`);
  }

  const json = await response.json();
  return json.data;
}

export async function getTweetsBatch(
  accessToken: string,
  tweetIds: string[]
): Promise<XTweetV2[]> {
  if (tweetIds.length === 0) return [];

  const url = `${X_API_BASE}/2/tweets`;

  const response = await makeBearerRequest(
    "GET",
    url,
    accessToken,
    {
      ids: tweetIds.slice(0, 100).join(","),
      "tweet.fields": "created_at,public_metrics",
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get tweets batch: ${text}`);
  }

  const json = await response.json();
  return json.data || [];
}

export async function searchRecentTweets(
  accessToken: string,
  query: string,
  maxResults: number = 10
): Promise<{ data: XTweetV2[]; includes?: { users?: XUserV2[] } }> {
  const url = `${X_API_BASE}/2/tweets/search/recent`;

  const response = await makeBearerRequest(
    "GET",
    url,
    accessToken,
    {
      query,
      "tweet.fields": "created_at,public_metrics",
      "expansions": "author_id",
      "user.fields": "username,name",
      max_results: Math.max(10, Math.min(maxResults, 100)).toString(),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to search tweets: ${text}`);
  }

  return response.json();
}

// ── Post a tweet ─────────────────────────────────────────────────

export async function postTweet(
  accessToken: string,
  status: string,
  options?: {
    inReplyToStatusId?: string;
  }
): Promise<{ id_str: string }> {
  const url = `${X_API_BASE}/2/tweets`;

  const body: Record<string, unknown> = { text: status };
  if (options?.inReplyToStatusId) {
    body.reply = { in_reply_to_tweet_id: options.inReplyToStatusId };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to post tweet (${response.status}): ${text}`);
  }

  const data = await response.json();
  return { id_str: data.data.id };
}

// ── Analytics helpers ────────────────────────────────────────────

export function mapV2ToPostAnalytics(tweet: XTweetV2): PostAnalytics {
  const pm = tweet.public_metrics;
  const om = tweet.organic_metrics;

  const impressions = om?.impression_count ?? pm?.impression_count ?? 0;
  const likes = pm?.like_count ?? 0;
  const replies = pm?.reply_count ?? 0;
  const reposts = pm?.retweet_count ?? 0;
  const bookmarks = pm?.bookmark_count ?? 0;

  const isReply =
    tweet.referenced_tweets?.some((r) => r.type === "replied_to") ||
    tweet.text.startsWith("@");

  return {
    id: tweet.id,
    post_id: tweet.id,
    text: tweet.text,
    date: tweet.created_at || new Date().toISOString(),
    impressions,
    likes,
    replies,
    reposts,
    bookmarks,
    shares: 0,
    new_follows: 0,
    profile_visits: 0,
    detail_expands: 0,
    url_clicks: 0,
    engagement_score: weightedEngagement({ likes, reposts, replies, bookmarks, impressions }),
    is_reply: !!isReply,
    data_source: "api",
  };
}

// ── Utilities ────────────────────────────────────────────────────

export function extractTweetId(url: string): string | null {
  const patterns = [
    /twitter\.com\/\w+\/status\/(\d+)/,
    /x\.com\/\w+\/status\/(\d+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}
