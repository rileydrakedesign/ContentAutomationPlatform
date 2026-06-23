# Authentication & scopes

## Credential types

Two kinds of bearer credential resolve to the same identity, scopes, rate
limits, and credit metering ([`src/lib/api/auth.ts`](../../src/lib/api/auth.ts)):

| Credential | Prefix | Used by |
| --- | --- | --- |
| **API key** | `sk_live_...` | REST API, stdio MCP package |
| **OAuth 2.1 access token** | `mcp_at_...` | the hosted MCP gateway (`/api/v1/mcp`) |

For the REST API you always use an **API key**. The OAuth flow exists only for
the hosted MCP connector (see [../mcp/overview.md](../mcp/overview.md)); the REST
endpoints accept `sk_live_` keys.

Send it on every request:

```
Authorization: Bearer sk_live_...
```

## API key format

Keys are `sk_live_` + random base64url. Only a SHA-256 **hash** is stored; the
raw key is shown once at creation. A short **prefix** (`sk_live_` + 8 chars) is
stored for display so you can identify a key in the dashboard without revealing
it. Keys can be revoked or given an expiry; either makes them stop authenticating
immediately.

## Scopes

Each key carries a set of scopes; an endpoint requires specific scopes and
returns **403 `forbidden`** if the key lacks them. The complete set
([`src/lib/api/scopes.ts`](../../src/lib/api/scopes.ts)):

| Scope | Grants |
| --- | --- |
| `drafts:read` | List/get drafts |
| `drafts:write` | Create/update/delete drafts; submit feedback |
| `drafts:generate` | AI generation (`POST /drafts/generate`) |
| `publish:read` | List the publish queue / history |
| `publish:write` | Publish now, schedule, cancel |
| `analytics:read` | Analytics, best-times, tweet reads, timeline sync |
| `voice:read` | Read voice settings, writing context; voice-check a draft |
| `voice:write` | Update voice settings; run the tune-up |
| `strategy:read` / `strategy:write` | Read / upsert content strategy |
| `patterns:read` / `patterns:write` | List / enable-disable-rename patterns |
| `inspiration:read` / `inspiration:write` | List / save-delete inspiration |
| `niche:read` | Read the niche profile |
| `search:read` | Search tweets / find reply targets |

The required scope for each endpoint is documented in the OpenAPI spec as the
`x-required-scopes` extension (visible per-operation at `/developers`). Notable
choices:

- `GET /me` and `GET /health` require **any valid key** (no specific scope;
  `/health` works without a key too).
- `POST /voice/check` is scoped **`voice:read`** — it scores/reads and never
  mutates voice configuration. (The credit charge is for the model call, which is
  independent of scope.)
- `POST /insights/tuneup` is scoped **`voice:write`** — it re-tunes stored
  examples, patterns, and niche.

## Rate limiting

Requests are rate-limited per key with a sliding window. The per-minute limit
comes from your plan ([`src/types/subscription.ts`](../../src/types/subscription.ts)):
**Free 20, Pro 60, Agent 120**. Every response carries:

| Header | Meaning |
| --- | --- |
| `X-RateLimit-Limit` | Max requests per window |
| `X-RateLimit-Remaining` | Requests left |
| `X-RateLimit-Reset` | Unix seconds until the window resets |

Over the limit returns **429 `rate_limited`**. See [errors.md](errors.md) for the
daily action caps that sit on top of credits.
