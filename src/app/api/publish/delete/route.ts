import { NextRequest, NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { createAuthClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";

// POST /api/publish/delete - permanently remove a scheduled post from the queue.
// Unlike cancel (which keeps the row as "cancelled"), this deletes it entirely.
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

    // Don't yank a row out from under an in-flight publish — tweets may already
    // be going out. The user can delete once it lands in posted/failed.
    if (post.status === "publishing") {
      return NextResponse.json(
        { error: "This post is currently publishing — try again once it finishes." },
        { status: 409 }
      );
    }

    // Cancel any pending QStash delivery first (best-effort).
    if (post.qstash_message_id) {
      try {
        await qstash.messages.cancel(post.qstash_message_id);
      } catch (e) {
        console.warn("delete: failed to cancel QStash message", e);
      }
    }

    const { error: deleteError } = await supabase
      .from("scheduled_posts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .neq("status", "publishing");

    if (deleteError) throw deleteError;

    // If a still-pending schedule is being removed, free its draft back to DRAFT
    // so it isn't stranded as SCHEDULED with nothing scheduled.
    if (post.draft_id && (post.status === "scheduled" || post.status === "failed")) {
      try {
        await supabase
          .from("drafts")
          .update({ status: "DRAFT", updated_at: new Date().toISOString() })
          .eq("id", post.draft_id)
          .eq("user_id", user.id);
      } catch (e) {
        console.warn("delete: failed to revert draft to DRAFT", e);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete scheduled post:", error);
    Sentry.captureException(error, { tags: { route: "publish/delete" } });
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
