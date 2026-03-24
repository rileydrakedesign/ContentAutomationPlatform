import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// GET /api/v1/analytics — Get analytics data (CSV-uploaded + captured posts)
export const GET = withApiAuth(["analytics:read"], async ({ auth, request }) => {
  const supabase = createAdminClient();
  const url = new URL(request.url);
  const include = url.searchParams.get("include") || "summary"; // "summary" | "posts" | "all"

  // Fetch CSV analytics
  const { data: analytics } = await supabase
    .from("user_analytics")
    .select("total_posts, total_replies, date_range, uploaded_at, csv_filename, posts")
    .eq("user_id", auth.userId)
    .single();

  // Fetch own captured posts with metrics
  const { data: capturedPosts, count: capturedCount } = await supabase
    .from("captured_posts")
    .select("id, x_post_id, text_content, post_timestamp, metrics, post_url", { count: "exact" })
    .eq("user_id", auth.userId)
    .eq("is_own_post", true)
    .order("post_timestamp", { ascending: false })
    .limit(include === "summary" ? 0 : 100);

  const response: Record<string, unknown> = {
    csv_analytics: analytics
      ? {
          total_posts: analytics.total_posts,
          total_replies: analytics.total_replies,
          date_range: analytics.date_range,
          uploaded_at: analytics.uploaded_at,
          csv_filename: analytics.csv_filename,
        }
      : null,
    captured_posts_count: capturedCount || 0,
  };

  if (include === "posts" || include === "all") {
    response.captured_posts = capturedPosts || [];
  }

  if (include === "all" && analytics?.posts) {
    response.csv_posts = analytics.posts;
  }

  return apiSuccess(response);
});
