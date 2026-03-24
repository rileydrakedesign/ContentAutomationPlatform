export const openApiSpec = {
  openapi: "3.1.0",
  info: {
    title: "Content Automation API",
    version: "1.0.0",
    description:
      "Programmatic access to your content automation platform — manage drafts, generate AI content, publish to X, read analytics, configure voice settings, and set content strategy.\n\n## Authentication\n\nAll endpoints require an API key passed via the `Authorization` header:\n\n```\nAuthorization: Bearer sk_live_...\n```\n\nCreate API keys in **Settings → API Keys**. Each key has scoped permissions — only endpoints matching the key's scopes will be accessible.\n\n## Rate Limiting\n\nRequests are rate-limited per API key using a sliding window (default: 60 requests/minute). Rate limit info is included in response headers:\n\n| Header | Description |\n|---|---|\n| `X-RateLimit-Limit` | Max requests per window |\n| `X-RateLimit-Remaining` | Requests remaining |\n| `X-RateLimit-Reset` | Unix timestamp when the window resets |\n\n## Error Format\n\nAll errors return a consistent JSON structure:\n\n```json\n{\n  \"error\": \"Human-readable message\",\n  \"code\": \"machine_readable_code\"\n}\n```\n\nCommon error codes: `unauthorized`, `forbidden`, `rate_limited`, `validation_error`, `not_found`, `internal_error`.",
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
  ],
  paths: {
    "/health": {
      get: {
        tags: ["Health"],
        summary: "Health check",
        description: "Returns API status. If a valid API key is provided, also returns key metadata. Useful for testing connectivity and authentication.",
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
                    key_prefix: { type: "string", example: "sk_live_abc1..." },
                    scopes: {
                      type: "array",
                      items: { type: "string" },
                      example: ["drafts:read", "drafts:write"],
                    },
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
                    type: "object",
                    description: "For X_POST: `{ text: string }`. For X_THREAD: `{ tweets: string[] }`",
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
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        responses: {
          "200": { content: { "application/json": { schema: { $ref: "#/components/schemas/Draft" } } }, description: "Draft found" },
          "404": { $ref: "#/components/responses/NotFound" },
        },
      },
      patch: {
        tags: ["Drafts"],
        summary: "Update a draft",
        description: "Update draft content, edited content, or status.",
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  status: { type: "string", enum: ["DRAFT", "SCHEDULED", "POSTED", "REJECTED"] },
                  content: { type: "object", description: "Replace the draft content" },
                  editedContent: { type: "object", description: "Store edited version separately" },
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
        summary: "Generate draft options",
        description: "Uses AI to generate multiple draft options from a topic. Applies your voice settings, extracted patterns, and voice examples automatically. Returns options in memory — nothing is saved to the database until you create a draft via `POST /drafts`.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["topic"],
                properties: {
                  topic: { type: "string", minLength: 3, description: "The topic to generate content about", example: "Why most developers underestimate testing" },
                  draftType: { type: "string", enum: ["X_POST", "X_THREAD"], default: "X_POST" },
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
                          type: { type: "string" },
                          content: { type: "object" },
                          topic: { type: "string" },
                          applied_patterns: { type: "array", items: { type: "string" } },
                          metadata: { type: "object" },
                        },
                      },
                    },
                    patterns_used: { type: "array", items: { type: "object" } },
                    topic: { type: "string" },
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/publish": {
      get: {
        tags: ["Publishing"],
        summary: "List scheduled posts",
        description: "Returns scheduled and published posts. Optionally filter by status.",
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
        description: "Publishes content to X immediately. Supports single posts and threads. Optionally links to an existing draft (updates its status to `POSTED`).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["contentType", "payload"],
                properties: {
                  contentType: { type: "string", enum: ["X_POST", "X_THREAD"] },
                  payload: {
                    type: "object",
                    description: "For X_POST: `{ text: \"...\" }`. For X_THREAD: `{ tweets: [\"...\", \"...\"] }`",
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
        },
      },
    },
    "/publish/schedule": {
      post: {
        tags: ["Publishing"],
        summary: "Schedule a post",
        description: "Schedules content for future publishing via QStash. The `scheduledFor` time must be in the future.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["contentType", "payload", "scheduledFor"],
                properties: {
                  contentType: { type: "string", enum: ["X_POST", "X_THREAD"] },
                  payload: { type: "object", description: "Post content (same format as publish/now)" },
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
                  },
                },
              },
            },
          },
          "400": { $ref: "#/components/responses/ValidationError" },
        },
      },
    },
    "/analytics": {
      get: {
        tags: ["Analytics"],
        summary: "Get analytics data",
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
    },
  },
} as const;
