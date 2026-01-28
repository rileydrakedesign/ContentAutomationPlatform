import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getAccessToken } from "@/lib/x-api";

// GET /api/x/callback - OAuth 1.0a callback
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
    const oauthToken = searchParams.get("oauth_token");
    const oauthVerifier = searchParams.get("oauth_verifier");
    const denied = searchParams.get("denied");

    if (denied) {
      return NextResponse.redirect(
        new URL("/settings?error=oauth_denied", request.url)
      );
    }

    if (!oauthToken || !oauthVerifier) {
      return NextResponse.redirect(
        new URL("/settings?error=missing_params", request.url)
      );
    }

    // Get stored request token
    const { data: storedRequest } = await supabase
      .from("x_oauth_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("oauth_token", oauthToken)
      .single();

    if (!storedRequest) {
      return NextResponse.redirect(
        new URL("/settings?error=invalid_state", request.url)
      );
    }

    // Exchange for access token
    const accessData = await getAccessToken(
      oauthToken,
      storedRequest.oauth_token_secret,
      oauthVerifier
    );

    // Store connection in database
    const { error: dbError } = await supabase.from("x_connections").upsert(
      {
        user_id: user.id,
        x_user_id: accessData.user_id,
        x_username: accessData.screen_name,
        access_token: accessData.oauth_token,
        access_token_secret: accessData.oauth_token_secret,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      }
    );

    if (dbError) {
      console.error("Failed to save X connection:", dbError);
      return NextResponse.redirect(
        new URL("/settings?error=save_failed", request.url)
      );
    }

    // Clean up request token
    await supabase
      .from("x_oauth_requests")
      .delete()
      .eq("user_id", user.id);

    return NextResponse.redirect(
      new URL("/settings?success=connected", request.url)
    );
  } catch (error) {
    console.error("X OAuth callback error:", error);
    return NextResponse.redirect(
      new URL("/settings?error=callback_failed", request.url)
    );
  }
}
