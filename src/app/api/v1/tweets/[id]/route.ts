import { withApiAuth, apiSuccess, apiError, apiOptions } from "@/lib/api/v1-handler";
import { createAdminClient } from "@/lib/supabase/server";
import { getValidAccessToken, getTweet, extractTweetId } from "@/lib/x-api";

export const OPTIONS = apiOptions;

// GET /api/v1/tweets/:id — Fetch a single tweet's text + metrics.
// `id` may be a raw tweet ID or a full x.com/twitter.com status URL.
// Useful for pulling the post being replied to as context for reply generation.
export const GET = withApiAuth(["analytics:read"], async ({ auth, params }) => {
  const raw = params?.id ? decodeURIComponent(params.id) : "";
  const tweetId = /^\d+$/.test(raw) ? raw : extractTweetId(raw);

  if (!tweetId) {
    return apiError("Invalid tweet id or URL", "validation_error", 400);
  }

  const supabase = createAdminClient();

  let accessToken: string;
  try {
    ({ accessToken } = await getValidAccessToken(auth.userId));
  } catch {
    return apiError("X account not connected", "x_not_connected", 400);
  }

  try {
    const tweet = await getTweet(accessToken, tweetId);
    return apiSuccess({
      id: tweet.id,
      text: tweet.text,
      created_at: tweet.created_at ?? null,
      metrics: tweet.public_metrics ?? null,
    });
  } catch (e) {
    return apiError(
      e instanceof Error ? e.message : "Failed to fetch tweet",
      "x_api_error",
      502
    );
  }
});
