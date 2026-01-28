import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getRequestToken, getAuthorizationUrl } from "@/lib/x-api";

// GET /api/x/connect - Initiate OAuth 1.0a flow
export async function GET() {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callbackUrl = process.env.X_REDIRECT_URI!;

    // Get request token from Twitter
    const { oauth_token, oauth_token_secret } = await getRequestToken(callbackUrl);

    // Store the request token temporarily
    await supabase.from("x_oauth_requests").upsert(
      {
        user_id: user.id,
        oauth_token,
        oauth_token_secret,
      },
      { onConflict: "user_id" }
    );

    // Get authorization URL
    const authUrl = getAuthorizationUrl(oauth_token);

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error("Failed to initiate X OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate connection" },
      { status: 500 }
    );
  }
}
