import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";

/**
 * POST /api/reply/handoff — persist a reply HANDOFF record (C1, PRD_CORE §4.4).
 *
 * Replies never publish through the X API (Feb-2026 rules + the product wedge:
 * the human keeps the pen). Instead the composed reply is handed off to X's own
 * composer (web intent, extension assist, or copy fallback) and the user posts
 * it from their own session. This route records the handoff — the attribution
 * key for the Results pillar (engage-back / outcome tracking later).
 *
 * Zero X API surface: this writes one row and nothing else.
 *
 * v1 storage: the reply pool (`extension_replies`) — it already carries
 * {user, composed_text, target_post_id, ts}, feeds the reply-voice system, and
 * powers already-replied dedup in findReplyTargets (a handed-off target stops
 * resurfacing immediately). `watch_id` is accepted for forward-compat but not
 * yet stored — watches land with the Radar schema (Phase 1), which brings a
 * dedicated handoff table.
 */
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

    let body: {
      target_post_id?: string;
      composed_text?: string;
      target_url?: string;
      watch_id?: string;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const targetPostId = String(body.target_post_id || "").trim();
    const composedText = String(body.composed_text || "").trim();
    if (!/^\d+$/.test(targetPostId)) {
      return NextResponse.json(
        { error: "target_post_id must be the numeric ID of the post being replied to" },
        { status: 400 }
      );
    }
    if (!composedText) {
      return NextResponse.json({ error: "composed_text is required" }, { status: 400 });
    }

    const { error } = await supabase.from("extension_replies").insert({
      user_id: user.id,
      reply_text: composedText,
      replied_to_post_id: targetPostId,
      replied_to_post_url: body.target_url ? String(body.target_url) : null,
      sent_at: new Date().toISOString(),
    });

    if (error) {
      console.error("reply handoff: failed to persist record:", error.message);
      return NextResponse.json({ error: "Failed to record handoff" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Reply handoff failed:", error);
    Sentry.captureException(error, { tags: { route: "reply-handoff" } });
    return NextResponse.json({ error: "Reply handoff failed" }, { status: 500 });
  }
}
