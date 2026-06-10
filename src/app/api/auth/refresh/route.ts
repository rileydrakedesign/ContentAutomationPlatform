import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, handleCors } from "@/lib/cors";
import { checkAuthRateLimit } from "@/lib/api/rate-limit";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

// POST /api/auth/refresh - Refresh access token
export async function POST(request: NextRequest) {
  try {
    const { refresh_token } = await request.json();

    if (!refresh_token) {
      return NextResponse.json(
        { error: "Refresh token is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // x-real-ip is set by the Vercel proxy and not client-spoofable, unlike
    // the leftmost x-forwarded-for entry
    const ip =
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
      "unknown";
    if (!(await checkAuthRateLimit(`refresh:ip:${ip}`, 10, "1 m"))) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429, headers: corsHeaders }
      );
    }

    // Create a fresh Supabase client for auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token,
    });

    if (error) {
      // Generic message — never pass Supabase auth errors through to the client
      return NextResponse.json(
        { error: "Invalid or expired refresh token" },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!data.session) {
      return NextResponse.json(
        { error: "No session created" },
        { status: 401, headers: corsHeaders }
      );
    }

    return NextResponse.json(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Token refresh failed:", error);
    return NextResponse.json(
      { error: "Token refresh failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
