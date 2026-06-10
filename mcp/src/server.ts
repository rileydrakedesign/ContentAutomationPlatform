/**
 * Builds a configured McpServer. Transport is attached by the caller
 * (stdio entrypoint today; an HTTP handler can reuse this unchanged).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "./client.js";
import { registerTools } from "./tools.js";

const INSTRUCTIONS = `Agents For X lets you draft, schedule, and publish X (Twitter) posts and replies in the user's own voice, and read their analytics.

Voice: generation always runs through the user's saved voice settings, examples, and inspiration posts on the server — you do not need to supply a style. Posts use the "post" voice; replies use the "reply" voice.

Recommended workflow:
1. Call whoami once to confirm the X account is connected.
2. To create content, use generate_post (topic) or generate_reply (reply to a tweet). These return options only — they do not publish.
3. For a reply, if you only have a tweet URL/ID, call get_tweet first to fetch its text, then pass that to generate_reply.
4. Show the options to the user. Save with create_draft, or schedule with schedule_post.
5. Publishing (publish_post / publish_thread / publish_reply) posts to X immediately and is irreversible and public — always confirm the exact final text with the user before calling a publish tool.
6. Use get_analytics and get_strategy to inform what to post.`;

export function buildServer(opts: { baseUrl: string; apiKey: string }): McpServer {
  const server = new McpServer(
    { name: "agentsforx", version: "0.1.0" },
    { instructions: INSTRUCTIONS }
  );

  const api = new ApiClient({ baseUrl: opts.baseUrl, apiKey: opts.apiKey });
  registerTools(server, api);

  return server;
}
