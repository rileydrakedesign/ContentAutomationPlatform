import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { exchangeCodeForTokens, verifyCredentials } from "@/lib/x-api";

// GET /api/x/callback - OAuth 2.0 PKCE callback
export async function GET(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(new URL("/login", request.url));
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(
        new URL("/settings?error=oauth_denied", request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/settings?error=missing_params", request.url)
      );
    }

    // Look up stored PKCE verifier by user_id + state
    const { data: storedRequest } = await supabase
      .from("x_oauth_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("state", state)
      .single();

    if (!storedRequest?.code_verifier) {
      return NextResponse.redirect(
        new URL("/settings?error=invalid_state", request.url)
      );
    }

    // Exchange authorization code for tokens
    const tokens = await exchangeCodeForTokens(code, storedRequest.code_verifier);

    // Get user info (OAuth 2.0 token response doesn't include it)
    const xUser = await verifyCredentials(tokens.access_token);

    // Save connection
    const { error: dbError } = await supabase.from("x_connections").upsert(
      {
        user_id: user.id,
        x_user_id: xUser.id,
        x_username: xUser.username,
        access_token: tokens.access_token,
        access_token_secret: null,
        refresh_token: tokens.refresh_token,
        access_token_expires_at: new Date(
          Date.now() + tokens.expires_in * 1000
        ).toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (dbError) {
      console.error("Failed to save X connection:", dbError);
      return NextResponse.redirect(
        new URL("/settings?error=save_failed", request.url)
      );
    }

    // Clean up oauth request
    await supabase
      .from("x_oauth_requests")
      .delete()
      .eq("user_id", user.id);

    return NextResponse.redirect(
      new URL("/settings?success=connected", request.url)
    );
  } catch (err) {
    console.error("X OAuth callback error:", err);
    return NextResponse.redirect(
      new URL("/settings?error=callback_failed", request.url)
    );
  }
}
