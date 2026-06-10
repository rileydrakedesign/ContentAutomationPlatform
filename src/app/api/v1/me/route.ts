import { withApiAuth, apiSuccess, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";

export const OPTIONS = apiOptions;

// GET /api/v1/me — Identity of the API key holder (X handle + granted scopes)
export const GET = withApiAuth([], async ({ auth }) => {
  const supabase = createAdminClient();

  const { data: conn } = await supabase
    .from("x_connections")
    .select("x_username, x_user_id, last_api_sync_at")
    .eq("user_id", auth.userId)
    .single();

  return apiSuccess({
    user_id: auth.userId,
    x_username: conn?.x_username ?? null,
    x_user_id: conn?.x_user_id ?? null,
    x_connected: !!conn?.x_user_id,
    last_api_sync_at: conn?.last_api_sync_at ?? null,
    scopes: auth.scopes,
    rate_limit: auth.rateLimit,
  });
});
