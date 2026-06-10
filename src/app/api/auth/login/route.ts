import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, handleCors } from "@/lib/cors";
import { checkAuthRateLimit } from "@/lib/api/rate-limit";

// Handle CORS preflight
export async function OPTIONS() {
  return handleCors();
}

// POST /api/auth/login - Login and return tokens for extension
export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400, headers: corsHeaders }
      );
    }

    // x-real-ip is set by the Vercel proxy and not client-spoofable, unlike
    // the leftmost x-forwarded-for entry
    const ip =
      request.headers.get("x-real-ip") ||
      request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ||
      "unknown";
    const [ipAllowed, emailAllowed] = await Promise.all([
      checkAuthRateLimit(`login:ip:${ip}`, 5, "1 m"),
      checkAuthRateLimit(`login:email:${String(email).trim().toLowerCase()}`, 10, "1 h"),
    ]);
    if (!ipAllowed || !emailAllowed) {
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later." },
        { status: 429, headers: corsHeaders }
      );
    }

    // Create a fresh Supabase client for auth
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      // Generic message — never pass Supabase auth errors through to the client
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401, headers: corsHeaders }
      );
    }

    if (!data.session) {
      return NextResponse.json(
        { error: "No session created" },
        { status: 401, headers: corsHeaders }
      );
    }

    // Return tokens for the extension to store
    return NextResponse.json(
      {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        user: {
          id: data.user?.id,
          email: data.user?.email,
        },
      },
      { headers: corsHeaders }
    );
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500, headers: corsHeaders }
    );
  }
}
