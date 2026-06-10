export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

/**
 * fetch wrapper for client components: checks res.ok, redirects to /login on
 * 401, and throws a typed ApiError (with the server's `error` message when
 * present) instead of letting callers silently ignore failures.
 */
export async function apiFetch<T = unknown>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  const res = await fetch(input, init);

  if (res.status === 401) {
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new ApiError(401, "Not signed in");
  }

  if (!res.ok) {
    let body: unknown = null;
    let message = `Request failed (${res.status})`;
    try {
      body = await res.json();
      const serverMessage = (body as { error?: string })?.error;
      if (serverMessage) message = serverMessage;
    } catch {
      // Non-JSON error body — keep the generic message
    }
    throw new ApiError(res.status, message, body);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
