import { NextRequest } from "next/server";
import { requireApiAuth, ApiKeyInfo } from "./auth";
import { checkRateLimit } from "./rate-limit";
import { apiSuccess, apiError, withRateLimitHeaders, apiOptions } from "./response";

export { apiOptions };

interface HandlerContext {
  auth: ApiKeyInfo;
  request: NextRequest;
  params?: Record<string, string>;
}

type RouteHandler = (ctx: HandlerContext) => Promise<Response>;

/**
 * Wraps a v1 API handler with auth, rate limiting, and error handling.
 */
export function withApiAuth(requiredScopes: string[], handler: RouteHandler) {
  return async (
    request: NextRequest,
    routeContext?: { params?: Promise<Record<string, string>> }
  ) => {
    // Auth
    const result = await requireApiAuth(request, requiredScopes);
    if (!result.ok) {
      return apiError(result.error, result.code, result.status);
    }

    // Rate limit
    const rl = await checkRateLimit(result.auth.keyId, result.auth.rateLimit);
    if (!rl.allowed) {
      return withRateLimitHeaders(
        apiError("Rate limit exceeded", "rate_limited", 429),
        rl.info
      );
    }

    try {
      const params = routeContext?.params ? await routeContext.params : undefined;
      const response = await handler({ auth: result.auth, request, params });
      // Add rate limit headers to success responses
      if (response instanceof Response) {
        return withRateLimitHeaders(response as any, rl.info);
      }
      return response;
    } catch (err) {
      console.error("v1 API error:", err);
      return withRateLimitHeaders(
        apiError("Internal server error", "internal_error", 500),
        rl.info
      );
    }
  };
}

// Re-export response helpers for convenience
export { apiSuccess, apiError };
