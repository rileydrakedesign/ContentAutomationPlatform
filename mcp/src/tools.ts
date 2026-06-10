/**
 * MCP tool layer for Agents For X.
 *
 * Pure registration — no transport assumptions. `registerTools(server, api)` is
 * reused by the stdio entrypoint today and can be reused by an HTTP/SSE server
 * later. Each tool maps to one v1 REST endpoint via the ApiClient.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ApiClient, ApiError } from "./client.js";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
};

function ok(data: unknown): ToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

/** Run an API call and surface a clean, model-readable error on failure. */
async function run(fn: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return ok(await fn());
  } catch (e) {
    if (e instanceof ApiError) {
      return {
        isError: true,
        content: [
          {
            type: "text",
            text: `API error (${e.status} ${e.code}): ${e.message}`,
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

export function registerTools(server: McpServer, api: ApiClient): void {
  // ── Identity & config ──────────────────────────────────────────
  server.registerTool(
    "whoami",
    {
      title: "Who am I",
      description:
        "Return the connected X handle, whether the X account is connected, and the scopes granted to this API key. Call this first to confirm the connection works.",
      inputSchema: {},
    },
    () => run(() => api.get("/api/v1/me"))
  );

  server.registerTool(
    "get_voice_settings",
    {
      title: "Get voice settings",
      description:
        "Read the user's voice configuration (tone/energy/stance dials, guardrails, AI model) and their voice examples for the given voice type. Use to understand how generation will sound before generating.",
      inputSchema: {
        voiceType: z
          .enum(["post", "reply"])
          .default("post")
          .describe("Which voice to read: 'post' or 'reply'."),
      },
    },
    ({ voiceType }) =>
      run(() => api.get("/api/v1/voice", { type: voiceType }))
  );

  server.registerTool(
    "get_strategy",
    {
      title: "Get content strategy",
      description:
        "Read the user's weekly content strategy (posts/threads/replies per week and pillar targets).",
      inputSchema: {},
    },
    () => run(() => api.get("/api/v1/strategy"))
  );

  // ── Generation (voice-applied) ─────────────────────────────────
  server.registerTool(
    "generate_post",
    {
      title: "Generate post drafts",
      description:
        "Generate post or thread options about a topic, written in the user's POST voice (their voice settings, examples, and inspiration are applied server-side). Returns draft options — it does NOT save or publish them. Review, then create_draft / publish_post / schedule_post.",
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
          .array(z.string())
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
        "Generate reply options to a specific tweet, written in the user's REPLY voice. Pass the target tweet's text (use get_tweet first if you only have a URL/ID). Returns options — does NOT publish. Review, then publish_reply with the chosen text and the tweet ID.",
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

  // ── Drafts ─────────────────────────────────────────────────────
  server.registerTool(
    "list_drafts",
    {
      title: "List drafts",
      description: "List saved drafts. Filter by status (DRAFT, SCHEDULED, POSTED).",
      inputSchema: {
        status: z.string().default("DRAFT").describe("DRAFT, SCHEDULED, or POSTED."),
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
      description: "Fetch a single draft by ID.",
      inputSchema: { id: z.string().describe("Draft ID.") },
    },
    ({ id }) => run(() => api.get(`/api/v1/drafts/${encodeURIComponent(id)}`))
  );

  server.registerTool(
    "create_draft",
    {
      title: "Create draft",
      description:
        "Save a draft for later. For a single post use content { text }. For a thread use content { tweets: [...] }.",
      inputSchema: {
        type: z.enum(["X_POST", "X_THREAD"]).default("X_POST"),
        content: z
          .record(z.any())
          .describe('Either { "text": "..." } or { "tweets": ["...", "..."] }.'),
        topic: z.string().optional(),
        metadata: z.record(z.any()).optional(),
      },
    },
    ({ type, content, topic, metadata }) =>
      run(() => api.post("/api/v1/drafts", { type, content, topic, metadata }))
  );

  server.registerTool(
    "update_draft",
    {
      title: "Update draft",
      description: "Update a draft's content, status, or metadata.",
      inputSchema: {
        id: z.string(),
        content: z.record(z.any()).optional(),
        status: z.string().optional(),
        metadata: z.record(z.any()).optional(),
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
      description: "Delete a draft by ID.",
      inputSchema: { id: z.string() },
    },
    ({ id }) => run(() => api.del(`/api/v1/drafts/${encodeURIComponent(id)}`))
  );

  // ── Publishing (consequential — posts to X immediately) ────────
  server.registerTool(
    "publish_post",
    {
      title: "Publish a post now",
      description:
        "Publish a single post to X immediately. This is irreversible and public — confirm the exact text with the user before calling. Optionally pass draftId to mark a draft as POSTED.",
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
        "Publish a thread (each item becomes one connected tweet) to X immediately. Irreversible and public — confirm with the user first.",
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
        "Publish a reply to a specific tweet immediately. Irreversible and public — confirm with the user first. inReplyToId is the ID of the tweet you are replying to.",
      inputSchema: {
        text: z.string().min(1).max(280),
        inReplyToId: z.string().describe("ID of the tweet being replied to."),
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
        "Schedule a post (pass text) or thread (pass tweets) for a future time. scheduledFor must be an ISO 8601 timestamp in the future. Requires a Pro plan.",
      inputSchema: {
        text: z.string().max(280).optional().describe("For a single post."),
        tweets: z
          .array(z.string().max(280))
          .optional()
          .describe("For a thread (2+ tweets)."),
        scheduledFor: z
          .string()
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
      description: "List queued/scheduled posts. Filter by status (scheduled, posted, failed, cancelled).",
      inputSchema: {
        status: z.string().optional(),
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
      description: "Cancel a scheduled post by ID (only works while it is still pending).",
      inputSchema: { id: z.string() },
    },
    ({ id }) => run(() => api.del(`/api/v1/queue/${encodeURIComponent(id)}`))
  );

  // ── Analysis ───────────────────────────────────────────────────
  server.registerTool(
    "get_analytics",
    {
      title: "Get analytics",
      description:
        "Read the user's post analytics. include='summary' for totals, 'posts' to include recent captured posts, 'all' to also include uploaded CSV post rows.",
      inputSchema: {
        include: z.enum(["summary", "posts", "all"]).default("summary"),
      },
    },
    ({ include }) => run(() => api.get("/api/v1/analytics", { include }))
  );

  server.registerTool(
    "get_tweet",
    {
      title: "Get a tweet",
      description:
        "Fetch a tweet's text and metrics by ID or full x.com URL. Use this to pull the post you want to reply to, then pass its text to generate_reply.",
      inputSchema: {
        idOrUrl: z.string().describe("Tweet ID or full x.com/twitter.com status URL."),
      },
    },
    ({ idOrUrl }) =>
      run(() => api.get(`/api/v1/tweets/${encodeURIComponent(idOrUrl)}`))
  );
}
