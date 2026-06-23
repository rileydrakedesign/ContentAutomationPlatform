import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";

// POST /api/publish/cancel - cancel a scheduled post
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

    const body = await request.json();
    const id = String(body?.id || "").trim();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

    // Load post
    const { data: post, error } = await supabase
      .from("scheduled_posts")
      .select("id, status, draft_id, qstash_message_id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (error || !post) return NextResponse.json({ error: "Not found" }, { status: 404 });

    if (post.status === "posted") {
      return NextResponse.json({ error: "Already posted" }, { status: 400 });
    }

    // CAS: only cancel posts that aren't mid-publish — cancelling a row in
    // 'publishing' would lie to the user (tweets may already be going out).
    const { data: cancelled, error: cancelError } = await supabase
      .from("scheduled_posts")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .in("status", ["scheduled", "failed"])
      .select("id");

    if (cancelError || !cancelled || cancelled.length === 0) {
      return NextResponse.json(
        { error: "Post is currently publishing and can no longer be cancelled" },
        { status: 409 }
      );
    }

    // Cancel QStash message (best-effort)
    if (post.qstash_message_id) {
      try {
        await qstash.messages.cancel(post.qstash_message_id);
      } catch (e) {
        console.warn("cancel: failed to cancel QStash message", e);
      }
    }

    // Revert linked draft back to DRAFT (best-effort)
    if (post.draft_id) {
      try {
        await supabase
          .from("drafts")
          .update({ status: "DRAFT", updated_at: new Date().toISOString() })
          .eq("id", post.draft_id)
          .eq("user_id", user.id);
      } catch (e) {
        console.warn("cancel: failed to revert draft to DRAFT", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to cancel scheduled post:", error);
    Sentry.captureException(error, { tags: { route: "publish/cancel" } });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
