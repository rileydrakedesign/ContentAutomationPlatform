/**
 * MCP tool layer for Agents For X.
 *
 * Pure registration — no transport assumptions. `registerTools(server, api)` is
 * reused by the stdio entrypoint and the hosted streamable-HTTP endpoint.
 * Each tool maps to one v1 REST endpoint via the ApiClient.
 *
 * Credits: metered tools state their price in the description. 1 credit =
 * $0.01. After a metered call the result includes a `credits` line so the
 * model can track the remaining balance.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient, ApiError } from "./client";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

const DRAFT_STATUSES = ["DRAFT", "SCHEDULED", "POSTED", "REJECTED"] as const;
const QUEUE_STATUSES = ["scheduled", "publishing", "posted", "failed", "cancelled"] as const;

// X_POST drafts carry { text }; X_THREAD drafts carry { tweets }. No 280-char
// cap here — drafts may run long while editing; publishing enforces limits.
const draftContentSchema = z.union([
  z.object({ text: z.string().min(1) }).describe("Single post content"),
  z.object({ tweets: z.array(z.string().min(1)).min(1) }).describe("Thread content"),
]);

export function registerTools(server: McpServer, api: ApiClient): void {
  /** Run an API call; surface clean errors and the credits trailer. */
  async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
    try {
      const data = await fn();
      const text = JSON.stringify(data, null, 2);
      const { charged, remaining } = api.lastCredits;
      const trailer =
        charged !== undefined || remaining !== undefined
          ? `\n\ncredits: charged ${charged ?? 0}, remaining ${remaining ?? "?"}`
          : "";
      return { content: [{ type: "text", text: text + trailer }] };
    } catch (e) {
      if (e instanceof ApiError) {
        const hint = e.hint ? `\nHint: ${e.hint}` : "";
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `API error (${e.status} ${e.code}): ${e.message}${hint}`,
            },
          ],
        };
      }
      return {
        isError: true,
        content: [{ type: "text", text: `Error: ${(e as Error).message}` }],
      };
    }
  }

  // ── Identity & config ──────────────────────────────────────────
  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description:
        "Return the connected X handle, whether the X account is connected, the scopes granted to this API key, the user's plan, and their credit balance. Call this first to confirm the connection works.",
      inputSchema: {},
    },
    () => run(() => api.get("/api/v1/me"))
  );

  server.registerTool(
    "health",
    {
      title: "Health check",
      description:
        "Ping the API. Confirms connectivity and (if the key is valid) returns key metadata. Free.",
      inputSchema: {},
    },
    () => run(() => api.get("/api/v1/health"))
  );

  server.registerTool(
    "get_credits",
    {
      title: "Get credit balance",
      description:
        "Return the user's plan and credit balances: total spendable, monthly allowance remaining (resets monthly), purchased pack balance (never expires while subscribed), and the reset date. Free.",
      inputSchema: {},
    },
    () =>
      run(async () => {
        const me = (await api.get("/api/v1/me")) as { plan?: string; credits?: unknown };
        return { plan: me.plan, credits: me.credits };
      })
  );

  server.registerTool(
    "get_voice_settings",
    {
      title: "Get voice settings",
      description:
        "Read the user's voice configuration (tone/energy/stance dials, guardrails, AI model) and their voice examples for the given voice type. Use to understand how generation will sound before generating. Free.",
      inputSchema: {
        voiceType: z
          .enum(["post", "reply"])
          .default("post")
          .describe("Which voice to read: 'post' or 'reply'."),
      },
    },
    ({ voiceType }) => run(() => api.get("/api/v1/voice", { type: voiceType }))
  );

  server.registerTool(
    "update_voice_settings",
    {
      title: "Update voice settings",
      description:
        "Update the user's voice configuration for a voice type. Only the fields you pass are changed. Confirm material voice changes with the user first. Free.",
      inputSchema: {
        voiceType: z.enum(["post", "reply"]).default("post"),
        optimization_authenticity: z.number().int().min(0).max(100).optional()
          .describe("0 = fully authentic, 100 = fully optimized for engagement."),
        tone_formal_casual: z.number().int().min(0).max(100).optional()
          .describe("0 = formal, 100 = casual."),
        energy_calm_punchy: z.number().int().min(0).max(100).optional()
          .describe("0 = calm, 100 = punchy."),
        stance_neutral_opinionated: z.number().int().min(0).max(100).optional()
          .describe("0 = neutral, 100 = opinionated."),
        ai_model: z.enum(["openai", "claude", "grok"]).optional()
          .describe("Which AI provider generates content in this voice."),
        special_notes: z.string().optional(),
        guardrails: z
          .object({
            avoid_words: z.array(z.string()).optional(),
            avoid_topics: z.array(z.string()).optional(),
            custom_rules: z.array(z.string()).optional(),
          })
          .optional(),
      },
    },
    ({ voiceType, ...fields }) =>
      run(() => api.patch("/api/v1/voice", { voice_type: voiceType, ...fields }))
  );

  server.registerTool(
    "get_strategy",
    {
      title: "Get content strategy",
      description:
        "Read the user's weekly content strategy (posts/threads/replies per week and pillar targets). Free.",
      inputSchema: {},
    },
    () => run(() => api.get("/api/v1/strategy"))
  );

  server.registerTool(
    "update_strategy",
    {
      title: "Update content strategy",
      description:
        "Set the user's weekly content strategy. This replaces the stored strategy — pass every field you want kept. Free.",
      inputSchema: {
        posts_per_week: z.number().int().min(0),
        threads_per_week: z.number().int().min(0),
        replies_per_week: z.number().int().min(0),
        pillar_targets: z
          .array(
            z.object({
              pillar: z.string().min(1),
              posts_per_week: z.number().int().min(0),
            })
          )
          .default([])
          .describe("Per-pillar weekly post targets."),
      },
    },
    (body) => run(() => api.put("/api/v1/strategy", body))
  );

  server.registerTool(
    "get_niche",
    {
      title: "Get niche profile",
      description:
        "Read the user's analyzed niche profile: summary, content pillars, and topic clusters. Returns null if not yet analyzed. Free.",
      inputSchema: {},
    },
    () => run(() => api.get("/api/v1/niche"))
  );

  // ── Generation (voice-applied) ─────────────────────────────────
  server.registerTool(
    "generate_post",
    {
      title: "Generate post drafts",
      description:
        "Generate post or thread options about a topic, written in the user's POST voice (their voice settings, examples, and inspiration are applied server-side). Returns draft options — it does NOT save or publish them. Review, then create_draft / publish_post / schedule_post. Costs 3 credits.",
      inputSchema: {
        topic: z.string().min(3).describe("What the post should be about."),
        draftType: z
          .enum(["X_POST", "X_THREAD"])
          .default("X_POST")
          .describe("Single post or a multi-tweet thread."),
        generateCount: z
          .number()
          .int()
          .min(1)
          .max(5)
          .default(3)
          .describe("How many options to generate (1-5)."),
        patternIds: z
          .array(z.string().min(1))
          .optional()
          .describe("Specific extracted_pattern IDs to apply (defaults to the user's top enabled patterns)."),
        inspiration: z
          .object({ text: z.string(), author: z.string() })
          .optional()
          .describe("An inspiration post to adapt the style from (not copy)."),
      },
    },
    ({ topic, draftType, generateCount, patternIds, inspiration }) =>
      run(() =>
        api.post("/api/v1/drafts/generate", {
          topic,
          draftType,
          voiceType: "post",
          generateCount,
          patternIds,
          inspirationPost: inspiration,
        })
      )
  );

  server.registerTool(
    "generate_reply",
    {
      title: "Generate reply drafts",
      description:
        "Generate reply options to a specific tweet, written in the user's REPLY voice. Pass the target tweet's text (use get_tweet first if you only have a URL/ID). Returns options — does NOT publish. Review, then publish_reply with the chosen text and the tweet ID. Costs 3 credits.",
      inputSchema: {
        replyToText: z
          .string()
          .min(1)
          .describe("The full text of the tweet being replied to."),
        replyToTweetId: z
          .string()
          .optional()
          .describe("The ID of the tweet being replied to (carried into draft metadata)."),
        replyToAuthor: z
          .string()
          .optional()
          .describe("The @handle of the tweet's author (without the @)."),
        angle: z
          .string()
          .optional()
          .describe("Optional angle or point you want the reply to make."),
        generateCount: z.number().int().min(1).max(5).default(3),
      },
    },
    ({ replyToText, replyToTweetId, replyToAuthor, angle, generateCount }) =>
      run(() =>
        api.post("/api/v1/drafts/generate", {
          voiceType: "reply",
          topic: angle,
          generateCount,
          replyTo: {
            text: replyToText,
            tweetId: replyToTweetId,
            author: replyToAuthor,
          },
        })
      )
  );

  server.registerTool(
    "send_feedback",
    {
      title: "Send generation feedback",
      description:
        "Log like/dislike feedback on a generated post or reply. Feeds the user's prompt assembly so future generations improve. Use after the user reacts to an option. Free.",
      inputSchema: {
        feedbackType: z.enum(["like", "dislike"]),
        generationType: z.enum(["post", "reply"]),
        contentText: z.string().min(1).describe("The generated text being rated."),
        contextPrompt: z.string().optional().describe("The topic/angle that produced it."),
      },
    },
    ({ feedbackType, generationType, contentText, contextPrompt }) =>
      run(() =>
        api.post("/api/v1/feedback", {
          feedback_type: feedbackType,
          generation_type: generationType,
          content_text: contentText,
          context_prompt: contextPrompt,
        })
      )
  );

  // ── Drafts ─────────────────────────────────────────────────────
  server.registerTool(
    "list_drafts",
    {
      title: "List drafts",
      description: "List saved drafts. Filter by status. Free.",
      inputSchema: {
        status: z.enum(DRAFT_STATUSES).default("DRAFT"),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      },
    },
    ({ status, limit, offset }) =>
      run(() => api.get("/api/v1/drafts", { status, limit, offset }))
  );

  server.registerTool(
    "get_draft",
    {
      title: "Get draft",
      description: "Fetch a single draft by ID. Free.",
      inputSchema: { id: z.string().min(1).describe("Draft ID.") },
    },
    ({ id }) => run(() => api.get(`/api/v1/drafts/${encodeURIComponent(id)}`))
  );

  server.registerTool(
    "create_draft",
    {
      title: "Create draft",
      description:
        "Save a draft for later. For a single post use content { text }. For a thread use content { tweets: [...] }. Free.",
      inputSchema: {
        type: z.enum(["X_POST", "X_THREAD"]).default("X_POST"),
        content: draftContentSchema,
        topic: z.string().optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      },
    },
    ({ type, content, topic, metadata }) =>
      run(() => api.post("/api/v1/drafts", { type, content, topic, metadata }))
  );

  server.registerTool(
    "update_draft",
    {
      title: "Update draft",
      description: "Update a draft's content, status, or metadata. Free.",
      inputSchema: {
        id: z.string().min(1),
        content: draftContentSchema.optional(),
        status: z.enum(DRAFT_STATUSES).optional(),
        metadata: z.record(z.string(), z.unknown()).optional(),
      },
    },
    ({ id, content, status, metadata }) =>
      run(() =>
        api.patch(`/api/v1/drafts/${encodeURIComponent(id)}`, {
          content,
          status,
          metadata,
        })
      )
  );

  server.registerTool(
    "delete_draft",
    {
      title: "Delete draft",
      description: "Delete a draft by ID. Free.",
      inputSchema: { id: z.string().min(1) },
    },
    ({ id }) => run(() => api.del(`/api/v1/drafts/${encodeURIComponent(id)}`))
  );

  // ── Publishing (consequential — posts to X immediately) ────────
  server.registerTool(
    "publish_post",
    {
      title: "Publish a post now",
      description:
        "Publish a single post to X immediately. This is irreversible and public — confirm the exact text with the user before calling. Optionally pass draftId to mark a draft as POSTED. Costs 3 credits — 30 if the text contains a URL (X bills link posts at ~13x).",
      inputSchema: {
        text: z.string().min(1).max(280),
        draftId: z.string().optional(),
      },
    },
    ({ text, draftId }) =>
      run(() =>
        api.post("/api/v1/publish/now", {
          contentType: "X_POST",
          payload: { text },
          draftId,
        })
      )
  );

  server.registerTool(
    "publish_thread",
    {
      title: "Publish a thread now",
      description:
        "Publish a thread (each item becomes one connected tweet) to X immediately. Irreversible and public — confirm with the user first. Costs 3 credits per tweet — 30 for any tweet containing a URL. On partial failure, un-posted tweets are refunded; do NOT retry the full thread, resume with the remaining tweets only.",
      inputSchema: {
        tweets: z.array(z.string().min(1).max(280)).min(2),
        draftId: z.string().optional(),
      },
    },
    ({ tweets, draftId }) =>
      run(() =>
        api.post("/api/v1/publish/now", {
          contentType: "X_THREAD",
          payload: { tweets },
          draftId,
        })
      )
  );

  server.registerTool(
    "publish_reply",
    {
      title: "Publish a reply now",
      description:
        "Publish a reply to a specific tweet immediately. Irreversible and public — confirm with the user first. inReplyToId is the ID of the tweet you are replying to. Costs 3 credits — 30 if the text contains a URL.",
      inputSchema: {
        text: z.string().min(1).max(280),
        inReplyToId: z.string().min(1).describe("ID of the tweet being replied to."),
        draftId: z.string().optional(),
      },
    },
    ({ text, inReplyToId, draftId }) =>
      run(() =>
        api.post("/api/v1/publish/now", {
          contentType: "X_REPLY",
          payload: { text, inReplyToId },
          draftId,
        })
      )
  );

  server.registerTool(
    "schedule_post",
    {
      title: "Schedule a post or thread",
      description:
        "Schedule a post (pass text) or thread (pass tweets) for a future time. scheduledFor must be an ISO 8601 timestamp in the future. Requires a Pro plan. Credits are debited at schedule time (3 per tweet, 30 per URL tweet) and refunded if cancelled.",
      inputSchema: {
        text: z.string().min(1).max(280).optional().describe("For a single post."),
        tweets: z
          .array(z.string().min(1).max(280))
          .min(1)
          .optional()
          .describe("For a thread (2+ tweets)."),
        scheduledFor: z
          .string()
          .min(1)
          .describe("ISO 8601 timestamp in the future, e.g. 2026-06-10T15:00:00Z."),
        draftId: z.string().optional(),
      },
    },
    ({ text, tweets, scheduledFor, draftId }) => {
      const isThread = Array.isArray(tweets) && tweets.length > 0;
      if (!isThread && !text) {
        return Promise.resolve({
          isError: true,
          content: [
            { type: "text" as const, text: "Provide either text (post) or tweets (thread)." },
          ],
        });
      }
      return run(() =>
        api.post("/api/v1/publish/schedule", {
          contentType: isThread ? "X_THREAD" : "X_POST",
          payload: isThread ? { tweets } : { text },
          scheduledFor,
          draftId,
        })
      );
    }
  );

  // ── Queue management ───────────────────────────────────────────
  server.registerTool(
    "list_queue",
    {
      title: "List scheduled posts",
      description: "List queued/scheduled posts. Filter by status. Free.",
      inputSchema: {
        status: z.enum(QUEUE_STATUSES).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      },
    },
    ({ status, limit, offset }) =>
      run(() => api.get("/api/v1/queue", { status, limit, offset }))
  );

  server.registerTool(
    "cancel_scheduled",
    {
      title: "Cancel a scheduled post",
      description:
        "Cancel a scheduled post by ID (only while still pending). The credits debited at schedule time are refunded.",
      inputSchema: { id: z.string().min(1) },
    },
    ({ id }) => run(() => api.del(`/api/v1/queue/${encodeURIComponent(id)}`))
  );

  server.registerTool(
    "list_published",
    {
      title: "List published & scheduled history",
      description:
        "List the user's scheduled-post history across all states (posted, failed, cancelled, pending). Free.",
      inputSchema: {
        status: z.enum(QUEUE_STATUSES).optional(),
        limit: z.number().int().min(1).max(100).default(50),
        offset: z.number().int().min(0).default(0),
      },
    },
    ({ status, limit, offset }) =>
      run(() => api.get("/api/v1/publish", { status, limit, offset }))
  );

  // ── Analysis ───────────────────────────────────────────────────
  server.registerTool(
    "get_analytics",
    {
      title: "Get analytics",
      description:
        "Read the user's post analytics. include='summary' for totals, 'posts' to include recent captured posts, 'all' to also include uploaded CSV post rows. Costs 1 credit.",
      inputSchema: {
        include: z.enum(["summary", "posts", "all"]).default("summary"),
      },
    },
    ({ include }) => run(() => api.get("/api/v1/analytics", { include }))
  );

  server.registerTool(
    "get_best_times",
    {
      title: "Get best posting days",
      description:
        "Day-of-week engagement breakdown from the user's analytics — which days their posts perform best. Costs 1 credit.",
      inputSchema: {},
    },
    () => run(() => api.get("/api/v1/analytics/best-times"))
  );

  server.registerTool(
    "sync_analytics",
    {
      title: "Sync timeline from X",
      description:
        "Pull the user's latest posts from X into their analytics (delta sync — only new posts are fetched). Use when captured posts look stale. Requires a Pro plan. Costs 15 credits.",
      inputSchema: {},
    },
    () => run(() => api.post("/api/v1/analytics/sync"))
  );

  server.registerTool(
    "get_tweet",
    {
      title: "Get a tweet",
      description:
        "Fetch a tweet's text and metrics by ID or full x.com URL. Use this to pull the post you want to reply to, then pass its text to generate_reply. Costs 1 credit.",
      inputSchema: {
        idOrUrl: z.string().min(1).describe("Tweet ID or full x.com/twitter.com status URL."),
      },
    },
    ({ idOrUrl }) =>
      run(() => api.get(`/api/v1/tweets/${encodeURIComponent(idOrUrl)}`))
  );

  server.registerTool(
    "search_tweets",
    {
      title: "Search recent tweets",
      description:
        "Search public tweets from the last 7 days (X search syntax, e.g. 'from:user', '\"exact phrase\"', 'topic -is:retweet'). Requires a Pro plan. Costs 1 credit per result returned (minimum 5) — keep maxResults low.",
      inputSchema: {
        query: z.string().min(1).describe("X search query."),
        maxResults: z.number().int().min(10).max(25).default(10),
      },
    },
    ({ query, maxResults }) =>
      run(() => api.get("/api/v1/search", { query, max_results: maxResults }))
  );

  // ── Patterns & inspiration ─────────────────────────────────────
  server.registerTool(
    "list_patterns",
    {
      title: "List growth patterns",
      description:
        "List patterns extracted from the user's top posts (hooks, formats, topics, engagement triggers) with engagement multipliers. Pass their IDs to generate_post to steer generation. Free.",
      inputSchema: {
        enabledOnly: z.boolean().default(false),
        type: z.string().optional().describe("Filter by pattern_type."),
        limit: z.number().int().min(1).max(500).default(200),
      },
    },
    ({ enabledOnly, type, limit }) =>
      run(() =>
        api.get("/api/v1/patterns", { enabled_only: enabledOnly, type, limit })
      )
  );

  server.registerTool(
    "toggle_pattern",
    {
      title: "Enable/disable a pattern",
      description:
        "Enable or disable an extracted pattern (disabled patterns are not applied during generation). Free.",
      inputSchema: {
        id: z.string().min(1),
        isEnabled: z.boolean(),
      },
    },
    ({ id, isEnabled }) =>
      run(() =>
        api.patch(`/api/v1/patterns/${encodeURIComponent(id)}`, {
          is_enabled: isEnabled,
        })
      )
  );

  server.registerTool(
    "list_inspiration",
    {
      title: "List inspiration posts",
      description:
        "List the user's saved inspiration posts with their voice/format analysis. Free.",
      inputSchema: {
        limit: z.number().int().min(1).max(500).default(100),
      },
    },
    ({ limit }) => run(() => api.get("/api/v1/inspiration", { limit }))
  );

  server.registerTool(
    "add_inspiration",
    {
      title: "Save an inspiration post",
      description:
        "Save a post the user wants to learn from. It is auto-analyzed (voice + format) in the background and then influences generation. Costs 3 credits.",
      inputSchema: {
        content: z.string().min(1).describe("The post text."),
        url: z.string().optional().describe("Source URL (deduplicated)."),
        authorHandle: z.string().optional(),
      },
    },
    ({ content, url, authorHandle }) =>
      run(() => api.post("/api/v1/inspiration", { content, url, authorHandle }))
  );
}
