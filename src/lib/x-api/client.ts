// X API client using OAuth 2.0 PKCE
import crypto from "crypto";
import { weightedEngagement } from "@/lib/utils/engagement";
import type { PostAnalytics } from "@/types/analytics";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const X_API_BASE = "https://api.twitter.com";

// ── v2 Types ─────────────────────────────────────────────────────

export interface XUserV2 {
  id: string;
  name: string;
  username: string;
  profile_image_url?: string;
  public_metrics?: {
    followers_count?: number;
    following_count?: number;
    tweet_count?: number;
  };
}

export interface XTweetV2 {
  id: string;
  text: string;
  created_at?: string;
  author_id?: string;
  referenced_tweets?: Array<{ type: string; id: string }>;
  // Who the author allows to reply. Raw X enum: everyone | mentionedUsers |
  // following | subscribers | other. Absent on older/unhydrated payloads.
  reply_settings?: string;
  entities?: {
    mentions?: Array<{ username: string; id?: string; start?: number; end?: number }>;
  };
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
    // NOTE: media.write (for v2 image/GIF/video upload, Bearer-auth) is
    // intentionally NOT requested yet — it must first be enabled in the X
    // developer portal, otherwise X rejects the authorize request and breaks the
    // connect flow. Re-add "media.write" to this scope string once the portal
    // scope is enabled; until then the media-upload route returns a graceful
    // "reconnect" 403 and text publishing is unaffected.
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
  const clientId = process.env.X_CLIENT_ID;
  const clientSecret = process.env.X_CLIENT_SECRET;

  // Confidential client: both are required. Fail loudly rather than silently
  // sending no auth header (which surfaces as a confusing X "unauthorized_client
  // / Missing valid authorization header" on refresh).
  if (!clientId || !clientSecret) {
    throw new Error(
      "X OAuth not configured: X_CLIENT_ID and X_CLIENT_SECRET must both be set in this environment"
    );
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Authorization: `Basic ${basicAuth}`,
  };

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
 *
 * Always uses the service role internally: token columns on x_connections are
 * not SELECTable by the authenticated role (token-lockdown migration). Row
 * scope is enforced by the userId the caller resolved from its own auth.
 */
export async function getValidAccessToken(
  userId: string
): Promise<{ accessToken: string; connection: { x_user_id: string; x_username: string } }> {
  const supabase: SupabaseClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
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

  let tokens: { access_token: string; refresh_token: string; expires_in: number };
  try {
    tokens = await refreshAccessToken(conn.refresh_token);
  } catch (err) {
    // invalid_grant usually means another process already used (and rotated)
    // this refresh token — re-read the row and use the fresh token if so.
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("invalid_grant") || msg.includes("invalid_request")) {
      const { data: reread } = await supabase
        .from("x_connections")
        .select("access_token, refresh_token, access_token_expires_at, x_user_id, x_username")
        .eq("user_id", userId)
        .single();

      const rereadExpiresAt = reread?.access_token_expires_at
        ? new Date(reread.access_token_expires_at).getTime()
        : 0;
      if (
        reread?.access_token &&
        reread.refresh_token !== conn.refresh_token &&
        Date.now() < rereadExpiresAt - bufferMs
      ) {
        return {
          accessToken: reread.access_token,
          connection: { x_user_id: reread.x_user_id, x_username: reread.x_username },
        };
      }
    }
    throw err;
  }
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
  paginationToken?: string,
  sinceId?: string
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

  // Delta sync: only tweets newer than this ID. X bills per post returned, so
  // steady-state syncs should fetch the handful of new posts, not all 100.
  if (sinceId) {
    queryParams.since_id = sinceId;
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
      // reply_settings + entities (with author_id expansion) let the consumer
      // determine reply eligibility per post without extra API calls. These
      // fields are free on all paid v2 tiers. Author public_metrics powers the
      // Opportunity author-band factor (the proven 10k–100k engage-back band)
      // — fields don't bill separately; only posts returned do.
      "tweet.fields": "created_at,public_metrics,reply_settings,entities",
      "expansions": "author_id",
      "user.fields": "username,name,public_metrics",
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
    /** Up to 4 image media_ids, or 1 GIF/video media_id, from uploadMediaV2. */
    mediaIds?: string[];
    /** Who can reply to this post. Default (omitted) = everyone. */
    replySettings?: "everyone" | "mentionedUsers" | "following";
    /** Attach a poll. Mutually exclusive with media on X — poll wins if both set. */
    poll?: { options: string[]; durationMinutes: number };
  }
): Promise<{ id_str: string }> {
  const url = `${X_API_BASE}/2/tweets`;

  const body: Record<string, unknown> = { text: status };
  if (options?.inReplyToStatusId) {
    body.reply = { in_reply_to_tweet_id: options.inReplyToStatusId };
  }
  // A poll and media can't coexist on the same tweet; prefer the poll when both
  // are somehow present (the composer prevents that, this is a backstop).
  if (options?.poll && options.poll.options.length >= 2) {
    body.poll = {
      options: options.poll.options.slice(0, 4),
      duration_minutes: options.poll.durationMinutes,
    };
  } else if (options?.mediaIds && options.mediaIds.length > 0) {
    body.media = { media_ids: options.mediaIds.slice(0, 4) };
  }
  // X only accepts a non-default reply audience; omit "everyone" to keep the
  // default behavior and avoid rejections on reply tweets.
  if (options?.replySettings && options.replySettings !== "everyone") {
    body.reply_settings = options.replySettings;
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

// ── Media upload (v2, Bearer-auth, chunked INIT/APPEND/FINALIZE) ──
// Works for images, GIFs, and video. Video/large GIFs process asynchronously,
// so we poll the STATUS endpoint until the media is ready before returning.

const MEDIA_UPLOAD_URL = `${X_API_BASE}/2/media/upload`;
const APPEND_CHUNK_SIZE = 4 * 1024 * 1024; // 4 MB per APPEND segment

export type MediaCategory =
  | "tweet_image"
  | "tweet_gif"
  | "tweet_video";

/** Infer the X media_category from a MIME type. */
export function mediaCategoryForMime(mime: string): MediaCategory {
  if (mime === "image/gif") return "tweet_gif";
  if (mime.startsWith("video/")) return "tweet_video";
  return "tweet_image";
}

async function mediaRequest(
  accessToken: string,
  body: BodyInit,
  headers: Record<string, string>
): Promise<Record<string, unknown>> {
  const res = await fetch(MEDIA_UPLOAD_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, ...headers },
    body,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Media upload failed (${res.status}): ${text}`);
  }
  return res.json();
}

/**
 * Upload media to X and return its media_id. Chunked so it handles video too.
 * `bytes` is the raw file; `mimeType` drives the media_category.
 */
export async function uploadMediaV2(
  accessToken: string,
  bytes: Buffer | Uint8Array,
  mimeType: string
): Promise<{ media_id: string; category: MediaCategory }> {
  const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const category = mediaCategoryForMime(mimeType);

  // INIT
  const initForm = new URLSearchParams({
    command: "INIT",
    total_bytes: String(buffer.length),
    media_type: mimeType,
    media_category: category,
  });
  const initData = await mediaRequest(accessToken, initForm.toString(), {
    "Content-Type": "application/x-www-form-urlencoded",
  });
  const mediaId =
    (initData.data as { id?: string } | undefined)?.id ??
    (initData.media_id_string as string | undefined);
  if (!mediaId) {
    throw new Error("Media upload INIT returned no media id");
  }

  // APPEND (one or more 4MB segments)
  let segment = 0;
  for (let offset = 0; offset < buffer.length; offset += APPEND_CHUNK_SIZE) {
    const chunk = buffer.subarray(offset, offset + APPEND_CHUNK_SIZE);
    // Copy into a standalone Uint8Array so the Blob part is ArrayBuffer-backed
    // (a Node Buffer subarray can be SharedArrayBuffer-backed in TS's view).
    const part = new Uint8Array(chunk.length);
    part.set(chunk);
    const form = new FormData();
    form.append("command", "APPEND");
    form.append("media_id", mediaId);
    form.append("segment_index", String(segment));
    form.append("media", new Blob([part]));
    await mediaRequest(accessToken, form, {});
    segment += 1;
  }

  // FINALIZE
  const finalizeForm = new URLSearchParams({ command: "FINALIZE", media_id: mediaId });
  const finalizeData = await mediaRequest(accessToken, finalizeForm.toString(), {
    "Content-Type": "application/x-www-form-urlencoded",
  });

  // If async processing is required (video / large GIF), poll STATUS.
  const processing =
    (finalizeData.data as { processing_info?: { state?: string } } | undefined)?.processing_info ??
    (finalizeData.processing_info as { state?: string } | undefined);
  if (processing && processing.state && processing.state !== "succeeded") {
    await waitForMediaProcessing(accessToken, mediaId);
  }

  return { media_id: mediaId, category };
}

async function waitForMediaProcessing(accessToken: string, mediaId: string): Promise<void> {
  // Bounded poll: X reports check_after_secs; cap total wait so a stuck job
  // surfaces as an error instead of hanging the publish request.
  const maxAttempts = 20;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(
      `${MEDIA_UPLOAD_URL}?command=STATUS&media_id=${encodeURIComponent(mediaId)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Media STATUS failed (${res.status}): ${text}`);
    }
    const data = await res.json();
    const info =
      (data.data as { processing_info?: { state?: string; check_after_secs?: number } } | undefined)
        ?.processing_info ??
      (data.processing_info as { state?: string; check_after_secs?: number } | undefined);
    const state = info?.state;
    if (!state || state === "succeeded") return;
    if (state === "failed") throw new Error("X failed to process the uploaded media");
    const waitSecs = Math.min(info?.check_after_secs ?? 2, 5);
    await new Promise((r) => setTimeout(r, waitSecs * 1000));
  }
  throw new Error("Timed out waiting for X to process the uploaded media");
}

/** Attach alt text (accessibility) to an uploaded media_id. Best-effort. */
export async function setMediaAltText(
  accessToken: string,
  mediaId: string,
  altText: string
): Promise<void> {
  const res = await fetch(`${X_API_BASE}/2/media/metadata`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: mediaId,
      metadata: { alt_text: { text: altText.slice(0, 1000) } },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to set media alt text (${res.status}): ${text}`);
  }
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
