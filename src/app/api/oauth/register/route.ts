import { NextRequest, NextResponse } from "next/server";
import { registerClient } from "@/lib/oauth/server";
import { checkAuthRateLimit } from "@/lib/api/rate-limit";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function oauthError(error: string, description: string, status = 400) {
  return NextResponse.json(
    { error, error_description: description },
    { status, headers: CORS }
  );
}

/** A registerable redirect URI: https, or http on localhost (dev clients). */
function isAcceptableRedirectUri(uri: string): boolean {
  try {
    const u = new URL(uri);
    if (u.protocol === "https:") return true;
    return (
      u.protocol === "http:" &&
      (u.hostname === "localhost" || u.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

// POST /api/oauth/register — RFC 7591 dynamic client registration.
// Open (the spec's model for public clients) but IP rate-limited; clients
// hold no secrets, so registration grants nothing by itself — every grant
// still requires a logged-in user's consent.
export async function POST(request: NextRequest) {
  const ip =
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const allowed = await checkAuthRateLimit(`oauth_register:${ip}`, 10, "1 h");
  if (!allowed) {
    return oauthError("invalid_request", "Too many registrations — try later", 429);
  }

  let body: {
    redirect_uris?: string[];
    client_name?: string;
    client_uri?: string;
    logo_uri?: string;
    token_endpoint_auth_method?: string;
    grant_types?: string[];
    response_types?: string[];
  };
  try {
    body = await request.json();
  } catch {
    return oauthError("invalid_client_metadata", "Body must be JSON");
  }

  const redirectUris = Array.isArray(body.redirect_uris) ? body.redirect_uris : [];
  if (redirectUris.length === 0 || redirectUris.length > 10) {
    return oauthError("invalid_redirect_uri", "Provide 1-10 redirect_uris");
  }
  for (const uri of redirectUris) {
    if (typeof uri !== "string" || !isAcceptableRedirectUri(uri)) {
      return oauthError(
        "invalid_redirect_uri",
        `redirect_uris must be https (or localhost http): ${uri}`
      );
    }
  }

  if (
    body.token_endpoint_auth_method &&
    body.token_endpoint_auth_method !== "none"
  ) {
    return oauthError(
      "invalid_client_metadata",
      "Only public clients are supported (token_endpoint_auth_method: none)"
    );
  }

  const { clientId } = await registerClient({
    clientName: typeof body.client_name === "string" ? body.client_name.slice(0, 100) : undefined,
    clientUri: typeof body.client_uri === "string" ? body.client_uri.slice(0, 500) : undefined,
    logoUri: typeof body.logo_uri === "string" ? body.logo_uri.slice(0, 500) : undefined,
    redirectUris,
  });

  return NextResponse.json(
    {
      client_id: clientId,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_name: body.client_name,
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
    },
    { status: 201, headers: CORS }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
