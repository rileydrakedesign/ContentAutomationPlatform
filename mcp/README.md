# Agents For X — MCP Server

An [MCP](https://modelcontextprotocol.io) server that lets Claude (and other MCP
clients) draft, schedule, and publish X posts and replies **in your voice**, read
your analytics, and manage your patterns, inspiration, and strategy — all through
your Agents For X account.

Generation runs through your saved voice settings, examples, and inspiration
posts on the server, so the agent doesn't need to know your style — it just asks
for content and gets it in your voice.

## Quick start

### 1. Create an API key

In the app, go to **Settings → API Keys** and generate a key. Copy it (shown
once) — it looks like `sk_live_...`. Grant the scopes you want the agent to have
(see the scope reference below).

### 2. Add it to your MCP client

**Claude Code:**

```bash
claude mcp add agentsforx -e CONTENT_API_KEY=sk_live_... -- npx -y @agentsforx/mcp
```

**Claude Desktop** (`claude_desktop_config.json`) or any other MCP client:

```json
{
  "mcpServers": {
    "agentsforx": {
      "command": "npx",
      "args": ["-y", "@agentsforx/mcp"],
      "env": { "CONTENT_API_KEY": "sk_live_..." }
    }
  }
}
```

**Remote (no local install, no key handling):** the same tools are served over
streamable HTTP with OAuth 2.1 — connect and a browser window asks you to log
in and approve. API keys are not accepted on the remote endpoint.

- **claude.ai:** Settings → Connectors → Add custom connector →
  `https://app.agentsforx.com/api/v1/mcp`
- **Claude Code:**

```bash
claude mcp add --transport http agentsforx https://app.agentsforx.com/api/v1/mcp
# then inside Claude Code: /mcp → Authenticate
```

### Environment variables (stdio)

| Variable | Required | Description |
|---|---|---|
| `CONTENT_API_KEY` | yes | Your `sk_live_...` API key |
| `CONTENT_API_URL` | no | API base URL (default `https://app.agentsforx.com`) |
| `MCP_DEBUG=1` | no | Structured request logs on stderr |

> **Keep your key out of version control.** MCP config files are a common leak
> vector — prefer machine-local config, and rotate the key in Settings if it is
> ever exposed.

## Credits

Actions that cost real money are metered in **credits** (1 credit = $0.01).
Your plan includes a monthly allowance (Free 100 / Pro 2,000); top-up packs
never expire while subscribed. Metered tool results end with a
`credits: charged X, remaining Y` line, and a `402` error means the balance is
empty.

| Tool | Credits |
|---|---|
| `generate_post`, `generate_reply` | 3 |
| `publish_post`, `publish_reply` | 3 — **30 if the text contains a URL** |
| `publish_thread` | 3 per tweet (30 per URL tweet) |
| `schedule_post` | same as publish, debited at schedule time, refunded on cancel |
| `get_tweet` | 1 |
| `get_analytics`, `get_best_times` | 1 |
| `search_tweets` | 1 per result returned (min 5) |
| `sync_analytics` | 15 |
| `add_inspiration` | 3 |
| everything else | free |

The URL surcharge mirrors X's API pricing, which bills posts containing links at
~13x the plain-post rate.

## Tools (33)

| Tool | What it does | Scope |
|---|---|---|
| `whoami` | X connection health, scopes, plan, credits | — |
| `health` | Connectivity check | — |
| `get_credits` | Plan + credit balances | — |
| `get_voice_settings` / `update_voice_settings` | Read/update voice dials, guardrails, AI model | `voice:read` / `voice:write` |
| `get_strategy` / `update_strategy` | Read/set weekly content strategy | `strategy:read` / `strategy:write` |
| `get_niche` | Analyzed niche profile | `niche:read` |
| `get_writing_context` | **Preferred:** the user's voice prompt + patterns + rules so the calling model writes the content itself (free) | `voice:read` |
| `check_draft` | Score a draft 0-100 against the user's tuned voice + proven patterns; returns matches, deviations, suggested edit (3 credits) | `voice:read` |
| `run_tuneup` | Run the full Voice Tune-Up (refresh examples → extract patterns → analyze niche & positioning) and return the Voice Report (5 credits) | `voice:write` |
| `generate_post` / `generate_reply` | Server-side generation fallback (options only — never publishes) | `drafts:generate` |
| `send_feedback` | Like/dislike feedback on generations | `drafts:write` |
| `list_drafts` / `get_draft` / `create_draft` / `update_draft` / `delete_draft` | Draft CRUD | `drafts:read` / `drafts:write` |
| `publish_post` / `publish_thread` / `publish_reply` | Publish to X **immediately** | `publish:write` |
| `schedule_post` | Schedule for later (Pro) | `publish:write` |
| `list_queue` / `cancel_scheduled` / `list_published` | Queue management & history | `publish:read` / `publish:write` |
| `get_analytics` / `get_best_times` | Engagement analytics | `analytics:read` |
| `sync_analytics` | Delta-sync timeline from X (Pro) | `analytics:read` |
| `get_tweet` | Fetch a tweet by ID/URL (reply context) | `analytics:read` |
| `search_tweets` | Search recent public tweets (Pro) | `search:read` |
| `list_patterns` / `toggle_pattern` | Growth patterns | `patterns:read` / `patterns:write` |
| `list_inspiration` / `add_inspiration` | Inspiration library | `inspiration:read` / `inspiration:write` |

### Typical flow

1. `whoami` → confirm the X account is connected and check credits.
2. `get_writing_context` → the agent writes the post/reply itself in the
   user's voice (server-side `generate_post`/`generate_reply` remain as a
   3-credit fallback). For replies, `get_tweet` first for context.
3. `check_draft` → score the draft against the tuned voice and apply the
   suggested edit until it matches.
4. Show drafts to the user; `create_draft` to save, `send_feedback` on reactions.
5. `publish_post` / `publish_reply` after explicit user confirmation, or
   `schedule_post` for later.
6. `get_analytics`, `get_best_times`, `list_patterns`, `get_strategy` to plan.

## Reliability behavior

- **Retries:** reads (GET/DELETE) retry up to 3x with exponential backoff on
  network errors and 5xx. Writes are **never** blindly retried — a publish that
  times out *may have gone through*, and the error says so explicitly.
- **Rate limits:** on `429` the client waits out `Retry-After` (≤30s) and
  retries; per-key limits are 20–120 req/min depending on plan.
- **Errors:** every API error surfaces as `API error (status code): message`
  plus an actionable hint.

| Error code | Meaning | What to do |
|---|---|---|
| `unauthorized` (401) | Bad/revoked key | Check `CONTENT_API_KEY` |
| `INSUFFICIENT_CREDITS` (402) | Out of credits | Top up or wait for the monthly reset |
| `forbidden` (403) | Missing scope | Create a key with the needed scopes |
| `plan_limit` (403) | Pro feature | Upgrade |
| `not_found` (404) | Bad ID | Verify the ID |
| `daily_cap` / `rate_limited` (429) | Cap or limit hit | Wait / upgrade |
| `x_not_connected` (400) | X account disconnected | Reconnect X in the app |
| `x_partial_thread` (502) | Thread partially posted | Resume with `remainingTweets` only — do **not** retry the whole thread |

## Development

```bash
npm install
npm run build       # compile to dist/
npm test            # vitest unit suite (client + tools)
npm run inspector   # poke it with the MCP Inspector
```

Local API: set `CONTENT_API_URL=http://localhost:3000`.

### Architecture

- `src/client.ts` — HTTP client: auth, timeouts, retries/backoff, 429 handling,
  credit-header capture, error hints. No MCP imports.
- `src/tools.ts` — `registerTools(server, api)`: all 35 tools, hardened zod
  schemas. No transport assumptions.
- `src/server.ts` — builds the `McpServer` (instructions + tool registration).
- `src/stdio.ts` — stdio entrypoint with startup health check.

The tool layer is transport-agnostic: the same `registerTools` powers both this
stdio package (API-key auth) and the hosted streamable-HTTP endpoint at
`/api/v1/mcp` (OAuth 2.1 with PKCE + dynamic client registration — metadata at
`/.well-known/oauth-authorization-server`).

## Releasing

Tag `mcp-vX.Y.Z` on `main` → GitHub Actions builds, tests, and publishes to npm
(requires the `NPM_TOKEN` repo secret).
