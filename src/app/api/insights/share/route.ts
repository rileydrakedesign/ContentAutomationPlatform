import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { corsHeaders, handleCors } from "@/lib/cors";

export const runtime = "nodejs";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/insights/share — opt in to a public, shareable Voice Report and get
// the link. Generates a stable share_token on the user's niche profile (the
// "demonstrate, don't claim" artifact). Requires a tuned profile first.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const { data: profile } = await supabase
      .from("user_niche_profile")
      .select("id, share_token")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!profile?.id) {
      return NextResponse.json(
        { error: "Run a Voice Tune-Up first — there's nothing to share yet." },
        { status: 400, headers: corsHeaders }
      );
    }

    let token = profile.share_token as string | null;
    if (!token) {
      token = randomUUID();
      const { error: updateError } = await supabase
        .from("user_niche_profile")
        .update({ share_token: token })
        .eq("id", profile.id);
      if (updateError) throw updateError;
    }

    const origin = request.nextUrl.origin;
    return NextResponse.json(
      { token, url: `${origin}/share/${token}` },
      { status: 200, headers: corsHeaders }
    );
  } catch (error) {
    console.error("insights/share failed:", error);
    Sentry.captureException(error, { tags: { route: "insights/share" } });
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500, headers: corsHeaders });
  }
}

// DELETE /api/insights/share — revoke the public link.
export async function DELETE() {
  try {
    const supabase = await createAuthClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (!user || authError) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }
    await supabase
      .from("user_niche_profile")
      .update({ share_token: null })
      .eq("user_id", user.id);
    return NextResponse.json({ ok: true }, { status: 200, headers: corsHeaders });
  } catch (error) {
    Sentry.captureException(error, { tags: { route: "insights/share:delete" } });
    return NextResponse.json({ error: "Failed to revoke" }, { status: 500, headers: corsHeaders });
  }
}
