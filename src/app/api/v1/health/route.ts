import { NextRequest, NextResponse } from "next/server";
import { validateApiKey } from "@/lib/api/auth";
import { apiOptions } from "@/lib/api/response";

export const OPTIONS = apiOptions;

// GET /api/v1/health — Health check (no auth required, but shows key info if provided)
export async function GET(request: NextRequest) {
  const response: Record<string, unknown> = {
    status: "ok",
    version: "1.0.0",
    authenticated: false,
  };

  // If a key is provided, validate it and show info
  const auth = await validateApiKey(request);
  if (auth) {
    response.authenticated = true;
    response.scopes = auth.scopes;
    response.rate_limit = auth.rateLimit;
  }

  return NextResponse.json(response, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
