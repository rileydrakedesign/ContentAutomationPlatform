/**
 * Thin HTTP client for the Agents For X v1 REST API.
 *
 * Every MCP tool goes through this client — it is the single place that knows
 * about the API key, base URL, and the standard `{ error, code }` error shape.
 * Keeping it transport-agnostic (no MCP imports here) is what lets the same
 * tool layer be served over stdio today and streamable-HTTP later.
 */

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export interface ApiClientOptions {
  baseUrl: string;
  apiKey: string;
  /** Per-request timeout in ms. Prevents hanging on an unreachable host
   *  (Node's fetch otherwise waits ~300s). Default 30s. */
  timeoutMs?: number;
}

type Query = Record<string, string | number | boolean | undefined | null>;

export class ApiClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor({ baseUrl, apiKey, timeoutMs = 30_000 }: ApiClientOptions) {
    if (!apiKey) throw new Error("CONTENT_API_KEY is required");
    if (!baseUrl) throw new Error("CONTENT_API_URL is required");
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
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

  private async request<T = unknown>(
    method: string,
    path: string,
    opts: { query?: Query; body?: unknown } = {}
  ): Promise<T> {
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
      if (err?.name === "TimeoutError" || err?.name === "AbortError") {
        throw new ApiError(
          504,
          "timeout",
          `Request to ${this.baseUrl} timed out after ${this.timeoutMs}ms. Is the app running and is CONTENT_API_URL correct?`
        );
      }
      throw new ApiError(
        503,
        "network_error",
        `Could not reach ${this.baseUrl}: ${(e as Error).message}. Check CONTENT_API_URL.`
      );
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
      throw new ApiError(
        res.status,
        e.code || "http_error",
        e.error || `Request failed with status ${res.status}`
      );
    }

    return json as T;
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
  del<T = unknown>(path: string): Promise<T> {
    return this.request<T>("DELETE", path);
  }
}
