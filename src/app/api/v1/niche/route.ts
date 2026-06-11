import { withApiAuth, apiSuccess, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// GET /api/v1/niche — The user's niche profile (or null if not yet analyzed).
// 0 credits.
export const GET = withApiAuth(["niche:read"], async ({ auth }) => {
  const supabase = createAdminClient();

  const { data: profile, error } = await supabase
    .from("user_niche_profile")
    .select(
      "niche_summary, content_pillars, topic_clusters, last_analyzed_at, total_posts_analyzed, updated_at"
    )
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (error) throw error;

  return apiSuccess({ profile: profile ?? null });
});
