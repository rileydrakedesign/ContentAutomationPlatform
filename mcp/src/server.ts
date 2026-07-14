/**
 * Builds a configured McpServer. Transport is attached by the caller
 * (stdio entrypoint or the hosted streamable-HTTP endpoint).
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ApiClient } from "./client";
import { registerTools } from "./tools";

const INSTRUCTIONS = `Agents For X is a real-time writing assistant for X (Twitter): it grounds every check in the user's niche, positioning, and top-performing posts, then keeps everything you write sounding like the user and reaching on the algorithm. The user is the author — you help keep their posts and replies on-voice and on-algorithm, and can also draft, schedule, and publish in their own voice, read their analytics, and manage their patterns and inspiration.

The core loop is get_writing_context → check_draft → find_reply_posts. Replying is where the growth is: find_reply_posts surfaces posts worth replying to, and you hand the reply to the user rather than publishing it.

Replies are NEVER published through this server. There is no reply-publish tool, and the underlying API returns 410 if you try. To reply: call find_reply_posts, write the reply, run check_draft on it, then append \`&text=<url-encoded reply>\` to that target's intent_url and give the user the link — X's own composer opens pre-filled and the user sends it. This is a deliberate constraint (X's rules on programmatic replies), not a gap to work around.

Voice — how to write content (in order of preference):
1. PREFERRED: call get_writing_context (voiceType "post" or "reply") and WRITE THE CONTENT YOURSELF following the returned system prompt — it includes the user's voice controls, niche positioning, proven high-engagement patterns, and real examples. You are the best available writer; this is free.
2. Fallback: generate_post / generate_reply run the platform's server-side model with the same voice context (3 credits) — use only if you cannot write directly.
Posts use the "post" voice; replies use the "reply" voice.

Tuning: after writing a draft, call check_draft (3 credits) to score it 0-100 against the user's tuned voice and proven patterns. It returns what matches, where the draft deviates, and a suggested edit — apply it or iterate before saving/publishing.

Freshness: whoami and get_writing_context include context_freshness. When retune_recommended is true (the user's analytics are newer than their tuned context), suggest run_tuneup (5 credits) — it refreshes voice examples, re-extracts patterns, re-analyzes niche & positioning, and returns the full Voice Report.

Credits: actions that cost real money (generation, voice checks, publishing, tweet reads, search, sync) are metered in credits (1 credit = $0.01); each tool's description states its price, and metered results include the remaining balance. Posts containing a URL cost 30 credits instead of 3 — X bills link posts at ~13x. Use get_credits or whoami to check the balance; a 402 error means the user is out of credits.

Recommended workflow:
1. Call whoami once to confirm the X account is connected and check credits.
2. To create content, call get_writing_context, then write the post/reply yourself in the user's voice. (Server-side generate_post / generate_reply remain as a fallback.)
3. Tune the draft: run check_draft and tighten it until it scores well against the user's voice and patterns.
4. To reply, call find_reply_posts for targets. If you only have a tweet URL/ID, call get_tweet first to fetch its text and reply in context. Deliver the finished reply as an intent_url handoff (see above) — never as a publish call.
5. Show the options to the user. Save with create_draft, or schedule with schedule_post. Log their reactions with send_feedback.
6. Publishing an original post (publish_post / publish_thread) posts to X immediately and is irreversible and public — always confirm the exact final text with the user first. There is no reply equivalent.
7. Use get_niche (positioning + pillars), get_analytics, get_best_times, and list_patterns to inform what and when to post. Run run_tuneup when the context is stale.`;

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
