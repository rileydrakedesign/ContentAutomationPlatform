/**
 * In-house LLM gateway.
 *
 * Every provider call funnels through `runThroughGateway`, which wraps it with
 * the four things a serverless app can't get from the SDK alone:
 *
 *  1. Admission gate — a global RPM bucket + a global token-per-minute bucket
 *     sized to a safe fraction of the Anthropic org budget. This sheds load
 *     *before* we hit the provider, so heavy users can't trip org-wide 429s that
 *     would degrade everyone. TPM is pre-charged with an estimate, then
 *     reconciled against actual usage after the call.
 *  2. Exponential backoff with full jitter on transient provider errors
 *     (429 / 529 overloaded / 5xx), honoring Retry-After when present. No
 *     provider failover — we stay on the chosen provider by design.
 *  3. A Redis-backed, per-provider circuit breaker shared across serverless
 *     instances, so a degraded provider gets a break instead of a retry storm.
 *  4. Token metering (see usage.ts).
 *
 * On admission denial it throws GatewayRateLimitedError (→ 429); on an open
 * breaker or exhausted retries against a failing provider, ProviderUnavailableError
 * (→ 503). v1-handler maps these centrally; in-app routes fall through to their
 * existing error handling (the edge guard already protects them).
 */

import * as Sentry from "@sentry/nextjs";
import { getRedisClient } from "@/lib/redis";
import { enforceRateLimits } from "@/lib/api/limiter";
import { globalClaudeTier, globalTpmTier } from "@/lib/api/limiter-config";
import type { RateLimitInfo } from "@/lib/api/response";
import { recordUsage, type TokenUsage } from "./usage";
import type { AIProvider, ChatMessage } from "./index";

export class GatewayRateLimitedError extends Error {
  constructor(public info: RateLimitInfo, public scope: string) {
    super("LLM gateway rate limit exceeded");
    this.name = "GatewayRateLimitedError";
  }
}

export class ProviderUnavailableError extends Error {
  constructor(public provider: AIProvider, public retryAfter: number) {
    super(`LLM provider ${provider} unavailable`);
    this.name = "ProviderUnavailableError";
  }
}

// ---------------------------------------------------------------------------
// Token estimation
// ---------------------------------------------------------------------------

/** Rough token estimate: ~4 chars/token for the prompt + the output budget. */
export function estimateChatTokens(messages: ChatMessage[], maxTokens: number): number {
  const promptChars = messages.reduce((sum, m) => sum + m.content.length, 0);
  return Math.ceil(promptChars / 4) + maxTokens;
}

// ---------------------------------------------------------------------------
// Per-provider circuit breaker (Redis-backed, shared across instances)
// ---------------------------------------------------------------------------

const BREAKER_THRESHOLD = Number(process.env.LLM_BREAKER_THRESHOLD) || 8;
const BREAKER_COOLDOWN_S = Number(process.env.LLM_BREAKER_COOLDOWN_S) || 30;
const FAIL_WINDOW_S = 60;

async function breakerIsOpen(provider: AIProvider): Promise<boolean> {
  const r = getRedisClient();
  if (!r) return false; // no Redis → skip breaker, rely on admission gate
  try {
    return (await r.get(`llm:breaker:${provider}:open`)) != null;
  } catch {
    return false;
  }
}

async function recordProviderSuccess(provider: AIProvider): Promise<void> {
  const r = getRedisClient();
  if (!r) return;
  try {
    await r.del(`llm:breaker:${provider}:fails`);
  } catch {
    /* best effort */
  }
}

async function recordProviderFailure(provider: AIProvider): Promise<void> {
  const r = getRedisClient();
  if (!r) return;
  try {
    const key = `llm:breaker:${provider}:fails`;
    const fails = await r.incr(key);
    if (fails === 1) await r.expire(key, FAIL_WINDOW_S);
    if (fails >= BREAKER_THRESHOLD) {
      await r.set(`llm:breaker:${provider}:open`, "1", { ex: BREAKER_COOLDOWN_S });
      await r.del(key);
      Sentry.captureMessage("llm_breaker_open", {
        level: "warning",
        tags: { component: "llm_gateway", provider },
        extra: { threshold: BREAKER_THRESHOLD, cooldownS: BREAKER_COOLDOWN_S },
      });
    }
  } catch {
    /* best effort */
  }
}

// ---------------------------------------------------------------------------
// Transient-error classification + backoff
// ---------------------------------------------------------------------------

interface ApiErrorish {
  status?: number;
  headers?: Record<string, string> | Headers;
  error?: { type?: string };
}

/** True for provider errors worth retrying: 429, 529 (overloaded), and 5xx. */
function isTransient(err: unknown): boolean {
  const e = err as ApiErrorish;
  const status = e?.status;
  if (status === 429 || status === 529) return true;
  if (typeof status === "number" && status >= 500) return true;
  if (e?.error?.type === "overloaded_error") return true;
  return false;
}

/** Seconds from a Retry-After header, if the provider sent one. */
function retryAfterSeconds(err: unknown): number | null {
  const h = (err as ApiErrorish)?.headers;
  if (!h) return null;
  const raw = h instanceof Headers ? h.get("retry-after") : h["retry-after"];
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const MAX_ATTEMPTS = Number(process.env.LLM_GATEWAY_MAX_ATTEMPTS) || 2;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 4000;

function backoffDelay(attempt: number, retryAfter: number | null): number {
  if (retryAfter != null) return Math.min(retryAfter * 1000, 10_000);
  const exp = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** attempt);
  return Math.floor(Math.random() * exp); // full jitter
}

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

// ---------------------------------------------------------------------------
// Admission gate
// ---------------------------------------------------------------------------

/**
 * Public admission check for callers that can't use runThroughGateway (e.g.
 * streaming). Throws GatewayRateLimitedError / ProviderUnavailableError just
 * like the wrapper. Pair with recordUsage() after the stream completes.
 */
export async function gatewayAdmit(provider: AIProvider, estimatedTokens: number): Promise<void> {
  await admit(provider, estimatedTokens);
  if (await breakerIsOpen(provider)) {
    throw new ProviderUnavailableError(provider, BREAKER_COOLDOWN_S);
  }
}

async function admit(provider: AIProvider, estimatedTokens: number): Promise<void> {
  // Only Claude has a shared-org budget worth gating here; other providers pass
  // through (failover is intentionally off, but the picker can select them).
  if (provider !== "claude") return;
  const res = await enforceRateLimits([globalClaudeTier(1), globalTpmTier(estimatedTokens)]);
  if (!res.allowed) {
    Sentry.addBreadcrumb({
      category: "llm_gateway",
      level: "warning",
      message: "admission_denied",
      data: { scope: res.failedScope },
    });
    throw new GatewayRateLimitedError(res.info, res.failedScope ?? "global");
  }
}

/** Charge the difference when actual tokens exceed the pre-charged estimate. */
async function reconcileTpm(provider: AIProvider, estimated: number, actual: number): Promise<void> {
  if (provider !== "claude") return;
  const delta = actual - estimated;
  if (delta <= 0) return; // over-estimate is fine; bucket already conservative
  try {
    await enforceRateLimits([globalTpmTier(delta)]);
  } catch {
    /* best effort — metering reconciliation must not fail the call */
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface GatewayCall<T> {
  provider: AIProvider;
  model: string;
  estimatedTokens: number;
  /** Executes the provider SDK call and returns the raw value + actual usage. */
  exec: () => Promise<{ value: T; usage: TokenUsage }>;
  meta?: { route?: string; userId?: string };
}

/**
 * Run a provider call through the gateway: admission → breaker → retries with
 * jitter → metering. Returns the raw value plus the actual token usage.
 */
export async function runThroughGateway<T>(call: GatewayCall<T>): Promise<{ value: T; usage: TokenUsage }> {
  const { provider, model, estimatedTokens, exec, meta } = call;

  await admit(provider, estimatedTokens);

  if (await breakerIsOpen(provider)) {
    throw new ProviderUnavailableError(provider, BREAKER_COOLDOWN_S);
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const { value, usage } = await exec();
      await recordProviderSuccess(provider);
      // Fire metering + reconciliation without blocking the response longer than
      // needed; both are best-effort and swallow their own errors.
      await Promise.allSettled([
        recordUsage({ provider, model, input: usage.input, output: usage.output, route: meta?.route, userId: meta?.userId }),
        reconcileTpm(provider, estimatedTokens, usage.input + usage.output),
      ]);
      return { value, usage };
    } catch (err) {
      lastErr = err;
      if (!isTransient(err)) throw err; // non-retryable (4xx, parse, etc.)
      await recordProviderFailure(provider);
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffDelay(attempt, retryAfterSeconds(err)));
        continue;
      }
    }
  }

  // Retries exhausted on a transient/overloaded provider.
  Sentry.captureException(lastErr, { tags: { component: "llm_gateway", provider }, extra: { exhausted: true } });
  throw new ProviderUnavailableError(provider, retryAfterSeconds(lastErr) ?? BREAKER_COOLDOWN_S);
}
