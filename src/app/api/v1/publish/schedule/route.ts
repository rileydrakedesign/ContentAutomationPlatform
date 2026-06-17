import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { enqueuePublish } from "@/lib/qstash/enqueue";
import { requireFeature } from "@/lib/stripe/gate";
import {
  publishCreditCost,
  requireCredits,
  refundCredits,
  checkDailyActionCap,
  withCreditHeaders,
} from "@/lib/billing/credits";

export const OPTIONS = apiOptions;

// POST /api/v1/publish/schedule — Schedule a post for later
export const POST = withApiAuth(["publish:write"], async ({ auth, request }) => {
  const featureGate = await requireFeature(auth.userId, "scheduling");
  if (featureGate) return apiError("Upgrade required — scheduling requires a Pro plan", "plan_limit", 403);

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

  // Resolve the tweet texts now: they drive the credit price (URL surcharge),
  // and a schedule with no content should fail here, not at publish time.
  const texts: string[] =
    contentType === "X_THREAD"
      ? ((payload.tweets as string[]) || (payload.thread as string[]) || [])
          .map((t) => String(t || "").trim())
          .filter(Boolean)
      : [String(payload.text || "").trim()].filter(Boolean);
  if (texts.length === 0) {
    return apiError("Missing text/tweets in payload", "validation_error", 400);
  }

  // Daily publish cap counts scheduled posts too — they become X writes.
  const cap = await checkDailyActionCap(auth.userId, "publish");
  if (!cap.allowed) {
    return apiError(
      `Daily API publish cap reached (${cap.used}/${cap.limit})`,
      "daily_cap",
      429,
      { used: cap.used, limit: cap.limit }
    );
  }

  // Debit at schedule time (refunded on cancel) so an agent can't queue
  // unlimited posts against a balance it doesn't have.
  const cost = publishCreditCost(texts);
  const charge = await requireCredits(auth.userId, cost, "publish.schedule", draftId);
  if (charge instanceof NextResponse) return charge;

  const { data: row, error: insertError } = await supabase
    .from("scheduled_posts")
    .insert({
      user_id: auth.userId,
      draft_id: draftId || null,
      content_type: contentType,
      payload,
      scheduled_for: scheduledDate.toISOString(),
      status: "scheduled",
      credits_charged: cost,
    })
    .select("id, scheduled_for")
    .single();

  if (insertError) {
    await refundCredits(auth.userId, cost, "refund.schedule_failed", draftId);
    return apiError("Failed to schedule post", "create_failed", 500);
  }

  // Enqueue QStash delivery. A null messageId means we couldn't confirm
  // exact-time delivery; the row stays `scheduled` and the publish-scheduled
  // sweep will publish it (reported as deliveryConfirmed:false below).
  const { messageId } = await enqueuePublish({
    scheduledPostId: row.id,
    userId: auth.userId,
    notBefore: Math.floor(scheduledDate.getTime() / 1000),
  });
  if (messageId) {
    await supabase
      .from("scheduled_posts")
      .update({ qstash_message_id: messageId })
      .eq("id", row.id);
  }

  // Mark draft as SCHEDULED
  if (draftId) {
    await supabase
      .from("drafts")
      .update({ status: "SCHEDULED", updated_at: new Date().toISOString() })
      .eq("id", draftId)
      .eq("user_id", auth.userId);
  }

  return withCreditHeaders(
    apiSuccess(
      { id: row.id, scheduledFor: row.scheduled_for, deliveryConfirmed: messageId !== null },
      201
    ),
    charge
  );
});
