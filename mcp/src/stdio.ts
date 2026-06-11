#!/usr/bin/env node
/**
 * stdio entrypoint for the Agents For X MCP server.
 *
 * Configured via environment variables:
 *   CONTENT_API_KEY  — an sk_live_... API key (Settings → API Keys)
 *   CONTENT_API_URL  — base URL of the deployment (default: https://app.agentsforx.com)
 *   MCP_DEBUG=1      — structured request logging to stderr
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server";
import { ApiClient, ApiError } from "./client";

async function main(): Promise<void> {
  const apiKey = process.env.CONTENT_API_KEY;
  const baseUrl = process.env.CONTENT_API_URL || "https://app.agentsforx.com";

  if (!apiKey) {
    console.error(
      "[agentsforx-mcp] Missing CONTENT_API_KEY. Generate one in Settings → API Keys and set it in your MCP config."
    );
    process.exit(1);
  }

  const server = buildServer({ apiKey, baseUrl });
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // stderr is safe for logs; stdout is reserved for the MCP protocol.
  console.error(`[agentsforx-mcp] connected (API: ${baseUrl})`);

  // Startup health ping: verifies reachability and that the key is valid.
  // Non-fatal — tools surface their own errors — but saves a confusing first
  // failed tool call. Never logs the key itself.
  void (async () => {
    try {
      const api = new ApiClient({ baseUrl, apiKey });
      const health = (await api.get("/api/v1/health")) as {
        authenticated?: boolean;
        key_prefix?: string;
        scopes?: string[];
      };
      if (health.authenticated) {
        console.error(
          `[agentsforx-mcp] API key OK (${health.key_prefix ?? "sk_live_..."}, scopes: ${(health.scopes ?? []).join(", ") || "none"})`
        );
      } else {
        console.error(
          "[agentsforx-mcp] WARNING: API reachable but the key did not authenticate — check CONTENT_API_KEY."
        );
      }
    } catch (e) {
      const detail = e instanceof ApiError ? `${e.status} ${e.code}: ${e.message}` : String(e);
      console.error(`[agentsforx-mcp] WARNING: startup health check failed (${detail})`);
    }
  })();
}

main().catch((err) => {
  console.error("[agentsforx-mcp] fatal:", err);
  process.exit(1);
});
