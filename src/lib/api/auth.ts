import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import crypto from "crypto";

const KEY_PREFIX = "sk_live_";

export { ALLOWED_SCOPES } from "./scopes";
export type { ApiScope } from "./scopes";

export interface ApiKeyInfo {
  userId: string;
  keyId: string;
  scopes: string[];
  rateLimit: number;
}

// Generate a new API key — returns the raw key (shown once) plus prefix and hash for storage
export function generateApiKey(): { raw: string; prefix: string; hash: string } {
  const randomBytes = crypto.randomBytes(32);
  const raw = KEY_PREFIX + randomBytes.toString("base64url");
  const prefix = raw.slice(0, KEY_PREFIX.length + 8);
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { raw, prefix, hash };
}

// Hash a raw key for lookup
function hashKey(raw: string): string {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

// Validate an API key from the request Authorization header
export async function validateApiKey(
  request: NextRequest
): Promise<ApiKeyInfo | null> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token.startsWith(KEY_PREFIX)) return null;

  const keyHash = hashKey(token);
  const supabase = createAdminClient();

  const { data: key, error } = await supabase
    .from("api_keys")
    .select("id, user_id, scopes, rate_limit, revoked_at, expires_at")
    .eq("key_hash", keyHash)
    .single();

  if (error || !key) return null;
  if (key.revoked_at) return null;
  if (key.expires_at && new Date(key.expires_at) < new Date()) return null;

  // Update last_used_at (non-blocking)
  supabase
    .from("api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", key.id)
    .then(() => {});

  return {
    userId: key.user_id,
    keyId: key.id,
    scopes: key.scopes || [],
    rateLimit: key.rate_limit,
  };
}

// Check if the key has all required scopes
function hasScopes(keyScopes: string[], required: string[]): boolean {
  return required.every((s) => keyScopes.includes(s));
}

// Require API key auth with specific scopes. Returns key info or null (caller handles error response).
export async function requireApiAuth(
  request: NextRequest,
  requiredScopes: string[] = []
): Promise<
  | { ok: true; auth: ApiKeyInfo }
  | { ok: false; status: 401 | 403; error: string; code: string }
> {
  const auth = await validateApiKey(request);

  if (!auth) {
    return {
      ok: false,
      status: 401,
      error: "Invalid or missing API key",
      code: "unauthorized",
    };
  }

  if (requiredScopes.length > 0 && !hasScopes(auth.scopes, requiredScopes)) {
    return {
      ok: false,
      status: 403,
      error: `Missing required scopes: ${requiredScopes.filter((s) => !auth.scopes.includes(s)).join(", ")}`,
      code: "forbidden",
    };
  }

  return { ok: true, auth };
}
