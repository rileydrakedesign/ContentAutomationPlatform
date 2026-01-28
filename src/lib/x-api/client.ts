// X API client using OAuth 1.0a
import crypto from "crypto";

const X_API_BASE = "https://api.twitter.com";

export interface XUser {
  id: string;
  id_str: string;
  screen_name: string;
  name: string;
  profile_image_url_https?: string;
}

export interface XTweet {
  id_str: string;
  text: string;
  full_text?: string;
  created_at: string;
  user: {
    id_str: string;
    screen_name: string;
    name: string;
  };
  retweet_count: number;
  favorite_count: number;
  reply_count?: number;
  quote_count?: number;
  // Note: impressions/views require different API access
}

interface OAuthParams {
  oauth_consumer_key: string;
  oauth_token?: string;
  oauth_signature_method: string;
  oauth_timestamp: string;
  oauth_nonce: string;
  oauth_version: string;
  oauth_callback?: string;
  oauth_verifier?: string;
}

// Generate OAuth 1.0a signature
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string,
  tokenSecret: string = ""
): string {
  // Sort and encode parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join("&");

  // Create signature base string
  const signatureBase = [
    method.toUpperCase(),
    encodeURIComponent(url),
    encodeURIComponent(sortedParams),
  ].join("&");

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&${encodeURIComponent(tokenSecret)}`;

  // Generate HMAC-SHA1 signature
  const signature = crypto
    .createHmac("sha1", signingKey)
    .update(signatureBase)
    .digest("base64");

  return signature;
}

// Build OAuth Authorization header
function buildOAuthHeader(oauthParams: Record<string, string>): string {
  const headerParams = Object.keys(oauthParams)
    .filter((key) => key.startsWith("oauth_"))
    .sort()
    .map((key) => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
    .join(", ");

  return `OAuth ${headerParams}`;
}

// Generate nonce
function generateNonce(): string {
  return crypto.randomBytes(16).toString("hex");
}

// Step 1: Get request token
export async function getRequestToken(callbackUrl: string): Promise<{
  oauth_token: string;
  oauth_token_secret: string;
}> {
  const apiKey = process.env.X_API_KEY!;
  const apiSecret = process.env.X_API_SECRET!;
  const url = `${X_API_BASE}/oauth/request_token`;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: generateNonce(),
    oauth_version: "1.0",
    oauth_callback: callbackUrl,
  };

  // Generate signature
  oauthParams.oauth_signature = generateOAuthSignature(
    "POST",
    url,
    oauthParams,
    apiSecret
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildOAuthHeader(oauthParams),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get request token: ${text}`);
  }

  const text = await response.text();
  const params = new URLSearchParams(text);

  return {
    oauth_token: params.get("oauth_token")!,
    oauth_token_secret: params.get("oauth_token_secret")!,
  };
}

// Step 2: Get authorization URL
export function getAuthorizationUrl(oauthToken: string): string {
  return `${X_API_BASE}/oauth/authorize?oauth_token=${oauthToken}`;
}

// Step 3: Exchange for access token
export async function getAccessToken(
  oauthToken: string,
  oauthTokenSecret: string,
  oauthVerifier: string
): Promise<{
  oauth_token: string;
  oauth_token_secret: string;
  user_id: string;
  screen_name: string;
}> {
  const apiKey = process.env.X_API_KEY!;
  const apiSecret = process.env.X_API_SECRET!;
  const url = `${X_API_BASE}/oauth/access_token`;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_token: oauthToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: generateNonce(),
    oauth_version: "1.0",
    oauth_verifier: oauthVerifier,
  };

  // Generate signature
  oauthParams.oauth_signature = generateOAuthSignature(
    "POST",
    url,
    oauthParams,
    apiSecret,
    oauthTokenSecret
  );

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: buildOAuthHeader(oauthParams),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get access token: ${text}`);
  }

  const text = await response.text();
  const params = new URLSearchParams(text);

  return {
    oauth_token: params.get("oauth_token")!,
    oauth_token_secret: params.get("oauth_token_secret")!,
    user_id: params.get("user_id")!,
    screen_name: params.get("screen_name")!,
  };
}

// Make authenticated API request
async function makeAuthenticatedRequest(
  method: string,
  url: string,
  accessToken: string,
  accessTokenSecret: string,
  queryParams: Record<string, string> = {}
): Promise<Response> {
  const apiKey = process.env.X_API_KEY!;
  const apiSecret = process.env.X_API_SECRET!;

  const oauthParams: Record<string, string> = {
    oauth_consumer_key: apiKey,
    oauth_token: accessToken,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_nonce: generateNonce(),
    oauth_version: "1.0",
  };

  // Combine OAuth params with query params for signature
  const allParams = { ...oauthParams, ...queryParams };

  // Generate signature
  oauthParams.oauth_signature = generateOAuthSignature(
    method,
    url,
    allParams,
    apiSecret,
    accessTokenSecret
  );

  // Build URL with query params
  const queryString = Object.keys(queryParams).length > 0
    ? "?" + new URLSearchParams(queryParams).toString()
    : "";

  return fetch(`${url}${queryString}`, {
    method,
    headers: {
      Authorization: buildOAuthHeader(oauthParams),
    },
  });
}

// Verify credentials and get user info
export async function verifyCredentials(
  accessToken: string,
  accessTokenSecret: string
): Promise<XUser> {
  const url = `${X_API_BASE}/1.1/account/verify_credentials.json`;

  const response = await makeAuthenticatedRequest(
    "GET",
    url,
    accessToken,
    accessTokenSecret
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to verify credentials: ${text}`);
  }

  return response.json();
}

// Get user's timeline (their tweets)
export async function getUserTimeline(
  accessToken: string,
  accessTokenSecret: string,
  count: number = 100,
  maxId?: string
): Promise<XTweet[]> {
  const url = `${X_API_BASE}/1.1/statuses/user_timeline.json`;

  const queryParams: Record<string, string> = {
    count: count.toString(),
    tweet_mode: "extended",
    include_rts: "false", // Exclude retweets
  };

  if (maxId) {
    queryParams.max_id = maxId;
  }

  const response = await makeAuthenticatedRequest(
    "GET",
    url,
    accessToken,
    accessTokenSecret,
    queryParams
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get timeline: ${text}`);
  }

  return response.json();
}

// Get a single tweet by ID
export async function getTweet(
  accessToken: string,
  accessTokenSecret: string,
  tweetId: string
): Promise<XTweet> {
  const url = `${X_API_BASE}/1.1/statuses/show.json`;

  const queryParams: Record<string, string> = {
    id: tweetId,
    tweet_mode: "extended",
  };

  const response = await makeAuthenticatedRequest(
    "GET",
    url,
    accessToken,
    accessTokenSecret,
    queryParams
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get tweet: ${text}`);
  }

  return response.json();
}

// Extract tweet ID from URL
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
