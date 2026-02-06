import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";
import { postTweet } from "@/lib/x-api";

type ContentType = "X_POST" | "X_THREAD";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Ensure BYO creds exist
    const { data: byo } = await supabase
      .from("x_byo_apps")
      .select("consumer_key, consumer_secret")
      .eq("user_id", user.id)
      .single();

    if (!byo?.consumer_key || !byo?.consumer_secret) {
      return NextResponse.json({ error: "Missing BYO X API credentials" }, { status: 400 });
    }

    // Ensure X account connected
    const { data: connection } = await supabase
      .from("x_connections")
      .select("access_token, access_token_secret")
      .eq("user_id", user.id)
      .single();

    if (!connection?.access_token || !connection?.access_token_secret) {
      return NextResponse.json({ error: "X account not connected" }, { status: 400 });
    }

    const body = await request.json();
    const contentType: ContentType = body?.contentType;
    const payload = body?.payload;

    if (!contentType || !["X_POST", "X_THREAD"].includes(contentType)) {
      return NextResponse.json({ error: "Invalid contentType" }, { status: 400 });
    }

    // Publish
    if (contentType === "X_POST") {
      const text = String(payload?.text || "").trim();
      if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });

      const posted = await postTweet(
        connection.access_token,
        connection.access_token_secret,
        text,
        { apiKey: byo.consumer_key, apiSecret: byo.consumer_secret }
      );

      return NextResponse.json({ success: true, postedIds: [posted.id_str] });
    }

    const tweets: string[] = Array.isArray(payload?.tweets) ? payload.tweets : [];
    const cleaned = tweets.map((t) => String(t || "").trim()).filter(Boolean);
    if (cleaned.length === 0) {
      return NextResponse.json({ error: "Missing tweets" }, { status: 400 });
    }

    const postedIds: string[] = [];

    // Tweet 1
    const first = await postTweet(
      connection.access_token,
      connection.access_token_secret,
      cleaned[0],
      { apiKey: byo.consumer_key, apiSecret: byo.consumer_secret }
    );
    postedIds.push(first.id_str);

    // Replies for thread
    let replyTo = first.id_str;
    for (let i = 1; i < cleaned.length; i++) {
      const next = await postTweet(
        connection.access_token,
        connection.access_token_secret,
        cleaned[i],
        {
          inReplyToStatusId: replyTo,
          apiKey: byo.consumer_key,
          apiSecret: byo.consumer_secret,
        }
      );
      postedIds.push(next.id_str);
      replyTo = next.id_str;
    }

    return NextResponse.json({ success: true, postedIds });
  } catch (error) {
    console.error("Failed to publish now:", error);
    return NextResponse.json({ error: "Failed to publish" }, { status: 500 });
  }
}
