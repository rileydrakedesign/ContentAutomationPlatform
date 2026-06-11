import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// POST /api/v1/feedback — Log like/dislike feedback on generated content.
// Feeds the prompt assembler so future generations improve. 0 credits.
export const POST = withApiAuth(["drafts:write"], async ({ auth, request }) => {
  let body: {
    feedback_type?: string;
    generation_type?: string;
    content_text?: string;
    context_prompt?: string;
    metadata?: Record<string, unknown>;
  };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const { feedback_type, generation_type, content_text } = body;

  if (!feedback_type || !generation_type || !content_text) {
    return apiError(
      "feedback_type, generation_type, and content_text are required",
      "validation_error",
      400
    );
  }
  if (!["like", "dislike"].includes(feedback_type)) {
    return apiError("feedback_type must be 'like' or 'dislike'", "validation_error", 400);
  }
  if (!["post", "reply"].includes(generation_type)) {
    return apiError("generation_type must be 'post' or 'reply'", "validation_error", 400);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("generation_feedback")
    .insert({
      user_id: auth.userId,
      feedback_type,
      generation_type,
      content_text,
      context_prompt: body.context_prompt || null,
      metadata: body.metadata || {},
    })
    .select("id, created_at")
    .single();

  if (error) {
    return apiError("Failed to save feedback", "create_failed", 500);
  }

  return apiSuccess(data, 201);
});
