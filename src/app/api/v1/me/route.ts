import { withApiAuth, apiSuccess, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";
import { getValidAccessToken } from "@/lib/x-api";

export const OPTIONS = apiOptions;

// GET /api/v1/me — Identity of the API key holder (X handle + granted scopes)
export const GET = withApiAuth([], async ({ auth }) => {
  const supabase = createAdminClient();

  const { data: conn } = await supabase
    .from("x_connections")
    .select("x_username, x_user_id, last_api_sync_at")
    .eq("user_id", auth.userId)
    .single();

  // x_linked = a connection row exists; x_connected = the token actually works
  // right now (refreshes if needed). A stale token makes publishing fail, so
  // report real health rather than mere row existence.
  const xLinked = !!conn?.x_user_id;
  let xConnected = false;
  let xTokenError: string | null = null;
  if (xLinked) {
    try {
      await getValidAccessToken(supabase, auth.userId);
      xConnected = true;
    } catch (e) {
      xTokenError = e instanceof Error ? e.message : "token unavailable";
    }
  }

  return apiSuccess({
    user_id: auth.userId,
    x_username: conn?.x_username ?? null,
    x_user_id: conn?.x_user_id ?? null,
    x_linked: xLinked,
    x_connected: xConnected,
    x_token_error: xTokenError,
    needs_reconnect: xLinked && !xConnected,
    last_api_sync_at: conn?.last_api_sync_at ?? null,
    scopes: auth.scopes,
    rate_limit: auth.rateLimit,
  });
});
