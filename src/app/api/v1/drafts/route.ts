import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// GET /api/v1/drafts — List drafts
export const GET = withApiAuth(["drafts:read"], async ({ auth, request }) => {
  const supabase = createAdminClient();
  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "DRAFT";
  const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") || 50)));
  const offset = Math.max(0, Number(url.searchParams.get("offset") || 0));

  const { data, error, count } = await supabase
    .from("drafts")
    .select("*", { count: "exact" })
    .eq("user_id", auth.userId)
    .eq("status", status)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return apiError("Failed to fetch drafts", "fetch_failed", 500);
  }

  return apiSuccess({ data, total: count, limit, offset });
});

// POST /api/v1/drafts — Create a draft
export const POST = withApiAuth(["drafts:write"], async ({ auth, request }) => {
  const supabase = createAdminClient();

  let body: { type?: string; content?: Record<string, unknown>; topic?: string; appliedPatterns?: string[]; metadata?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return apiError("Invalid JSON body", "invalid_body", 400);
  }

  const { type, content, topic, appliedPatterns, metadata } = body;

  if (!type || !content) {
    return apiError("Missing type or content", "validation_error", 400);
  }

  if (!["X_POST", "X_THREAD"].includes(type)) {
    return apiError("type must be X_POST or X_THREAD", "validation_error", 400);
  }

  const { data: draft, error } = await supabase
    .from("drafts")
    .insert({
      user_id: auth.userId,
      type,
      status: "DRAFT",
      content,
      topic: topic || null,
      applied_patterns: appliedPatterns || [],
      metadata: metadata || {},
    })
    .select()
    .single();

  if (error) {
    return apiError("Failed to create draft", "create_failed", 500);
  }

  return apiSuccess(draft, 201);
});
