import { NextRequest, NextResponse } from "next/server";

const allowedOrigins = [
  process.env.NEXT_PUBLIC_APP_URL || "https://app.agentsforx.com",
  "http://localhost:3000",
];

function getAllowedOrigin(request: NextRequest): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;

  if (allowedOrigins.includes(origin)) return origin;
  if (origin.startsWith("chrome-extension://")) return origin;

  return null;
}

function buildCorsHeaders(origin: string): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/**
 * Return CORS headers for a given request.
 * Falls back to the app URL when no request is available (e.g. inline `headers: corsHeaders`).
 */
export function getCorsHeaders(request?: NextRequest): Record<string, string> {
  if (request) {
    const origin = getAllowedOrigin(request);
    if (origin) return buildCorsHeaders(origin);
    // No matching origin – return empty so no Access-Control headers are sent
    return {};
  }
  // Fallback for callers that don't pass a request yet
  return buildCorsHeaders(process.env.NEXT_PUBLIC_APP_URL || "https://app.agentsforx.com");
}

/**
 * @deprecated Use getCorsHeaders(request) instead for proper origin checking.
 * Kept for backward compatibility with existing callers that use `{ headers: corsHeaders }`.
 */
export const corsHeaders = getCorsHeaders();

// Handle OPTIONS preflight request
export function handleCors(request?: NextRequest) {
  if (request) {
    const origin = getAllowedOrigin(request);
    if (!origin) {
      return new NextResponse(null, { status: 204 });
    }
    return new NextResponse(null, {
      status: 204,
      headers: buildCorsHeaders(origin),
    });
  }
  // Fallback when called without request (existing callers)
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Add CORS headers to a response
export function withCors(requestOrResponse: NextRequest | NextResponse, maybeResponse?: NextResponse) {
  // Support both signatures: withCors(request, response) and withCors(response) for backward compat
  let request: NextRequest | undefined;
  let response: NextResponse;

  if (maybeResponse) {
    request = requestOrResponse as NextRequest;
    response = maybeResponse;
  } else {
    response = requestOrResponse as NextResponse;
  }

  const headers = request ? getCorsHeaders(request) : corsHeaders;
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
