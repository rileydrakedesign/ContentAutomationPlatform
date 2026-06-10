import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";

export const OPTIONS = apiOptions;

// DELETE /api/v1/queue/:id — Cancel a scheduled post (only while still pending)
export const DELETE = withApiAuth(["publish:write"], async ({ auth, params }) => {
  const id = params?.id;
  if (!id) {
    return apiError("Missing scheduled post id", "validation_error", 400);
  }

  const supabase = createAdminClient();

  const { data: row, error: fetchError } = await supabase
    .from("scheduled_posts")
    .select("id, status, draft_id, qstash_message_id")
    .eq("id", id)
    .eq("user_id", auth.userId)
    .single();

  if (fetchError || !row) {
    return apiError("Scheduled post not found", "not_found", 404);
  }

  if (row.status !== "scheduled") {
    return apiError(
      `Cannot cancel a post with status '${row.status}'`,
      "invalid_state",
      409
    );
  }

  // Best-effort: cancel the queued QStash delivery so it never fires.
  if (row.qstash_message_id) {
    try {
      await qstash.messages.delete(row.qstash_message_id);
    } catch (e) {
      console.warn("v1 queue cancel: QStash delete failed", e);
    }
  }

  // CAS on status: if publishing claimed the row between our read and now,
  // 0 rows match and we must not pretend it was cancelled.
  const { data: cancelled, error: updateError } = await supabase
    .from("scheduled_posts")
    .update({ status: "cancelled", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", auth.userId)
    .eq("status", "scheduled")
    .select("id");

  if (updateError) {
    return apiError("Failed to cancel scheduled post", "update_failed", 500);
  }
  if (!cancelled || cancelled.length === 0) {
    return apiError(
      "Post is no longer in 'scheduled' state (publishing may have started)",
      "invalid_state",
      409
    );
  }

  // Return the linked draft to DRAFT status so it can be re-queued.
  if (row.draft_id) {
    await supabase
      .from("drafts")
      .update({ status: "DRAFT", updated_at: new Date().toISOString() })
      .eq("id", row.draft_id)
      .eq("user_id", auth.userId);
  }

  return apiSuccess({ id, status: "cancelled" });
});
