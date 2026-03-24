import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";
import { qstash } from "@/lib/qstash/client";

export const OPTIONS = apiOptions;

// POST /api/v1/publish/schedule — Schedule a post for later
export const POST = withApiAuth(["publish:write"], async ({ auth, request }) => {
  const supabase = createAdminClient();

  let body: { contentType?: string; payload?: Record<string, unknown>; scheduledFor?: string; draftId?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const { contentType, payload, scheduledFor, draftId } = body;

  if (!contentType || !["X_POST", "X_THREAD"].includes(contentType)) {
    return apiError("contentType must be X_POST or X_THREAD", "validation_error", 400);
  }

  if (!payload || typeof payload !== "object") {
    return apiError("Missing payload", "validation_error", 400);
  }

  const scheduledDate = scheduledFor ? new Date(scheduledFor) : null;
  if (!scheduledDate || isNaN(scheduledDate.getTime())) {
    return apiError("Invalid scheduledFor date", "validation_error", 400);
  }

  if (scheduledDate.getTime() < Date.now()) {
    return apiError("scheduledFor must be in the future", "validation_error", 400);
  }

  const { data: row, error: insertError } = await supabase
    .from("scheduled_posts")
    .insert({
      user_id: auth.userId,
      draft_id: draftId || null,
      content_type: contentType,
      payload,
      scheduled_for: scheduledDate.toISOString(),
      status: "scheduled",
    })
    .select("id, scheduled_for")
    .single();

  if (insertError) {
    return apiError("Failed to schedule post", "create_failed", 500);
  }

  // Enqueue QStash
  try {
    const publishUrl = `${process.env.QSTASH_PUBLISH_URL}/api/qstash/publish`;
    const notBefore = Math.floor(scheduledDate.getTime() / 1000);

    const qstashRes = await qstash.publishJSON({
      url: publishUrl,
      body: { scheduledPostId: row.id, userId: auth.userId },
      notBefore,
      retries: 3,
    });

    await supabase
      .from("scheduled_posts")
      .update({ qstash_message_id: qstashRes.messageId })
      .eq("id", row.id);
  } catch (e) {
    console.error("v1 schedule: QStash enqueue failed", e);
  }

  // Mark draft as SCHEDULED
  if (draftId) {
    await supabase
      .from("drafts")
      .update({ status: "SCHEDULED", updated_at: new Date().toISOString() })
      .eq("id", draftId)
      .eq("user_id", auth.userId);
  }

  return apiSuccess({ id: row.id, scheduledFor: row.scheduled_for }, 201);
});
