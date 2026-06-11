import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ApiClient, ApiError } from "./client";

function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function makeClient(opts: Partial<ConstructorParameters<typeof ApiClient>[0]> = {}) {
  return new ApiClient({
    baseUrl: "https://api.test",
    apiKey: "sk_live_test",
    timeoutMs: 1000,
    ...opts,
  });
}

describe("ApiClient auth & success", () => {
  it("sends the bearer key and parses JSON", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { hello: "world" }));
    const client = makeClient();
    const result = await client.get("/api/v1/me");
    expect(result).toEqual({ hello: "world" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://api.test/api/v1/me");
    expect(init.headers.Authorization).toBe("Bearer sk_live_test");
  });

  it("captures credit headers into lastCredits", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(200, { ok: true }, {
        "X-Credits-Charged": "3",
        "X-Credits-Remaining": "97",
      })
    );
    const client = makeClient();
    await client.post("/api/v1/publish/now", {});
    expect(client.lastCredits).toEqual({ charged: 3, remaining: 97 });
  });

  it("clears lastCredits on unmetered responses", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(200, {}, { "X-Credits-Charged": "1", "X-Credits-Remaining": "9" })
      )
      .mockResolvedValueOnce(jsonResponse(200, {}));
    const client = makeClient();
    await client.get("/api/v1/analytics");
    await client.get("/api/v1/drafts");
    expect(client.lastCredits).toEqual({});
  });
});

describe("retries", () => {
  it("retries GET on 5xx and succeeds", async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(502, { error: "bad gateway" }))
      .mockResolvedValueOnce(jsonResponse(503, { error: "unavailable" }))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const client = makeClient();
    const result = await client.get("/api/v1/drafts");
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry POST on 5xx", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(502, { error: "X rejected the post", code: "x_api_error" })
    );
    const client = makeClient();
    await expect(client.post("/api/v1/publish/now", {})).rejects.toMatchObject({
      status: 502,
      code: "x_api_error",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does NOT retry POST on network error and flags the ambiguity", async () => {
    const timeoutErr = Object.assign(new Error("timed out"), { name: "TimeoutError" });
    fetchMock.mockRejectedValueOnce(timeoutErr);
    const client = makeClient();
    try {
      await client.post("/api/v1/publish/now", {});
      expect.unreachable("should have thrown");
    } catch (e) {
      const err = e as ApiError;
      expect(err.status).toBe(504);
      expect(err.hint).toMatch(/MAY have been processed/);
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries GET on network error", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("ECONNRESET"))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const client = makeClient();
    const result = await client.get("/api/v1/me");
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries 429 (any method) honoring Retry-After", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(429, { error: "rate limited", code: "rate_limited" }, { "Retry-After": "0" })
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const client = makeClient();
    const result = await client.post("/api/v1/drafts/generate", {});
    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after maxAttempts and surfaces the last error", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(429, { error: "rate limited", code: "rate_limited" }, { "Retry-After": "0" })
    );
    const client = makeClient({ maxAttempts: 2 });
    await expect(client.get("/api/v1/me")).rejects.toMatchObject({
      status: 429,
      code: "rate_limited",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("error mapping", () => {
  it.each([
    [401, "unauthorized", /CONTENT_API_KEY/],
    [402, "INSUFFICIENT_CREDITS", /credits/i],
    [403, "forbidden", /scope/],
    [403, "plan_limit", /Pro plan/],
    [404, "not_found", /ID may be wrong/],
  ])("attaches a hint for %s %s", async (status, code, hintPattern) => {
    fetchMock.mockResolvedValueOnce(jsonResponse(status, { error: "nope", code }));
    const client = makeClient();
    try {
      await client.post("/api/v1/anything", {});
      expect.unreachable("should have thrown");
    } catch (e) {
      const err = e as ApiError;
      expect(err.status).toBe(status);
      expect(err.code).toBe(code);
      expect(err.hint).toMatch(hintPattern);
    }
  });

  it("handles non-JSON error bodies", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("<html>502 Bad Gateway</html>", { status: 502 })
    );
    const client = makeClient();
    await expect(client.post("/api/v1/publish/now", {})).rejects.toMatchObject({
      status: 502,
      code: "http_error",
    });
  });
});
