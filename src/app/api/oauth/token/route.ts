import { NextRequest, NextResponse } from "next/server";
import { exchangeCode, refreshTokens } from "@/lib/oauth/server";
import { checkAuthRateLimit } from "@/lib/api/rate-limit";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const NO_STORE = { "Cache-Control": "no-store", Pragma: "no-cache" };

function tokenError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: { ...CORS, ...NO_STORE } }
  );
}

// POST /api/oauth/token — OAuth 2.1 token endpoint.
// Grants: authorization_code (PKCE-verified, single-use) and refresh_token
// (rotating). Public clients only — no client authentication.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const allowed = await checkAuthRateLimit(`oauth_token:${ip}`, 30, "1 m");
  if (!allowed) {
    return tokenError("invalid_request", "Too many token requests", 429);
  }

  let params: URLSearchParams;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      params = new URLSearchParams(
        Object.entries((await request.json()) as Record<string, string>)
      );
    } else {
      params = new URLSearchParams(await request.text());
    }
  } catch {
    return tokenError("invalid_request", "Malformed request body");
  }

  const grantType = params.get("grant_type");
  const clientId = params.get("client_id");
  if (!clientId) {
    return tokenError("invalid_client", "client_id is required");
  }

  let result;
  if (grantType === "authorization_code") {
    const code = params.get("code");
    const redirectUri = params.get("redirect_uri");
    const codeVerifier = params.get("code_verifier");
    if (!code || !redirectUri || !codeVerifier) {
      return tokenError(
        "invalid_request",
        "code, redirect_uri, and code_verifier are required"
      );
    }
    result = await exchangeCode({ code, clientId, redirectUri, codeVerifier });
  } else if (grantType === "refresh_token") {
    const refreshToken = params.get("refresh_token");
    if (!refreshToken) {
      return tokenError("invalid_request", "refresh_token is required");
    }
    result = await refreshTokens({ refreshToken, clientId });
  } else {
    return tokenError(
      "unsupported_grant_type",
      "Use authorization_code or refresh_token"
    );
  }

  if ("error" in result) {
    return tokenError(result.error, result.description);
  }

  return NextResponse.json(
    {
      access_token: result.accessToken,
      token_type: "Bearer",
      expires_in: result.expiresIn,
      refresh_token: result.refreshToken,
      scope: result.scopes.join(" "),
    },
    { headers: { ...CORS, ...NO_STORE } }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
