import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// GET /api/v1/queue — List scheduled posts (query: status, limit, offset)
export const GET = withApiAuth(["publish:read"], async ({ auth, request }) => {
  const supabase = createAdminClient();
  const url = new URL(request.url);

  const status = url.searchParams.get("status");
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit")) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);

  let query = supabase
    .from("scheduled_posts")
    .select(
      "id, draft_id, content_type, payload, scheduled_for, status, posted_post_ids, error, created_at",
      { count: "exact" }
    )
    .eq("user_id", auth.userId)
    .order("scheduled_for", { ascending: true })
    .range(offset, offset + limit - 1);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query;
  if (error) {
    return apiError("Failed to list scheduled posts", "fetch_failed", 500);
  }

  return apiSuccess({ items: data || [], total: count || 0, limit, offset });
});
