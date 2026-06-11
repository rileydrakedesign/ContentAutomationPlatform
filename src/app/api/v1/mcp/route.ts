/**
 * Hosted MCP endpoint (streamable HTTP) — the same 32 tools as the
 * @agentsforx/mcp stdio package, served from the app itself so claude.ai,
 * Claude Code (`--transport http`), and other remote MCP clients can connect
 * without a local install.
 *
 * Auth is the same Bearer sk_live_... API key as the REST API. Every tool
 * call proxies to the v1 REST endpoints, so scopes, rate limits, and credit
 * metering apply identically to both transports.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import type { AuthInfo } from "@modelcontextprotocol/sdk/server/auth/types.js";
import { createMcpHandler, withMcpAuth } from "mcp-handler";
import { validateRawApiKey } from "@/lib/api/auth";
import { registerTools } from "../../../../../mcp/src/tools";
import { ApiClient, type CreditsInfo } from "../../../../../mcp/src/client";

export const runtime = "nodejs";
export const maxDuration = 60;

const BASE_URL =
  process.env.CONTENT_API_SELF_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  "https://app.agentsforx.com";

// The tool layer binds one ApiClient at registration time, but each HTTP
// request carries its own API key — bridge with AsyncLocalStorage: the outer
// wrapper stores a per-request client, and this proxy delegates to it.
const als = new AsyncLocalStorage<ApiClient>();

function makeAlsProxy(): ApiClient {
  const proxy = {
    lastCredits: {} as CreditsInfo,
    async _run<T>(fn: (c: ApiClient) => Promise<T>): Promise<T> {
      const client = als.getStore();
      if (!client) {
        throw new Error("No request context — MCP tool called outside a request");
      }
      try {
        return await fn(client);
      } finally {
        proxy.lastCredits = client.lastCredits;
      }
    },
    get: (path: string, query?: Record<string, unknown>) =>
      proxy._run((c) => c.get(path, query as never)),
    post: (path: string, body?: unknown) => proxy._run((c) => c.post(path, body)),
    patch: (path: string, body?: unknown) => proxy._run((c) => c.patch(path, body)),
    put: (path: string, body?: unknown) => proxy._run((c) => c.put(path, body)),
    del: (path: string) => proxy._run((c) => c.del(path)),
  };
  return proxy as unknown as ApiClient;
}

// The app and mcp/ each install their own @modelcontextprotocol/sdk, so the
// McpServer types are nominally distinct while structurally identical. The
// cast is safe: registerTools only calls server.registerTool(name, cfg, cb).
type RegisterToolsServer = Parameters<typeof registerTools>[0];

const handler = createMcpHandler(
  (server) => registerTools(server as unknown as RegisterToolsServer, makeAlsProxy()),
  {
    serverInfo: { name: "agentsforx", version: "1.0.0" },
    capabilities: { tools: {} },
  },
  {
    basePath: "/api/v1",
    maxDuration: 60,
  }
);

const verifyToken = async (
  _req: Request,
  bearerToken?: string
): Promise<AuthInfo | undefined> => {
  if (!bearerToken) return undefined;
  const key = await validateRawApiKey(bearerToken);
  if (!key) return undefined;
  return {
    token: bearerToken,
    scopes: key.scopes,
    clientId: key.keyId,
    extra: { userId: key.userId },
  };
};

const authHandler = withMcpAuth(handler, verifyToken, { required: true });

// Outer wrapper: stash a per-request ApiClient (keyed by this request's
// bearer token) in ALS so the shared tool layer talks to the v1 API as the
// caller. Invalid/missing keys are rejected by withMcpAuth before any tool
// runs — the placeholder client never gets used.
function withRequestClient(req: Request): Promise<Response> {
  const authz = req.headers.get("authorization") ?? "";
  const token = authz.startsWith("Bearer ") ? authz.slice(7) : "sk_invalid";
  const client = new ApiClient({ baseUrl: BASE_URL, apiKey: token || "sk_invalid" });
  return als.run(client, () => authHandler(req));
}

export {
  withRequestClient as GET,
  withRequestClient as POST,
  withRequestClient as DELETE,
};
