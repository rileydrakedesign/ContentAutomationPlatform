import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp in seconds
}

const V1_CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": process.env.NEXT_PUBLIC_APP_URL || "https://app.agentsforx.com",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function applyCorsHeaders(response: NextResponse): void {
  Object.entries(V1_CORS_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
}

// Success response with standard headers
export function apiSuccess(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  response.headers.set("X-Request-Id", crypto.randomUUID());
  applyCorsHeaders(response);
  return response;
}

// Error response with standard format
export function apiError(
  error: string,
  code: string,
  status: number
): NextResponse {
  const response = NextResponse.json({ error, code }, { status });
  response.headers.set("X-Request-Id", crypto.randomUUID());
  applyCorsHeaders(response);
  return response;
}

// Add rate limit headers to a response
export function withRateLimitHeaders(
  response: NextResponse,
  info: RateLimitInfo
): NextResponse {
  response.headers.set("X-RateLimit-Limit", String(info.limit));
  response.headers.set("X-RateLimit-Remaining", String(info.remaining));
  response.headers.set("X-RateLimit-Reset", String(info.reset));
  return response;
}

// OPTIONS preflight handler for v1 routes
export function apiOptions(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: V1_CORS_HEADERS,
  });
}
