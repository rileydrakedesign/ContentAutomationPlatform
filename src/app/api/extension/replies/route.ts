import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { corsHeaders, handleCors } from "@/lib/cors";
import { getDualAuthUser } from "@/lib/api/dual-auth";

export async function OPTIONS() {
  return handleCors();
}

// POST /api/extension/replies
// Logs a reply the user sent through the Chrome extension (for consistency tracking)
export async function POST(request: NextRequest) {
  try {
    const { user, supabase } = await getDualAuthUser(request);
    if (!user || !supabase) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
    }

    const body = await request.json();
    const reply_text = String(body?.reply_text || "").trim();
    const replied_to_post_id = body?.replied_to_post_id ? String(body.replied_to_post_id) : null;
    const replied_to_post_url = body?.replied_to_post_url ? String(body.replied_to_post_url) : null;
    // Parent post text — pairs the reply with what it answered (reply pool).
    const replied_to_text = body?.replied_to_text
      ? String(body.replied_to_text).slice(0, 2000)
      : null;
    let sent_at: string;
    if (body?.sent_at) {
      const parsedDate = new Date(String(body.sent_at));
      if (isNaN(parsedDate.getTime())) {
        return NextResponse.json({ error: "Invalid sent_at date" }, { status: 400, headers: corsHeaders });
      }
      sent_at = parsedDate.toISOString();
    } else {
      sent_at = new Date().toISOString();
    }

    if (!reply_text) {
      return NextResponse.json({ error: "reply_text is required" }, { status: 400, headers: corsHeaders });
    }

    const { error } = await supabase
      .from("extension_replies")
      .insert({
        user_id: user.id,
        reply_text,
        replied_to_post_id,
        replied_to_post_url,
        replied_to_text,
        sent_at,
      });

    if (error) throw error;

    return NextResponse.json({ ok: true }, { headers: corsHeaders });
  } catch (e) {
    console.error("Failed to log extension reply:", e);
    Sentry.captureException(e, { tags: { route: "extension/replies" } });
    return NextResponse.json({ error: "Failed" }, { status: 500, headers: corsHeaders });
  }
}
