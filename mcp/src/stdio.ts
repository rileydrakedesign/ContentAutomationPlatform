#!/usr/bin/env node
/**
 * stdio entrypoint for the Agents For X MCP server.
 *
 * Configured via environment variables:
 *   CONTENT_API_KEY  — an sk_live_... API key (Settings → API Keys)
 *   CONTENT_API_URL  — base URL of the deployment (default: https://app.agentsforx.com)
 */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildServer } from "./server.js";

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
}

main().catch((err) => {
  console.error("[agentsforx-mcp] fatal:", err);
  process.exit(1);
});
