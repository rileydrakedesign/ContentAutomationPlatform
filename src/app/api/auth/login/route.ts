import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { corsHeaders, handleCors } from "@/lib/cors";

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
      return NextResponse.json(
        { error: error.message },
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
