# Public API & MCP Server — Build Plan

## Overview
Build a public API (v1) and MCP server so users' AI agents can programmatically interact with the content automation platform. The API reuses existing internal logic with a new auth layer (API keys), rate limiting, and versioned REST endpoints.

---

## Phase 1: API Key Infrastructure — COMPLETE

> Implemented: `api_keys` table + migration, `src/lib/api/auth.ts` (key gen/validation/scopes), `src/lib/api/rate-limit.ts` (Upstash sliding window), `src/lib/api/response.ts` (standard responses). Deps: `@upstash/ratelimit`, `@upstash/redis`.

### 1.1 — `api_keys` Table (Supabase Migration)
- Columns: `id` (UUID PK), `user_id` (FK auth.users), `key_prefix` (TEXT, first 8 chars for identification), `key_hash` (TEXT, SHA-256 of full key), `name` (TEXT, user-provided label), `scopes` (TEXT[], e.g. `['drafts:read','publish:write']`), `rate_limit` (INTEGER, requests/min, default 60), `last_used_at` (TIMESTAMPTZ), `expires_at` (TIMESTAMPTZ, nullable), `revoked_at` (TIMESTAMPTZ, nullable), `created_at`, `updated_at`
- RLS: user can only see/manage their own keys
- Index on `key_hash` for fast lookup

### 1.2 — Key Generation & Management
- `POST /api/settings/api-keys` — generate new key (return raw key ONCE, store hash)
- `GET /api/settings/api-keys` — list keys (prefix, name, scopes, last_used, created)
- `DELETE /api/settings/api-keys/[id]` — revoke key (soft delete via `revoked_at`)
- UI: new "API Keys" section in Settings page

### 1.3 — API Key Auth Middleware
- File: `src/lib/api/auth.ts`
- Validates `Authorization: Bearer sk_live_...` header
- Hashes incoming key, looks up in `api_keys` table
- Rejects revoked/expired keys
- Returns `{ userId, scopes, rateLimit }` on success
- Helper: `requireApiAuth(req, requiredScopes: string[])`

### 1.4 — Rate Limiting
- Use Upstash Redis (`@upstash/ratelimit`) — already have Upstash via QStash
- Sliding window per API key (default 60 req/min)
- Return `429 Too Many Requests` with `Retry-After` header
- Rate limit info in response headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`

---

## Phase 2: v1 REST API Endpoints

All under `/api/v1/`. Auth via API key. JSON request/response. Standard error format: `{ error: string, code: string }`.

### Available Scopes
| Scope | Description |
|-------|-------------|
| `drafts:read` | List and read drafts |
| `drafts:write` | Create, update, delete drafts |
| `drafts:generate` | Generate drafts from topics |
| `publish:read` | List scheduled/published posts |
| `publish:write` | Publish or schedule posts |
| `analytics:read` | Read analytics, patterns, insights |
| `voice:read` | Read voice settings and examples |
| `voice:write` | Update voice settings |
| `strategy:read` | Read content strategy |
| `strategy:write` | Update content strategy |

### Endpoints

#### Drafts
- `GET /api/v1/drafts` — List drafts (query: status, type, limit, offset)
- `GET /api/v1/drafts/:id` — Get draft by ID
- `POST /api/v1/drafts` — Create draft manually
- `PATCH /api/v1/drafts/:id` — Update draft
- `DELETE /api/v1/drafts/:id` — Delete draft
- `POST /api/v1/drafts/generate` — Generate draft from topic (body: topic, type, patterns[])

#### Publishing & Queue
- `GET /api/v1/queue` — List scheduled posts (query: status, limit, offset)
- `POST /api/v1/publish` — Publish immediately (body: draftId or inline content)
- `POST /api/v1/schedule` — Schedule for later (body: draftId or content, scheduledFor)
- `DELETE /api/v1/queue/:id` — Cancel scheduled post
- `POST /api/v1/queue/:id/retry` — Retry failed post

#### Analytics
- `GET /api/v1/analytics/overview` — Summary stats (total posts, avg engagement, etc.)
- `GET /api/v1/analytics/posts` — Post-level analytics (query: sort, limit, dateRange)
- `GET /api/v1/analytics/best-times` — Best posting times
- `GET /api/v1/analytics/boost-opportunities` — High-potential posts to boost

#### Patterns
- `GET /api/v1/patterns` — List extracted patterns (query: type, enabled)
- `POST /api/v1/patterns/extract` — Trigger pattern extraction

#### Voice
- `GET /api/v1/voice/settings` — Get voice settings (query: voice_type)
- `PATCH /api/v1/voice/settings` — Update voice settings
- `GET /api/v1/voice/examples` — List voice examples

#### Strategy
- `GET /api/v1/strategy` — Get content strategy & weekly targets
- `GET /api/v1/strategy/progress` — Get progress toward weekly targets

#### Account
- `GET /api/v1/me` — Current user info (x_handle, plan, key scopes)
- `GET /api/v1/health` — API health check (no auth required)

---

## Phase 3: MCP Server — MVP COMPLETE

> Implemented in-repo at `mcp/` (stdio, `@modelcontextprotocol/sdk`). Transport-agnostic tool layer (`mcp/src/tools.ts`) → 18 tools over the v1 API. Added reply support: `voiceType`+`replyTo` on `POST /v1/drafts/generate`, `X_REPLY` on `POST /v1/publish/now`, plus new `GET /v1/tweets/:id`, `GET/DELETE /v1/queue`, `GET /v1/me`. Tools: whoami, get_voice_settings, get_strategy, generate_post, generate_reply, get_tweet, list/get/create/update/delete_draft, publish_post/thread/reply, schedule_post, list_queue, cancel_scheduled, get_analytics.
> Fast-follow (not yet built): remote Streamable-HTTP transport + OAuth for a native claude.ai Connector (reuses the same tool layer); OpenAPI spec entries for the new endpoints.

### 3.1 — MCP Server Setup
- Standalone MCP server (can run as stdio or HTTP/SSE)
- Config: user provides their API key in MCP server config
- All tools call the v1 API endpoints internally

### 3.2 — MCP Tool Definitions
Each tool maps to a v1 endpoint with typed input/output schemas:

| Tool Name | Description | Maps To |
|-----------|-------------|---------|
| `generate_draft` | Generate a new draft from a topic | `POST /v1/drafts/generate` |
| `list_drafts` | List existing drafts | `GET /v1/drafts` |
| `get_draft` | Get a specific draft | `GET /v1/drafts/:id` |
| `publish_now` | Publish a draft immediately | `POST /v1/publish` |
| `schedule_post` | Schedule a post for later | `POST /v1/schedule` |
| `list_queue` | View scheduled posts | `GET /v1/queue` |
| `cancel_scheduled` | Cancel a scheduled post | `DELETE /v1/queue/:id` |
| `get_analytics` | Get post analytics | `GET /v1/analytics/posts` |
| `get_best_times` | Get optimal posting times | `GET /v1/analytics/best-times` |
| `get_patterns` | Get extracted content patterns | `GET /v1/patterns` |
| `get_voice_settings` | Get current voice config | `GET /v1/voice/settings` |
| `get_strategy` | Get content strategy | `GET /v1/strategy` |
| `get_strategy_progress` | Check weekly progress | `GET /v1/strategy/progress` |

### 3.3 — MCP Server Distribution
- npm package or direct GitHub install
- Config example for Claude Desktop / Claude Code:
```json
{
  "mcpServers": {
    "content-automation": {
      "command": "npx",
      "args": ["@yourorg/content-automation-mcp"],
      "env": {
        "CONTENT_API_KEY": "sk_live_...",
        "CONTENT_API_URL": "https://yourapp.vercel.app"
      }
    }
  }
}
```

---

## Phase 4: Developer Experience

### 4.1 — API Documentation
- OpenAPI 3.0 spec auto-generated or hand-written
- Interactive docs page at `/developers` or `/docs/api`
- Code examples (curl, TypeScript, Python)

### 4.2 — Settings UI
- "Developer" or "API Keys" tab in Settings
- Generate, name, scope, and revoke keys
- Usage stats per key (requests today, last used)

### 4.3 — Logging & Observability
- `api_request_logs` table: key_id, endpoint, method, status, latency, timestamp
- Dashboard showing API usage per key

---

## Build Order (Recommended)

1. **api_keys table + migration** (~15 min)
2. **API key auth middleware + rate limiting** (~30 min)
3. **Key management endpoints + Settings UI** (~45 min)
4. **v1 endpoints — drafts, queue, publish** (~1 hr)
5. **v1 endpoints — analytics, patterns, voice, strategy** (~1 hr)
6. **MCP server scaffolding + first 3 tools** (~1 hr)
7. **Remaining MCP tools + testing** (~1 hr)
8. **API docs page** (~30 min)

---

## Technical Notes
- v1 routes reuse existing `src/lib/` functions — no logic duplication
- API key prefix format: `sk_live_` (prod) / `sk_test_` (dev)
- Keys are generated with `crypto.randomBytes(32)` → base64url, stored as SHA-256 hash
- All v1 responses include `X-Request-Id` header for debugging
- Error responses follow `{ error: string, code: string, details?: any }` format
- Pagination: cursor-based (`?cursor=...&limit=20`) or offset-based for simpler queries
