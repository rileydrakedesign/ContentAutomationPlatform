import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// GET /api/v1/publish — List scheduled/published posts
export const GET = withApiAuth(["publish:read"], async ({ auth, request }) => {
  const supabase = createAdminClient();
  const url = new URL(request.url);
  const status = url.searchParams.get("status"); // optional filter
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));

  let query = supabase
    .from("scheduled_posts")
    .select("id, content_type, scheduled_for, status, posted_post_ids, error, payload, created_at")
    .eq("user_id", auth.userId)
    .order("scheduled_for", { ascending: true })
    .limit(limit);

  if (status) {
    query = query.eq("status", status);
  }

  const { data, error } = await query;

  if (error) {
    return apiError("Failed to fetch scheduled posts", "fetch_failed", 500);
  }

  return apiSuccess(data);
});
