import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

const DEFAULT_STRATEGY = {
  posts_per_week: 5,
  threads_per_week: 1,
  replies_per_week: 10,
  pillar_targets: [],
};

// GET /api/v1/strategy — Get content strategy
export const GET = withApiAuth(["strategy:read"], async ({ auth }) => {
  const supabase = createAdminClient();

  const { data: strategy, error } = await supabase
    .from("content_strategy")
    .select("*")
    .eq("user_id", auth.userId)
    .single();

  if (error && error.code === "PGRST116") {
    return apiSuccess({ strategy: DEFAULT_STRATEGY });
  }
  if (error) {
    return apiError("Failed to fetch strategy", "fetch_failed", 500);
  }

  return apiSuccess({ strategy });
});

// PUT /api/v1/strategy — Upsert content strategy
export const PUT = withApiAuth(["strategy:write"], async ({ auth, request }) => {
  const supabase = createAdminClient();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const posts_per_week = Math.max(0, Math.floor(Number(body.posts_per_week) || 0));
  const threads_per_week = Math.max(0, Math.floor(Number(body.threads_per_week) || 0));
  const replies_per_week = Math.max(0, Math.floor(Number(body.replies_per_week) || 0));

  const pillar_targets = Array.isArray(body.pillar_targets)
    ? (body.pillar_targets as { pillar?: string; posts_per_week?: number }[])
        .filter((t) => t && typeof t.pillar === "string" && t.pillar.trim())
        .map((t) => ({
          pillar: String(t.pillar).trim(),
          posts_per_week: Math.max(0, Math.floor(Number(t.posts_per_week) || 0)),
        }))
    : [];

  const { data: strategy, error } = await supabase
    .from("content_strategy")
    .upsert(
      {
        user_id: auth.userId,
        posts_per_week,
        threads_per_week,
        replies_per_week,
        pillar_targets,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    )
    .select()
    .single();

  if (error) {
    return apiError("Failed to save strategy", "update_failed", 500);
  }

  return apiSuccess({ strategy });
});
