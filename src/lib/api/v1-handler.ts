import { NextRequest, NextResponse } from "next/server";
import { requireApiAuth, ApiKeyInfo } from "./auth";
import { checkRateLimit } from "./rate-limit";
import { enforceRateLimits } from "./limiter";
import { globalClaudeTier } from "./limiter-config";
import { apiSuccess, apiError, withRateLimitHeaders, rateLimited, apiOptions } from "./response";
import { GatewayRateLimitedError, ProviderUnavailableError } from "@/lib/ai/gateway";

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

    // Rate limit — per-key first (unchanged 429 semantics for API customers).
    const rl = await checkRateLimit(result.auth.keyId, result.auth.rateLimit);
    if (!rl.allowed) {
      return withRateLimitHeaders(
        apiError("Rate limit exceeded", "rate_limited", 429),
        rl.info
      );
    }

    // Then the per-user aggregate (bounds multi-key fanout) + global tenant-fair
    // tier (protects the shared provider account). Generous user limit so a
    // single key still works fully; the global tier is the real backstop.
    const extra = await enforceRateLimits([
      {
        scope: "user",
        key: result.auth.userId,
        algorithm: "slidingWindow",
        limit: Math.max(result.auth.rateLimit * 2, result.auth.rateLimit + 1),
        window: "1 m",
        prefix: "api_v1_user",
      },
      globalClaudeTier(1),
    ]);
    if (!extra.allowed) {
      return rateLimited(extra.info, extra.failedScope ?? undefined);
    }

    try {
      const params = routeContext?.params ? await routeContext.params : undefined;
      const response = await handler({ auth: result.auth, request, params });
      // Add rate limit headers to success responses
      if (response instanceof Response) {
        return withRateLimitHeaders(response as NextResponse, rl.info);
      }
      return response;
    } catch (err) {
      // Map the LLM gateway's typed errors so clients get actionable 429/503s
      // with Retry-After instead of an opaque 500.
      if (err instanceof GatewayRateLimitedError) {
        return rateLimited(err.info, err.scope);
      }
      if (err instanceof ProviderUnavailableError) {
        const response = apiError(
          "AI provider temporarily unavailable. Please retry.",
          "provider_unavailable",
          503,
          { retry_after: err.retryAfter }
        );
        response.headers.set("Retry-After", String(err.retryAfter));
        return withRateLimitHeaders(response, rl.info);
      }
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
