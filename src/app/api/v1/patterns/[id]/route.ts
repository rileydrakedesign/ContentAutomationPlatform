import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// PATCH /api/v1/patterns/:id — Enable/disable or rename a pattern. 0 credits.
export const PATCH = withApiAuth(["patterns:write"], async ({ auth, request, params }) => {
  const id = params?.id;
  if (!id) {
    return apiError("Missing pattern id", "validation_error", 400);
  }

  let body: { is_enabled?: boolean; pattern_name?: string };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (typeof body.is_enabled === "boolean") updateData.is_enabled = body.is_enabled;
  if (typeof body.pattern_name === "string" && body.pattern_name.trim()) {
    updateData.pattern_name = body.pattern_name.trim();
  }

  if (Object.keys(updateData).length === 1) {
    return apiError(
      "Provide is_enabled (boolean) and/or pattern_name (string)",
      "validation_error",
      400
    );
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("extracted_patterns")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id, pattern_type, pattern_name, pattern_value, multiplier, is_enabled")
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return apiError("Pattern not found", "not_found", 404);
    }
    throw error;
  }

  return apiSuccess(data);
});
