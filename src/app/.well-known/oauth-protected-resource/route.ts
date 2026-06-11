import { NextResponse } from "next/server";
import { ALLOWED_SCOPES } from "@/lib/api/scopes";

// RFC 9728 protected-resource metadata: tells MCP clients which authorization
// server protects /api/v1/mcp. Referenced from the 401 WWW-Authenticate header.
export async function GET() {
  const issuer =
    process.env.NEXT_PUBLIC_APP_URL || "https://app.agentsforx.com";

  return NextResponse.json(
    {
      resource: `${issuer}/api/v1/mcp`,
      authorization_servers: [issuer],
      scopes_supported: [...ALLOWED_SCOPES],
      bearer_methods_supported: ["header"],
      resource_documentation: `${issuer}/developers`,
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
