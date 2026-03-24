import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// GET /api/v1/drafts/:id
export const GET = withApiAuth(["drafts:read"], async ({ auth, params }) => {
  const supabase = createAdminClient();

  const { data: draft, error } = await supabase
    .from("drafts")
    .select("*")
    .eq("id", params!.id)
    .eq("user_id", auth.userId)
    .single();

  if (error || !draft) {
    return apiError("Draft not found", "not_found", 404);
  }

  return apiSuccess(draft);
});

// PATCH /api/v1/drafts/:id
export const PATCH = withApiAuth(["drafts:write"], async ({ auth, request, params }) => {
  const supabase = createAdminClient();

  let body: { status?: string; editedContent?: Record<string, unknown>; content?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const validStatuses = ["DRAFT", "POSTED", "SCHEDULED", "REJECTED"];
  if (body.status && !validStatuses.includes(body.status)) {
    return apiError(`Invalid status. Must be one of: ${validStatuses.join(", ")}`, "validation_error", 400);
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.status) updateData.status = body.status;
  if (body.editedContent) updateData.edited_content = body.editedContent;
  if (body.content) updateData.content = body.content;

  const { data: draft, error } = await supabase
    .from("drafts")
    .update(updateData)
    .eq("id", params!.id)
    .eq("user_id", auth.userId)
    .select()
    .single();

  if (error || !draft) {
    return apiError("Draft not found", "not_found", 404);
  }

  return apiSuccess(draft);
});

// DELETE /api/v1/drafts/:id
export const DELETE = withApiAuth(["drafts:write"], async ({ auth, params }) => {
  const supabase = createAdminClient();

  const { error } = await supabase
    .from("drafts")
    .delete()
    .eq("id", params!.id)
    .eq("user_id", auth.userId);

  if (error) {
    return apiError("Draft not found", "not_found", 404);
  }

  return apiSuccess({ deleted: true });
});
