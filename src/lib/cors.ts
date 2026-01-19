import { NextResponse } from "next/server";

// CORS headers for Chrome extension
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Handle OPTIONS preflight request
export function handleCors() {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders,
  });
}

// Add CORS headers to a response
export function withCors(response: NextResponse) {
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}
