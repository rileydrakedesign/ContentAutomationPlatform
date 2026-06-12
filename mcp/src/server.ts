/**
 * Builds a configured McpServer. Transport is attached by the caller
 * (stdio entrypoint or the hosted streamable-HTTP endpoint).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "./client";
import { registerTools } from "./tools";

const INSTRUCTIONS = `Agents For X lets you draft, schedule, and publish X (Twitter) posts and replies in the user's own voice, read their analytics, and manage their patterns, inspiration, and strategy.

Voice — how to write content (in order of preference):
1. PREFERRED: call get_writing_context (voiceType "post" or "reply") and WRITE THE CONTENT YOURSELF following the returned system prompt, examples, patterns, and rules. You are the best available writer; this is free.
2. Fallback: generate_post / generate_reply run the platform's server-side model with the same voice context (3 credits) — use only if you cannot write directly.
Posts use the "post" voice; replies use the "reply" voice.

Credits: actions that cost real money (generation, publishing, tweet reads, search, sync) are metered in credits (1 credit = $0.01); each tool's description states its price, and metered results include the remaining balance. Posts containing a URL cost 30 credits instead of 3 — X bills link posts at ~13x. Use get_credits or whoami to check the balance; a 402 error means the user is out of credits.

Recommended workflow:
1. Call whoami once to confirm the X account is connected and check credits.
2. To create content, call get_writing_context, then write the post/reply yourself in the user's voice. (Server-side generate_post / generate_reply remain as a fallback.)
3. For a reply, if you only have a tweet URL/ID, call get_tweet first to fetch its text and reply in context.
4. Show the options to the user. Save with create_draft, or schedule with schedule_post. Log their reactions with send_feedback.
5. Publishing (publish_post / publish_thread / publish_reply) posts to X immediately and is irreversible and public — always confirm the exact final text with the user before calling a publish tool.
6. Use get_analytics, get_best_times, list_patterns, and get_strategy to inform what and when to post.`;

export const SERVER_VERSION = "1.0.0";

export function buildServer(opts: { baseUrl: string; apiKey: string }): McpServer {
  const server = new McpServer(
    { name: "agentsforx", version: SERVER_VERSION },
    { instructions: INSTRUCTIONS }
  );

  const api = new ApiClient({ baseUrl: opts.baseUrl, apiKey: opts.apiKey });
  registerTools(server, api);

  return server;
}
