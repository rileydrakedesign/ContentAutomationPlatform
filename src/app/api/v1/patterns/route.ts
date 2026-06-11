import { withApiAuth, apiSuccess, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// GET /api/v1/patterns — List extracted growth patterns. 0 credits (DB read).
export const GET = withApiAuth(["patterns:read"], async ({ auth, request }) => {
  const supabase = createAdminClient();
  const url = new URL(request.url);
  const patternType = url.searchParams.get("type");
  const enabledOnly = url.searchParams.get("enabled_only") === "true";
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") || 200)));

  let query = supabase
    .from("extracted_patterns")
    .select(
      "id, pattern_type, pattern_name, pattern_value, multiplier, confidence_score, is_enabled, extraction_batch, created_at"
    )
    .eq("user_id", auth.userId)
    .order("multiplier", { ascending: false })
    .limit(limit);

  if (patternType) query = query.eq("pattern_type", patternType);
  if (enabledOnly) query = query.eq("is_enabled", true);

  const { data, error } = await query;
  if (error) throw error;

  return apiSuccess({ patterns: data || [] });
});
