export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Content Automation API",
    version: "1.0.0",
    description:
      "Programmatic access to your content automation platform — manage drafts, generate AI content, publish to X, read analytics, configure voice settings, and set content strategy.\n\n## Authentication\n\nAll endpoints require an API key passed via the `Authorization` header:\n\n```\nAuthorization: Bearer sk_live_...\n```\n\nCreate API keys in **Settings → API Keys**. Each key has scoped permissions — only endpoints matching the key's scopes will be accessible.\n\n## Rate Limiting\n\nRequests are rate-limited per API key using a sliding window (per-plan: 20–120 requests/minute). Rate limit info is included in response headers:\n\n| Header | Description |\n|---|---|\n| `X-RateLimit-Limit` | Max requests per window |\n| `X-RateLimit-Remaining` | Requests remaining |\n| `X-RateLimit-Reset` | Unix timestamp when the window resets |\n\n## Credits\n\nActions that incur real X API or AI costs are metered in credits (1 credit = $0.01). Each operation documents its price via the `x-credits` extension. Key prices: generation 3, publish 3 per tweet, publish containing a URL 30, tweet read 1, search 1/result (min 5), on-demand sync 15. Your monthly allowance resets on your billing anniversary; purchased credit packs are consumed after the allowance and never expire while subscribed.\n\nMetered responses include `X-Credits-Charged` and `X-Credits-Remaining` headers. When you run out you'll get **402** `INSUFFICIENT_CREDITS` with your balance and a top-up URL. Failed external calls are automatically refunded.\n\n## MCP (Model Context Protocol)\n\nEvery capability here is also available as MCP tools for AI agents:\n\n- **claude.ai connector / hosted (OAuth 2.1, no keys):** add `https://app.agentsforx.com/api/v1/mcp` as a custom connector — you'll be asked to log in and approve scopes. Also works with `claude mcp add --transport http agentsforx https://app.agentsforx.com/api/v1/mcp`.\n- **Local stdio (API key):** `npx -y @agentsforx/mcp` with `CONTENT_API_KEY` set.\n\nBoth transports enforce the same scopes, rate limits, and credit metering as this REST API.\n\n## Error Format\n\nAll errors return a consistent JSON structure:\n\n```json\n{\n  \"error\": \"Human-readable message\",\n  \"code\": \"machine_readable_code\"\n}\n```\n\nCommon error codes: `unauthorized`, `forbidden`, `rate_limited`, `daily_cap`, `INSUFFICIENT_CREDITS`, `validation_error`, `not_found`, `internal_error`.",
  },
  externalDocs: {
    description:
      "In-repo docs (getting started, MCP, architecture, guides) and the hosted MCP connector. The hosted MCP gateway lives at POST/GET/DELETE /api/v1/mcp (OAuth 2.1, streamable HTTP) — it is not an API-key REST endpoint, so it is described here rather than as a REST path. See docs/mcp/overview.md.",
    url: "https://app.agentsforx.com/api/v1/mcp",
  },
  servers: [
    {
      url: "/api/v1",
      description: "v1 API",
    },
  ],
  security: [{ bearerAuth: [] }],
  tags: [
    { name: "Health", description: "Connectivity and auth testing" },
    { name: "Drafts", description: "Create, read, update, and delete content drafts" },
    { name: "Generation", description: "AI-powered content generation" },
    { name: "Publishing", description: "Publish and schedule posts to X" },
    { name: "Analytics", description: "Read engagement and performance data" },
    { name: "Voice", description: "Configure voice settings and examples" },
    { name: "Strategy", description: "Manage content strategy and weekly targets" },
    { name: "Patterns", description: "Extracted proven patterns" },
    { name: "Inspiration", description: "Saved inspiration posts" },
    { name: "Niche", description: "Niche profile" },
    { name: "Search", description: "Search recent tweets on X" },
    { name: "Account", description: "Identity, credits, and feedback" },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns API status. If a valid API key is provided, also returns key metadata (granted scopes and the key's per-minute rate limit). Useful for testing connectivity and authentication.",
        security: [],
        responses: {
          "200": {
            description: "API is healthy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string", example: "ok" },
                    version: { type: "string", example: "1.0.0" },
                    authenticated: { type: "boolean" },
                    scopes: {
                      type: "array",
                      items: { type: "string" },
                      description: "Present only when authenticated.",
                      example: ["drafts:read", "drafts:write"],
                    },
                    rate_limit: { type: "integer", description: "Per-minute request limit for this key. Present only when authenticated.", example: 60 },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/drafts": {
      get: {
        tags: ["Drafts"],
        summary: "List drafts",
        "x-required-scopes": ["drafts:read"],
        description: "Returns a paginated list of drafts for the authenticated user.",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["DRAFT", "SCHEDULED", "POSTED", "REJECTED"], default: "DRAFT" },
            description: "Filter by draft status",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          },
          {
            name: "offset",
            in: "query",
            schema: { type: "integer", minimum: 0, default: 0 },
          },
        ],
        responses: {
          "200": {
            description: "List of drafts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: { type: "array", items: { $ref: "#/components/schemas/Draft" } },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                  },
                },
              },
            },
          },
          "401": { $ref: "#/components/responses/Unauthorized" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
      post: {
        tags: ["Drafts"],
        summary: "Create a draft",
        "x-required-scopes": ["drafts:write"],
        description: "Creates a new draft. The draft is saved with status `DRAFT` and can be edited, published, or scheduled later.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["type", "content"],
                properties: {
                  type: { type: "string", enum: ["X_POST", "X_THREAD"], description: "Content type" },
                  content: {
                    description: "Single post: `{ text: string }`. Thread: `{ tweets: string[] }`. Shape must match `type`.",
                    oneOf: [
                      { type: "object", required: ["text"], properties: { text: { type: "string" } }, description: "X_POST content" },
                      { type: "object", required: ["tweets"], properties: { tweets: { type: "array", items: { type: "string" } } }, description: "X_THREAD content" },
                    ],
                    example: { text: "My new post content" },
                  },
                  topic: { type: "string", description: "Optional topic tag" },
                  appliedPatterns: { type: "array", items: { type: "string" }, description: "Pattern IDs applied" },
                  metadata: { type: "object", description: "Arbitrary metadata" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Draft created",
            content: { "application/json": { schema: { $ref: "#/components/schemas/Draft" } } },
          },
          "400": { $ref: "#/components/responses/ValidationError" },
          "401": { $ref: "#/components/responses/Unauthorized" },
        },
      },
    },
    "/drafts/{id}": {
      get: {
        tags: ["Drafts"],
        summary: "Get a draft",
        "x-required-scopes": ["drafts:read"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { content: { "application/json": { schema: { $ref: "#/components/schemas/Draft" } } }, description: "Draft found" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Drafts"],
        summary: "Update a draft",
        "x-required-scopes": ["drafts:write"],
        description: "Update draft content, edited content, or status. Only the fields you send are changed.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["DRAFT", "SCHEDULED", "POSTED", "REJECTED"] },
                  content: { type: "object", description: "Replace the draft content. X_POST: `{ text }`, X_THREAD: `{ tweets[] }`." },
                  editedContent: { type: "object", description: "Store an edited version separately (same shapes as content)." },
                },
              },
            },
          },
        },
        responses: {
          "200": { content: { "application/json": { schema: { $ref: "#/components/schemas/Draft" } } }, description: "Draft updated" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      delete: {
        tags: ["Drafts"],
        summary: "Delete a draft",
        "x-required-scopes": ["drafts:write"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": {
            description: "Draft deleted",
            content: { "application/json": { schema: { type: "object", properties: { deleted: { type: "boolean" } } } } },
          },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
    },
    "/drafts/generate": {
      post: {
        tags: ["Generation"],
        summary: "Generate draft (or reply) options",
        "x-credits": 3,
        "x-required-scopes": ["drafts:generate"],
        description: "Uses AI to generate multiple draft options in the user's voice. For posts (`voiceType: post`), pass `topic`. For replies (`voiceType: reply`), pass `replyTo` (the target tweet) — `topic` then acts as an optional angle. Applies the user's voice settings, extracted patterns, and voice examples automatically. Returns options in memory — nothing is saved until you create a draft via `POST /drafts`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                description: "Posts require `topic` (≥3 chars). Replies require `replyTo.text`.",
                properties: {
                  voiceType: { type: "string", enum: ["post", "reply"], default: "post", description: "`post` generates original posts/threads; `reply` generates replies to `replyTo`." },
                  topic: { type: "string", minLength: 3, description: "For posts: the subject (required, ≥3 chars). For replies: an optional angle/point.", example: "Why most developers underestimate testing" },
                  draftType: { type: "string", enum: ["X_POST", "X_THREAD"], default: "X_POST", description: "Applies to posts only; replies are always single posts." },
                  generateCount: { type: "integer", minimum: 1, maximum: 5, default: 3, description: "Number of options to generate" },
                  patternIds: { type: "array", items: { type: "string" }, description: "Specific pattern IDs to apply. If empty, uses top 3 enabled patterns." },
                  inspirationPost: {
                    type: "object",
                    properties: {
                      text: { type: "string" },
                      author: { type: "string" },
                    },
                    description: "Optional post to use as style inspiration",
                  },
                  replyTo: {
                    type: "object",
                    required: ["text"],
                    description: "Required when `voiceType` is `reply` — the tweet being replied to.",
                    properties: {
                      text: { type: "string", description: "Full text of the target tweet." },
                      tweetId: { type: "string", description: "ID of the target tweet (carried into option metadata)." },
                      author: { type: "string", description: "Target author @handle (without @)." },
                    },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Generated options",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    options: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          type: { type: "string", description: "X_POST or X_THREAD (replies are X_POST)." },
                          content: { type: "object", description: "X_POST: `{ text }`, X_THREAD: `{ tweets[] }`." },
                          topic: { type: "string", nullable: true },
                          applied_patterns: { type: "array", items: { type: "string" } },
                          metadata: { type: "object", description: "Includes `voice_type`, `hook_type`, `generation_type`, and (for replies) `is_reply`/`reply_to`." },
                        },
                      },
                    },
                    patterns_used: { type: "array", items: { type: "object" } },
                    topic: { type: "string", nullable: true },
                    voice_type: { type: "string", enum: ["post", "reply"] },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/ValidationError" },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/publish": {
      get: {
        tags: ["Publishing"],
        summary: "List scheduled posts",
        "x-required-scopes": ["publish:read"],
        description: "Returns scheduled and published posts as a bare array, ordered by scheduled time. Optionally filter by status.",
        parameters: [
          {
            name: "status",
            in: "query",
            schema: { type: "string", enum: ["scheduled", "publishing", "posted", "failed", "cancelled"] },
            description: "Filter by publish status",
          },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1, maximum: 100, default: 50 },
          },
        ],
        responses: {
          "200": {
            description: "List of scheduled posts",
            content: {
              "application/json": {
                schema: {
                  type: "array",
                  items: { $ref: "#/components/schemas/ScheduledPost" },
                },
              },
            },
          },
        },
      },
    },
    "/publish/now": {
      post: {
        tags: ["Publishing"],
        summary: "Publish immediately",
        "x-credits": "3 per tweet; 30 if the tweet contains a URL",
        "x-required-scopes": ["publish:write"],
        description: "Publishes content to X immediately. Supports single posts (`X_POST`), threads (`X_THREAD`), and replies (`X_REPLY`). Optionally links to an existing draft (updates its status to `POSTED`).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["contentType", "payload"],
                properties: {
                  contentType: { type: "string", enum: ["X_POST", "X_THREAD", "X_REPLY"] },
                  payload: {
                    type: "object",
                    description: "X_POST: `{ text }`. X_THREAD: `{ tweets: [...] }`. X_REPLY: `{ text, inReplyToId }` (the tweet being replied to).",
                    properties: {
                      text: { type: "string", description: "Required for X_POST and X_REPLY." },
                      tweets: { type: "array", items: { type: "string" }, description: "Required for X_THREAD." },
                      inReplyToId: { type: "string", description: "Required for X_REPLY — the ID of the tweet being replied to." },
                    },
                    example: { text: "Hello world from the API!" },
                  },
                  draftId: { type: "string", format: "uuid", description: "Optional draft to mark as POSTED" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Published successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    posted: { type: "boolean" },
                    postedIds: { type: "array", items: { type: "string" }, description: "X post IDs" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/ValidationError" },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
          "429": { $ref: "#/components/responses/RateLimited" },
          "502": { description: "X rejected the post/thread. For threads, a partial-failure body includes `postedIds`, `failedAtIndex`, and `remainingTweets` — do not retry the full thread." },
        },
      },
    },
    "/publish/schedule": {
      post: {
        tags: ["Publishing"],
        summary: "Schedule a post",
        "x-credits": "3 per tweet; 30 if the tweet contains a URL (debited at schedule time, refunded on cancel)",
        "x-required-scopes": ["publish:write"],
        description: "Schedules content for future publishing via QStash (Pro plan required). The `scheduledFor` time must be in the future.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["contentType", "payload", "scheduledFor"],
                properties: {
                  contentType: { type: "string", enum: ["X_POST", "X_THREAD"] },
                  payload: {
                    type: "object",
                    description: "X_POST: `{ text }`. X_THREAD: `{ tweets: [...] }` (the alias `{ thread: [...] }` is also accepted).",
                    properties: {
                      text: { type: "string", description: "For X_POST." },
                      tweets: { type: "array", items: { type: "string" }, description: "For X_THREAD." },
                      thread: { type: "array", items: { type: "string" }, description: "Accepted alias for `tweets` on X_THREAD." },
                    },
                  },
                  scheduledFor: { type: "string", format: "date-time", description: "ISO 8601 datetime", example: "2026-03-25T14:00:00Z" },
                  draftId: { type: "string", format: "uuid", description: "Optional draft to mark as SCHEDULED" },
                },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Post scheduled",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    id: { type: "string", format: "uuid" },
                    scheduledFor: { type: "string", format: "date-time" },
                    deliveryConfirmed: { type: "boolean", description: "True if QStash accepted exact-time delivery; if false, the publish-scheduled sweep will deliver it." },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/ValidationError" },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
          "403": { description: "Scheduling requires a Pro plan" },
          "429": { $ref: "#/components/responses/RateLimited" },
        },
      },
    },
    "/analytics": {
      get: {
        tags: ["Analytics"],
        summary: "Get analytics data",
        "x-credits": 1,
        "x-required-scopes": ["analytics:read"],
        description: "Returns analytics data from CSV uploads and captured posts. Use the `include` parameter to control response detail level.",
        parameters: [
          {
            name: "include",
            in: "query",
            schema: { type: "string", enum: ["summary", "posts", "all"], default: "summary" },
            description: "`summary` = counts only, `posts` = includes captured posts, `all` = includes CSV post data too",
          },
        ],
        responses: {
          "200": {
            description: "Analytics data",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    csv_analytics: {
                      type: "object",
                      nullable: true,
                      properties: {
                        total_posts: { type: "integer" },
                        total_replies: { type: "integer" },
                        date_range: { type: "object" },
                        uploaded_at: { type: "string", format: "date-time" },
                        csv_filename: { type: "string" },
                      },
                    },
                    captured_posts_count: { type: "integer" },
                    captured_posts: { type: "array", items: { type: "object" }, description: "Included when include=posts or include=all" },
                    csv_posts: { type: "array", items: { type: "object" }, description: "Included when include=all" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/voice": {
      get: {
        tags: ["Voice"],
        summary: "Get voice settings",
        "x-required-scopes": ["voice:read"],
        description: "Returns voice configuration and top voice examples for the specified type. Voice settings control how AI generates content in your style.",
        parameters: [
          {
            name: "type",
            in: "query",
            schema: { type: "string", enum: ["post", "reply"], default: "post" },
            description: "Voice type — separate settings for posts vs replies",
          },
        ],
        responses: {
          "200": {
            description: "Voice settings and examples",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    settings: { $ref: "#/components/schemas/VoiceSettings" },
                    examples: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string" },
                          content_text: { type: "string" },
                          content_type: { type: "string" },
                          source: { type: "string" },
                          is_excluded: { type: "boolean" },
                          pinned_rank: { type: "integer", nullable: true },
                          engagement_score: { type: "number" },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      patch: {
        tags: ["Voice"],
        summary: "Update voice settings",
        "x-required-scopes": ["voice:write"],
        description: "Partially update voice settings. Only include fields you want to change. Dial values must be 0-100.",
        requestBody: {
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/VoiceSettingsUpdate" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated settings",
            content: { "application/json": { schema: { $ref: "#/components/schemas/VoiceSettings" } } },
          },
          "400": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/strategy": {
      get: {
        tags: ["Strategy"],
        summary: "Get content strategy",
        "x-required-scopes": ["strategy:read"],
        description: "Returns the user's content strategy with weekly posting targets and pillar breakdown. Returns defaults if no strategy has been set.",
        responses: {
          "200": {
            description: "Content strategy",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    strategy: { $ref: "#/components/schemas/ContentStrategy" },
                  },
                },
              },
            },
          },
        },
      },
      put: {
        tags: ["Strategy"],
        summary: "Update content strategy",
        "x-required-scopes": ["strategy:write"],
        description: "Upserts the content strategy. All numeric values are floored to integers and clamped to >= 0.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ContentStrategy" },
            },
          },
        },
        responses: {
          "200": {
            description: "Strategy updated",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    strategy: { $ref: "#/components/schemas/ContentStrategy" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/me": {
      get: {
        tags: ["Account"],
        summary: "Identity, plan & credits",
        "x-required-scopes": [],
        description: "Returns the API key holder's identity (X connection health, scopes, rate limit) plus their plan and credit balances. Requires any valid key — no specific scope. `credits.balance` is total spendable; `allowance_remaining` resets monthly, `pack_balance` never expires while subscribed.",
        responses: {
          "200": {
            description: "Identity, plan, and credits",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    user_id: { type: "string", format: "uuid" },
                    x_username: { type: "string", nullable: true },
                    x_user_id: { type: "string", nullable: true },
                    x_linked: { type: "boolean", description: "An X connection row exists." },
                    x_connected: { type: "boolean", description: "The X token actually works right now." },
                    x_token_error: { type: "string", nullable: true },
                    needs_reconnect: { type: "boolean" },
                    last_api_sync_at: { type: "string", format: "date-time", nullable: true },
                    scopes: { type: "array", items: { type: "string" } },
                    rate_limit: { type: "integer", description: "Per-minute request limit for this key." },
                    plan: { type: "string", example: "pro" },
                    credits: {
                      type: "object",
                      properties: {
                        balance: { type: "integer", description: "Total spendable (allowance + packs)." },
                        allowance_remaining: { type: "integer", description: "Monthly allowance left; resets on the billing anniversary." },
                        pack_balance: { type: "integer", description: "Purchased pack credits; never expire while subscribed." },
                        monthly_allowance: { type: "integer" },
                        resets_at: { type: "string", format: "date-time", nullable: true },
                      },
                    },
                    context_freshness: { type: "object", description: "Tuned-context freshness vs latest analytics; `retune_recommended: true` suggests running the tune-up." },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/queue": {
      get: {
        tags: ["Publishing"],
        summary: "List the publishing queue",
        "x-required-scopes": ["publish:read"],
        description: "Returns scheduled posts (paginated). Each item includes its source `draft_id`.",
        parameters: [
          { name: "status", in: "query", schema: { type: "string", enum: ["scheduled", "publishing", "posted", "failed", "cancelled"] } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } },
          { name: "offset", in: "query", schema: { type: "integer", minimum: 0, default: 0 } },
        ],
        responses: {
          "200": {
            description: "Scheduled posts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    items: { type: "array", items: { $ref: "#/components/schemas/QueueItem" } },
                    total: { type: "integer" },
                    limit: { type: "integer" },
                    offset: { type: "integer" },
                  },
                },
              },
            },
          },
        },
      },
    },
    "/queue/{id}": {
      delete: {
        tags: ["Publishing"],
        summary: "Cancel a scheduled post",
        "x-required-scopes": ["publish:write"],
        description: "Cancels a post that is still in `scheduled` state and refunds the credits debited when it was scheduled. Returns `{ id, status: \"cancelled\" }`.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { description: "Cancelled (credits refunded)" },
          "404": { description: "Not found" },
          "409": { description: "No longer cancellable" },
        },
      },
    },
    "/tweets/{id}": {
      get: {
        tags: ["Analytics"],
        summary: "Fetch a tweet",
        description: "Fetches a single tweet's text and metrics. `id` may be a raw tweet ID or an x.com status URL. Useful as reply context for generation.",
        "x-credits": 1,
        "x-required-scopes": ["analytics:read"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" }, description: "Tweet ID or x.com URL" }],
        responses: {
          "200": { description: "Tweet text + metrics" },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
        },
      },
    },
    "/patterns": {
      get: {
        tags: ["Patterns"],
        summary: "List extracted patterns",
        "x-required-scopes": ["patterns:read"],
        description: "Proven patterns extracted from your top posts (returned under `patterns`). Use pattern IDs with `/drafts/generate` to steer generation.",
        parameters: [
          { name: "type", in: "query", schema: { type: "string" }, description: "Filter by pattern_type" },
          { name: "enabled_only", in: "query", schema: { type: "boolean", default: false } },
          { name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 200 } },
        ],
        responses: { "200": { description: "Patterns ordered by engagement multiplier" } },
      },
    },
    "/patterns/{id}": {
      patch: {
        tags: ["Patterns"],
        summary: "Enable/disable or rename a pattern",
        "x-required-scopes": ["patterns:write"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          required: true,
          content: { "application/json": { schema: { type: "object", properties: { is_enabled: { type: "boolean" }, pattern_name: { type: "string" } } } } },
        },
        responses: { "200": { description: "Updated pattern" }, "404": { description: "Not found" } },
      },
    },
    "/inspiration": {
      get: {
        tags: ["Inspiration"],
        summary: "List inspiration posts",
        "x-required-scopes": ["inspiration:read"],
        parameters: [{ name: "limit", in: "query", schema: { type: "integer", minimum: 1, maximum: 500, default: 100 } }],
        responses: { "200": { description: "Saved inspiration posts with analysis, under `inspiration`" } },
      },
      post: {
        tags: ["Inspiration"],
        summary: "Save an inspiration post",
        description: "Saves a post and auto-analyzes its voice/format in the background (poll the list for `analysis_status: completed`).",
        "x-credits": 3,
        "x-required-scopes": ["inspiration:write"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["content"],
                properties: {
                  content: { type: "string" },
                  url: { type: "string", description: "Source URL (deduplicated)" },
                  authorHandle: { type: "string" },
                  metrics: { type: "object" },
                  post_timestamp: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
        responses: {
          "201": { description: "Saved (analysis pending)" },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
          "409": { description: "Already saved (duplicate URL)" },
        },
      },
    },
    "/inspiration/{id}": {
      delete: {
        tags: ["Inspiration"],
        summary: "Delete an inspiration post",
        "x-required-scopes": ["inspiration:write"],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: { "200": { description: "Deleted" }, "404": { description: "Not found" } },
      },
    },
    "/voice/context": {
      get: {
        tags: ["Voice"],
        summary: "Get writing context (for self-generating agents)",
        "x-required-scopes": ["voice:read"],
        description: "The user's full writing context — assembled voice system prompt (dials, guardrails, niche & positioning, PROVEN PATTERNS, real writing examples, inspiration), platform rules, and context_freshness — for agents that write content themselves instead of calling /drafts/generate. Free: the caller's model pays the inference. The separate `patterns` array is DEPRECATED (patterns now live in the system_prompt PROVEN PATTERNS section); it is kept one release for compatibility and flagged via `patterns_deprecated: true`.",
        parameters: [
          { name: "type", in: "query", schema: { type: "string", enum: ["post", "reply"], default: "post" } },
        ],
        responses: {
          "200": { description: "{ voice_type, system_prompt, patterns (deprecated), patterns_deprecated, context_freshness, rules }" },
        },
      },
    },
    "/insights/tuneup": {
      post: {
        tags: ["Voice"],
        summary: "Run a Voice Tune-Up",
        "x-required-scopes": ["voice:write"],
        description:
          "Runs the full analyze loop — refresh voice examples → extract proven patterns (Pro; skipped gracefully otherwise) → analyze niche & positioning — over the user's complete post pool, then returns the Voice Report: niche, positioning, top patterns, top posts, cadence vs strategy, recurring voice-check deviations with settings suggestions, feedback themes, inspiration alignment, and context freshness.",
        "x-credits": 5,
        responses: {
          "200": { description: "{ report }" },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
          "422": { description: "Not enough posts to analyze (credits refunded)" },
        },
      },
    },
    "/voice/check": {
      post: {
        tags: ["Voice"],
        summary: "Voice-check a draft (the tuner)",
        description:
          "Score a draft against the user's tuned voice — assembled voice prompt, niche positioning, and proven patterns. Returns a 0-100 match score, what the draft gets right, where it deviates, and a suggested edit. Scoped `voice:read`: it reads/scores and never mutates voice configuration; the credit charge is for the model call, independent of scope.",
        "x-credits": 3,
        "x-required-scopes": ["voice:read"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["text"],
                properties: {
                  text: { type: "string", minLength: 5, description: "The draft text to check" },
                  voice_type: { type: "string", enum: ["post", "reply"], default: "post" },
                },
              },
            },
          },
        },
        responses: {
          "200": { description: "{ voice_type, score, matches, deviations, suggested_edit }" },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
        },
      },
    },
    "/niche": {
      get: {
        tags: ["Niche"],
        summary: "Get niche profile",
        "x-required-scopes": ["niche:read"],
        description: "The user's analyzed niche under `profile`: summary, content pillars, topic clusters, and positioning (target audience, unique angle, positioning statement). `profile` is null if not yet analyzed.",
        responses: { "200": { description: "Niche profile or null" } },
      },
    },
    "/analytics/best-times": {
      get: {
        tags: ["Analytics"],
        summary: "Best posting days",
        description: "Day-of-week engagement breakdown computed from uploaded CSV analytics. Returns `{ days, bestDay, totalPostsAnalyzed, hasEnoughData }`.",
        "x-credits": 1,
        "x-required-scopes": ["analytics:read"],
        responses: {
          "200": { description: "Per-day stats + best day" },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
        },
      },
    },
    "/analytics/sync": {
      post: {
        tags: ["Analytics"],
        summary: "Sync timeline from X",
        description: "On-demand sync of your own X timeline into captured posts. Delta-based (since_id) — only new posts are fetched. Pro plan required.",
        "x-credits": 15,
        "x-required-scopes": ["analytics:read"],
        responses: {
          "200": { description: "{ synced, fetched, since_id }" },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
          "403": { description: "Pro plan required" },
        },
      },
    },
    "/search": {
      get: {
        tags: ["Search"],
        summary: "Search recent tweets",
        description: "Search public tweets from the last 7 days. Charged per result returned (min 5 credits). Pro plan required.",
        "x-credits": "1 per result (min 5)",
        "x-required-scopes": ["search:read"],
        parameters: [
          { name: "query", in: "query", required: true, schema: { type: "string" }, description: "X search query syntax" },
          { name: "max_results", in: "query", schema: { type: "integer", minimum: 10, maximum: 25, default: 10 } },
        ],
        responses: {
          "200": { description: "Matching tweets with author info and reply-eligibility fields (reply_allowed, reply_eligibility, reply_settings, is_auth_mentioned)" },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
          "403": { description: "Pro plan required" },
        },
      },
    },
    "/search/reply-targets": {
      get: {
        tags: ["Search"],
        summary: "Find posts to reply to",
        description: "Search recent tweets and return only posts the authenticated account can reply to (reply_allowed === true). Charged per post X returns (min 5 credits) — restricted posts that get filtered out still count toward cost. Optional sort=traction ranks the repliable subset by momentum. Pro plan required.",
        "x-credits": "1 per post returned by X (min 5)",
        "x-required-scopes": ["search:read"],
        parameters: [
          { name: "query", in: "query", required: true, schema: { type: "string" }, description: "X search query syntax" },
          { name: "max_results", in: "query", schema: { type: "integer", minimum: 10, maximum: 25, default: 10 } },
          { name: "sort", in: "query", schema: { type: "string", enum: ["relevance", "traction"], default: "relevance" }, description: "'traction' ranks repliable posts by engagement decayed by post age" },
        ],
        responses: {
          "200": {
            description: "Repliable tweets plus transparency counts",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    tweets: { type: "array", items: { type: "object" }, description: "Only posts where reply_allowed === true, each with author + reply-eligibility fields." },
                    query: { type: "string" },
                    sort: { type: "string", enum: ["relevance", "traction"] },
                    returned_count: { type: "integer", description: "How many posts X returned (what you were charged for)." },
                    repliable_count: { type: "integer", description: "How many of those you can reply to (length of `tweets`)." },
                  },
                },
              },
            },
          },
          "402": { $ref: "#/components/responses/InsufficientCredits" },
          "403": { description: "Pro plan required" },
        },
      },
    },
    "/feedback": {
      post: {
        tags: ["Account"],
        summary: "Submit generation feedback",
        "x-required-scopes": ["drafts:write"],
        description: "Log like/dislike feedback on generated content; feeds future prompt assembly. Returns `{ id, created_at }`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["feedback_type", "generation_type", "content_text"],
                properties: {
                  feedback_type: { type: "string", enum: ["like", "dislike"] },
                  generation_type: { type: "string", enum: ["post", "reply"] },
                  content_text: { type: "string" },
                  context_prompt: { type: "string" },
                  metadata: { type: "object" },
                },
              },
            },
          },
        },
        responses: { "201": { description: "Feedback recorded" } },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key from Settings → API Keys. Format: `sk_live_...`",
      },
    },
    schemas: {
      Draft: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          user_id: { type: "string", format: "uuid" },
          type: { type: "string", enum: ["X_POST", "X_THREAD"] },
          status: { type: "string", enum: ["DRAFT", "SCHEDULED", "POSTED", "REJECTED"] },
          content: { type: "object", description: "X_POST: `{ text }`, X_THREAD: `{ tweets[] }`" },
          edited_content: { type: "object", nullable: true },
          topic: { type: "string", nullable: true },
          applied_patterns: { type: "array", items: { type: "string" } },
          metadata: { type: "object" },
          created_at: { type: "string", format: "date-time" },
          updated_at: { type: "string", format: "date-time" },
        },
      },
      ScheduledPost: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          content_type: { type: "string", enum: ["X_POST", "X_THREAD"] },
          scheduled_for: { type: "string", format: "date-time" },
          status: { type: "string", enum: ["scheduled", "publishing", "posted", "failed", "cancelled"] },
          posted_post_ids: { type: "array", items: { type: "string" }, nullable: true },
          error: { type: "string", nullable: true },
          payload: { type: "object" },
          created_at: { type: "string", format: "date-time" },
        },
      },
      QueueItem: {
        description: "A scheduled post as returned by `GET /queue` — a ScheduledPost plus its source `draft_id`.",
        allOf: [
          { $ref: "#/components/schemas/ScheduledPost" },
          {
            type: "object",
            properties: {
              draft_id: { type: "string", format: "uuid", nullable: true, description: "The draft this was scheduled from, if any." },
            },
          },
        ],
      },
      VoiceSettings: {
        type: "object",
        properties: {
          voice_type: { type: "string", enum: ["post", "reply"] },
          length_mode: { type: "string", enum: ["short", "medium"] },
          directness_mode: { type: "string", enum: ["soft", "neutral", "blunt"] },
          humor_mode: { type: "string", enum: ["off", "light"] },
          emoji_mode: { type: "string", enum: ["off", "on"] },
          question_rate: { type: "string", enum: ["low", "medium"] },
          disagreement_mode: { type: "string", enum: ["avoid", "allow_nuance"] },
          optimization_authenticity: { type: "integer", minimum: 0, maximum: 100, description: "0 = authentic, 100 = optimized" },
          tone_formal_casual: { type: "integer", minimum: 0, maximum: 100, description: "0 = formal, 100 = casual" },
          energy_calm_punchy: { type: "integer", minimum: 0, maximum: 100, description: "0 = calm, 100 = punchy" },
          stance_neutral_opinionated: { type: "integer", minimum: 0, maximum: 100, description: "0 = neutral, 100 = opinionated" },
          guardrails: {
            type: "object",
            properties: {
              avoid_words: { type: "array", items: { type: "string" } },
              avoid_topics: { type: "array", items: { type: "string" } },
              custom_rules: { type: "array", items: { type: "string" } },
            },
          },
          special_notes: { type: "string", nullable: true },
          ai_model: { type: "string", enum: ["openai", "claude", "grok"] },
          use_niche_context: { type: "boolean" },
          max_example_tokens: { type: "integer", minimum: 0 },
          max_inspiration_tokens: { type: "integer", minimum: 0 },
          auto_refresh_enabled: { type: "boolean" },
          refresh_day_of_week: { type: "integer", minimum: 0, maximum: 6 },
        },
      },
      VoiceSettingsUpdate: {
        type: "object",
        properties: {
          voice_type: { type: "string", enum: ["post", "reply"], default: "post" },
          length_mode: { type: "string", enum: ["short", "medium"] },
          directness_mode: { type: "string", enum: ["soft", "neutral", "blunt"] },
          humor_mode: { type: "string", enum: ["off", "light"] },
          emoji_mode: { type: "string", enum: ["off", "on"] },
          question_rate: { type: "string", enum: ["low", "medium"] },
          disagreement_mode: { type: "string", enum: ["avoid", "allow_nuance"] },
          optimization_authenticity: { type: "integer", minimum: 0, maximum: 100 },
          tone_formal_casual: { type: "integer", minimum: 0, maximum: 100 },
          energy_calm_punchy: { type: "integer", minimum: 0, maximum: 100 },
          stance_neutral_opinionated: { type: "integer", minimum: 0, maximum: 100 },
          guardrails: { type: "object" },
          special_notes: { type: "string" },
          ai_model: { type: "string", enum: ["openai", "claude", "grok"] },
          use_niche_context: { type: "boolean" },
          max_example_tokens: { type: "integer", minimum: 0, description: "Token budget for voice examples in the assembled prompt." },
          max_inspiration_tokens: { type: "integer", minimum: 0, description: "Token budget for inspiration in the assembled prompt." },
          auto_refresh_enabled: { type: "boolean", description: "Whether voice examples auto-refresh on a weekly cadence." },
          refresh_day_of_week: { type: "integer", minimum: 0, maximum: 6, description: "0=Sunday … 6=Saturday; the day auto-refresh runs." },
        },
      },
      ContentStrategy: {
        type: "object",
        properties: {
          posts_per_week: { type: "integer", minimum: 0, default: 5 },
          threads_per_week: { type: "integer", minimum: 0, default: 1 },
          replies_per_week: { type: "integer", minimum: 0, default: 10 },
          pillar_targets: {
            type: "array",
            items: {
              type: "object",
              properties: {
                pillar: { type: "string", example: "AI/ML" },
                posts_per_week: { type: "integer", minimum: 0 },
              },
            },
          },
        },
      },
    },
    responses: {
      Unauthorized: {
        description: "Missing or invalid API key",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string", example: "Invalid or missing API key" },
                code: { type: "string", example: "unauthorized" },
              },
            },
          },
        },
      },
      Forbidden: {
        description: "API key lacks required scopes",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string", example: "Missing required scopes: drafts:write" },
                code: { type: "string", example: "forbidden" },
              },
            },
          },
        },
      },
      NotFound: {
        description: "Resource not found",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string", example: "Draft not found" },
                code: { type: "string", example: "not_found" },
              },
            },
          },
        },
      },
      ValidationError: {
        description: "Invalid request body",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string" },
                code: { type: "string", example: "validation_error" },
              },
            },
          },
        },
      },
      RateLimited: {
        description: "Rate limit exceeded",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string", example: "Rate limit exceeded" },
                code: { type: "string", example: "rate_limited" },
              },
            },
          },
        },
      },
      InsufficientCredits: {
        description: "Not enough credits — top up or wait for the monthly reset",
        content: {
          "application/json": {
            schema: {
              type: "object",
              properties: {
                error: { type: "string", example: "Insufficient credits" },
                code: { type: "string", example: "INSUFFICIENT_CREDITS" },
                balance: { type: "integer", example: 2 },
                required: { type: "integer", example: 30 },
                topup_url: { type: "string", example: "/settings?tab=billing" },
              },
            },
          },
        },
      },
    },
  },
} as const;
