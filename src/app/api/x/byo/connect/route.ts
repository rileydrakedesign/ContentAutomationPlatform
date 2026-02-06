import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { getAuthorizationUrl, getRequestToken } from "@/lib/x-api";

// GET /api/x/byo/connect - Initiate OAuth 1.0a flow using user's BYO app credentials
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

    // Load BYO app creds
    const { data: byo } = await supabase
      .from("x_byo_apps")
      .select("consumer_key, consumer_secret")
      .eq("user_id", user.id)
      .single();

    if (!byo?.consumer_key || !byo?.consumer_secret) {
      return NextResponse.json(
        { error: "Missing BYO X API credentials" },
        { status: 400 }
      );
    }

    const callbackUrl = process.env.X_REDIRECT_URI_BYO;
    if (!callbackUrl) {
      return NextResponse.json(
        { error: "Missing X_REDIRECT_URI_BYO" },
        { status: 500 }
      );
    }

    const { oauth_token, oauth_token_secret } = await getRequestToken(callbackUrl, {
      apiKey: byo.consumer_key,
      apiSecret: byo.consumer_secret,
    });

    await supabase.from("x_oauth_requests").upsert(
      {
        user_id: user.id,
        oauth_token,
        oauth_token_secret,
      },
      { onConflict: "user_id" }
    );

    return NextResponse.json({ url: getAuthorizationUrl(oauth_token) });
  } catch (error) {
    console.error("Failed to initiate BYO X OAuth:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
