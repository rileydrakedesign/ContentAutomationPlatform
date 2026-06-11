/**
 * Thin HTTP client for the Agents For X v1 REST API.
 *
 * Every MCP tool goes through this client — it is the single place that knows
 * about the API key, base URL, retries, and the standard `{ error, code }`
 * error shape. Keeping it transport-agnostic (no MCP imports here) is what
 * lets the same tool layer be served over stdio and streamable-HTTP.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  /** Actionable guidance appended to tool error output. */
  readonly hint?: string;
  constructor(status: number, code: string, message: string, hint?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.hint = hint;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Per-request timeout in ms. Prevents hanging on an unreachable host
   *  (Node's fetch otherwise waits ~300s). Default 30s. */
  timeoutMs?: number;
  /** Max attempts for idempotent requests (GET/DELETE). Default 3. */
  maxAttempts?: number;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export interface CreditsInfo {
  charged?: number;
  remaining?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function hintFor(status: number, code: string): string | undefined {
  switch (status) {
    case 401:
      return "The API key is invalid, revoked, or expired — check CONTENT_API_KEY (Settings → API Keys).";
    case 402:
      return "Out of credits. Top up in Settings → Billing or wait for the monthly reset.";
    case 403:
      return code === "plan_limit"
        ? "This feature requires a Pro plan."
        : "The API key lacks a required scope — create a key with the scopes this tool needs.";
    case 404:
      return "Not found — the ID may be wrong or the resource was deleted.";
    case 429:
      return code === "daily_cap"
        ? "Daily action cap reached for this plan — try again tomorrow or upgrade."
        : "Rate limited — wait for the window to reset before retrying.";
    default:
      return undefined;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxAttempts: number;
  private readonly debug: boolean;

  /** Credits info from the most recent response, if the endpoint is metered. */
  lastCredits: CreditsInfo = {};

  constructor({ baseUrl, apiKey, timeoutMs = 30_000, maxAttempts = 3 }: ApiClientOptions) {
    if (!apiKey) throw new Error("CONTENT_API_KEY is required");
    if (!baseUrl) throw new Error("CONTENT_API_URL is required");
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.maxAttempts = Math.max(1, maxAttempts);
    this.debug = process.env.MCP_DEBUG === "1";
  }

  private url(path: string, query?: Query): string {
    const u = new URL(this.baseUrl + path);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
      }
    }
    return u.toString();
  }

  private log(line: string): void {
    if (this.debug) {
      console.error(`[agentsforx-mcp] ${new Date().toISOString()} ${line}`);
    }
  }

  /** How long to wait before retrying a 429, capped at 30s. */
  private retryAfterMs(res: Response): number | null {
    const retryAfter = res.headers.get("retry-after");
    if (retryAfter && !isNaN(Number(retryAfter))) {
      return Math.min(30_000, Number(retryAfter) * 1000);
    }
    const reset = res.headers.get("x-ratelimit-reset");
    if (reset && !isNaN(Number(reset))) {
      const ms = Number(reset) * 1000 - Date.now();
      if (ms > 0 && ms <= 30_000) return ms;
      if (ms <= 0) return 1000;
      return null; // reset too far out — surface the 429 instead of hanging
    }
    return 2000;
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    opts: { query?: Query; body?: unknown } = {}
  ): Promise<T> {
    // Network errors and 5xx are retried only for idempotent methods. A POST
    // that times out may have gone through (the tweet may have posted) — a
    // blind retry would double-post, so we surface the ambiguity instead.
    // 429 is always retryable: the server explicitly did not process it.
    const idempotent = method === "GET" || method === "DELETE";
    let lastError: ApiError | null = null;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const started = Date.now();
      let res: Response;
      try {
        res = await fetch(this.url(path, opts.query), {
          method,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
          },
          body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (e) {
        const err = e as { name?: string };
        const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
        lastError = isTimeout
          ? new ApiError(
              504,
              "timeout",
              `Request to ${this.baseUrl} timed out after ${this.timeoutMs}ms.`,
              idempotent
                ? "Is the app running and is CONTENT_API_URL correct?"
                : "The request MAY have been processed (e.g. the post may have published). Check before retrying — a blind retry can double-post."
            )
          : new ApiError(
              503,
              "network_error",
              `Could not reach ${this.baseUrl}: ${(e as Error).message}.`,
              "Check CONTENT_API_URL and your network."
            );
        this.log(`${method} ${path} attempt ${attempt} failed: ${lastError.code}`);
        if (idempotent && attempt < this.maxAttempts) {
          await sleep(250 * 2 ** (attempt - 1) + Math.random() * 250);
          continue;
        }
        throw lastError;
      }

      const latency = Date.now() - started;
      this.log(
        `${method} ${path} -> ${res.status} (${latency}ms, req ${res.headers.get("x-request-id") ?? "-"}, attempt ${attempt})`
      );

      const charged = res.headers.get("x-credits-charged");
      const remaining = res.headers.get("x-credits-remaining");
      if (charged !== null || remaining !== null) {
        this.lastCredits = {
          charged: charged !== null ? Number(charged) : undefined,
          remaining: remaining !== null ? Number(remaining) : undefined,
        };
      } else {
        this.lastCredits = {};
      }

      // 429: wait out the window and retry (any method — nothing happened).
      if (res.status === 429 && attempt < this.maxAttempts) {
        const wait = this.retryAfterMs(res);
        if (wait !== null) {
          this.log(`rate limited; retrying in ${wait}ms`);
          await sleep(wait);
          continue;
        }
      }

      // Transient 5xx on idempotent requests: back off and retry.
      if (res.status >= 500 && idempotent && attempt < this.maxAttempts) {
        await sleep(250 * 2 ** (attempt - 1) + Math.random() * 250);
        continue;
      }

      const text = await res.text();
      let json: unknown = undefined;
      if (text) {
        try {
          json = JSON.parse(text);
        } catch {
          json = { raw: text };
        }
      }

      if (!res.ok) {
        const e = (json ?? {}) as { error?: string; code?: string };
        const code = e.code || "http_error";
        throw new ApiError(
          res.status,
          code,
          e.error || `Request failed with status ${res.status}`,
          hintFor(res.status, code)
        );
      }

      return json as T;
    }

    throw lastError ?? new ApiError(500, "internal_error", "Request failed");
  }

  get<T = unknown>(path: string, query?: Query): Promise<T> {
    return this.request<T>("GET", path, { query });
  }
  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("POST", path, { body });
  }
  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PATCH", path, { body });
  }
  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return this.request<T>("PUT", path, { body });
  }
  del<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
