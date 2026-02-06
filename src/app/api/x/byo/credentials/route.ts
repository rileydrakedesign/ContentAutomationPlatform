import { NextRequest, NextResponse } from "next/server";
import { createAuthClient } from "@/lib/supabase/server";

// GET /api/x/byo/credentials - check if user has stored BYO X app credentials
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

    const { data } = await supabase
      .from("x_byo_apps")
      .select("consumer_key, updated_at")
      .eq("user_id", user.id)
      .single();

    if (!data?.consumer_key) {
      return NextResponse.json({ configured: false });
    }

    const key = data.consumer_key;
    const masked = key.length <= 8 ? "••••" : `${key.slice(0, 4)}••••${key.slice(-4)}`;

    return NextResponse.json({
      configured: true,
      consumerKeyMasked: masked,
      updatedAt: data.updated_at,
    });
  } catch (error) {
    console.error("Failed to get BYO X credentials:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PATCH /api/x/byo/credentials - store BYO X app credentials
export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createAuthClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const consumerKey = String(body?.consumerKey || "").trim();
    const consumerSecret = String(body?.consumerSecret || "").trim();

    if (!consumerKey || !consumerSecret) {
      return NextResponse.json(
        { error: "consumerKey and consumerSecret are required" },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("x_byo_apps").upsert(
      {
        user_id: user.id,
        consumer_key: consumerKey,
        consumer_secret: consumerSecret,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to save BYO X credentials:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
