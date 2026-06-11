import { NextResponse } from "next/server";
import { ALLOWED_SCOPES } from "@/lib/api/scopes";

// RFC 8414 authorization-server metadata. claude.ai and other MCP clients
// discover the OAuth endpoints from here.
export async function GET() {
  const issuer =
    process.env.NEXT_PUBLIC_APP_URL || "https://app.agentsforx.com";

  return NextResponse.json(
    {
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/api/oauth/token`,
      registration_endpoint: `${issuer}/api/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: [...ALLOWED_SCOPES],
      service_documentation: `${issuer}/developers`,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
