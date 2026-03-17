import { NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { generatePKCE, getOAuth2AuthorizationUrl } from "@/lib/x-api";

// GET /api/x/connect - Initiate OAuth 2.0 PKCE flow
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

    const { codeVerifier, codeChallenge } = generatePKCE();
    const state = crypto.randomUUID();

    // Store PKCE verifier and state
    await supabase.from("x_oauth_requests").upsert(
      {
        user_id: user.id,
        code_verifier: codeVerifier,
        state,
        oauth_token: null,
        oauth_token_secret: null,
      },
      { onConflict: "user_id" }
    );

    const authUrl = getOAuth2AuthorizationUrl(state, codeChallenge);

    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error("Failed to initiate X OAuth:", error);
    return NextResponse.json(
      { error: "Failed to initiate connection" },
      { status: 500 }
    );
  }
}
