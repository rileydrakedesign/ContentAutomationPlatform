import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// DELETE /api/v1/inspiration/:id — Remove a saved inspiration post. 0 credits.
export const DELETE = withApiAuth(["inspiration:write"], async ({ auth, params }) => {
  const id = params?.id;
  if (!id) {
    return apiError("Missing inspiration post id", "validation_error", 400);
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inspiration_posts")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.userId)
    .select("id");

  if (error) throw error;
  if (!data || data.length === 0) {
    return apiError("Inspiration post not found", "not_found", 404);
  }

  return apiSuccess({ id, deleted: true });
});
