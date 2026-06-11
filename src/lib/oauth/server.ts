/**
 * OAuth 2.1 authorization-server core for the hosted MCP connector.
 *
 * Public clients only (claude.ai, Claude Code, MCP Inspector): no client
 * secrets, PKCE S256 mandatory, refresh tokens rotate on every use. Tokens
 * are opaque (`mcp_at_` / `mcp_rt_`) and stored as SHA-256 hashes — same
 * posture as API keys.
 */
import crypto from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { ALLOWED_SCOPES } from "@/lib/api/scopes";

export const ACCESS_TOKEN_PREFIX = "mcp_at_";
export const REFRESH_TOKEN_PREFIX = "mcp_rt_";
const ACCESS_TOKEN_TTL_S = 3600; // 1 hour
const REFRESH_TOKEN_TTL_S = 30 * 24 * 3600; // 30 days
const CODE_TTL_S = 600; // 10 minutes

export function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function randomToken(prefix: string): string {
  return prefix + crypto.randomBytes(32).toString("base64url");
}

/** RFC 7636 S256: BASE64URL(SHA256(verifier)) must equal the challenge. */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  if (!codeVerifier || codeVerifier.length < 43 || codeVerifier.length > 128) {
    return false;
  }
  const computed = crypto
    .createHash("sha256")
    .update(codeVerifier)
    .digest("base64url");
  return (
    computed.length === codeChallenge.length &&
    crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(codeChallenge))
  );
}

/** Filter a requested scope string down to scopes we actually support.
 *  No/unknown scope requested → default to the full scope set. */
export function resolveScopes(scopeParam: string | null | undefined): string[] {
  const requested = (scopeParam ?? "").split(/[\s+]+/).filter(Boolean);
  const valid = requested.filter((s) =>
    (ALLOWED_SCOPES as readonly string[]).includes(s)
  );
  return valid.length > 0 ? valid : [...ALLOWED_SCOPES];
}

export interface OAuthClient {
  client_id: string;
  client_name: string | null;
  redirect_uris: string[];
}

export async function getClient(clientId: string): Promise<OAuthClient | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("oauth_clients")
    .select("client_id, client_name, redirect_uris")
    .eq("client_id", clientId)
    .maybeSingle();
  return data ?? null;
}

/** Exact-match redirect URI validation (OAuth 2.1 — no wildcards). */
export function isValidRedirectUri(client: OAuthClient, uri: string): boolean {
  return client.redirect_uris.includes(uri);
}

export async function registerClient(input: {
  clientName?: string;
  clientUri?: string;
  logoUri?: string;
  redirectUris: string[];
}): Promise<{ clientId: string }> {
  const clientId = "mcp_client_" + crypto.randomBytes(16).toString("hex");
  const supabase = createAdminClient();
  const { error } = await supabase.from("oauth_clients").insert({
    client_id: clientId,
    client_name: input.clientName ?? null,
    client_uri: input.clientUri ?? null,
    logo_uri: input.logoUri ?? null,
    redirect_uris: input.redirectUris,
  });
  if (error) throw new Error(`client registration failed: ${error.message}`);
  return { clientId };
}

export async function createAuthorizationCode(input: {
  clientId: string;
  userId: string;
  scopes: string[];
  redirectUri: string;
  codeChallenge: string;
  resource?: string;
}): Promise<string> {
  const code = randomToken("mcp_code_");
  const supabase = createAdminClient();
  const { error } = await supabase.from("oauth_codes").insert({
    code_hash: sha256(code),
    client_id: input.clientId,
    user_id: input.userId,
    scopes: input.scopes,
    redirect_uri: input.redirectUri,
    code_challenge: input.codeChallenge,
    code_challenge_method: "S256",
    resource: input.resource ?? null,
    expires_at: new Date(Date.now() + CODE_TTL_S * 1000).toISOString(),
  });
  if (error) throw new Error(`authorization code creation failed: ${error.message}`);
  return code;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scopes: string[];
}

async function issueTokens(
  clientId: string,
  userId: string,
  scopes: string[]
): Promise<IssuedTokens> {
  const accessToken = randomToken(ACCESS_TOKEN_PREFIX);
  const refreshToken = randomToken(REFRESH_TOKEN_PREFIX);
  const supabase = createAdminClient();
  const { error } = await supabase.from("oauth_tokens").insert({
    access_token_hash: sha256(accessToken),
    refresh_token_hash: sha256(refreshToken),
    client_id: clientId,
    user_id: userId,
    scopes,
    access_expires_at: new Date(Date.now() + ACCESS_TOKEN_TTL_S * 1000).toISOString(),
    refresh_expires_at: new Date(Date.now() + REFRESH_TOKEN_TTL_S * 1000).toISOString(),
  });
  if (error) throw new Error(`token issuance failed: ${error.message}`);
  return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_TTL_S, scopes };
}

export type TokenError =
  | "invalid_grant"
  | "invalid_client"
  | "invalid_request";

/** authorization_code grant: single-use code, PKCE-verified. */
export async function exchangeCode(input: {
  code: string;
  clientId: string;
  redirectUri: string;
  codeVerifier: string;
}): Promise<IssuedTokens | { error: TokenError; description: string }> {
  const supabase = createAdminClient();

  // Single-use claim: CAS on used_at so a replayed code loses the race.
  const { data: rows, error } = await supabase
    .from("oauth_codes")
    .update({ used_at: new Date().toISOString() })
    .eq("code_hash", sha256(input.code))
    .is("used_at", null)
    .select("client_id, user_id, scopes, redirect_uri, code_challenge, expires_at");

  if (error) throw new Error(`code lookup failed: ${error.message}`);
  const row = rows?.[0];
  if (!row) {
    return { error: "invalid_grant", description: "Unknown, expired, or already-used code" };
  }
  if (new Date(row.expires_at) < new Date()) {
    return { error: "invalid_grant", description: "Authorization code expired" };
  }
  if (row.client_id !== input.clientId) {
    return { error: "invalid_client", description: "Code was issued to a different client" };
  }
  if (row.redirect_uri !== input.redirectUri) {
    return { error: "invalid_grant", description: "redirect_uri mismatch" };
  }
  if (!verifyPkce(input.codeVerifier, row.code_challenge)) {
    return { error: "invalid_grant", description: "PKCE verification failed" };
  }

  return issueTokens(row.client_id, row.user_id, row.scopes);
}

/** refresh_token grant with rotation: old refresh token is revoked atomically. */
export async function refreshTokens(input: {
  refreshToken: string;
  clientId: string;
}): Promise<IssuedTokens | { error: TokenError; description: string }> {
  const supabase = createAdminClient();

  // Rotate via CAS on the hash: a stolen-and-replayed refresh token finds the
  // row already revoked and fails.
  const { data: rows, error } = await supabase
    .from("oauth_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("refresh_token_hash", sha256(input.refreshToken))
    .is("revoked_at", null)
    .select("client_id, user_id, scopes, refresh_expires_at");

  if (error) throw new Error(`refresh lookup failed: ${error.message}`);
  const row = rows?.[0];
  if (!row) {
    return { error: "invalid_grant", description: "Unknown, revoked, or rotated refresh token" };
  }
  if (row.client_id !== input.clientId) {
    return { error: "invalid_client", description: "Token was issued to a different client" };
  }
  if (row.refresh_expires_at && new Date(row.refresh_expires_at) < new Date()) {
    return { error: "invalid_grant", description: "Refresh token expired" };
  }

  return issueTokens(row.client_id, row.user_id, row.scopes);
}

export interface OAuthTokenInfo {
  tokenId: string;
  userId: string;
  clientId: string;
  scopes: string[];
}

/** Validate an mcp_at_ access token. Returns null on any failure. */
export async function validateAccessToken(
  token: string
): Promise<OAuthTokenInfo | null> {
  if (!token.startsWith(ACCESS_TOKEN_PREFIX)) return null;
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("oauth_tokens")
    .select("id, user_id, client_id, scopes, access_expires_at, revoked_at")
    .eq("access_token_hash", sha256(token))
    .maybeSingle();

  if (!row || row.revoked_at) return null;
  if (new Date(row.access_expires_at) < new Date()) return null;

  // Non-blocking usage stamp, same as API keys.
  supabase
    .from("oauth_tokens")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", row.id)
    .then(() => {});

  return {
    tokenId: row.id,
    userId: row.user_id,
    clientId: row.client_id,
    scopes: row.scopes ?? [],
  };
}
