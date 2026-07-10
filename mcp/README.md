# Agents For X — MCP Server

An [MCP](https://modelcontextprotocol.io) server for **Agents For X — the
real-time writing assistant for X**. It lets Claude (and other MCP clients) fetch
your voice context and write posts and replies **in your voice**, voice-check
drafts against what actually performs for you, then draft, schedule, and publish —
plus read your analytics and manage your patterns, inspiration, and strategy, all
through your Agents For X account.

The preferred loop is **write → check**: the agent calls `get_writing_context`
and writes the post itself in your voice, then `check_draft` scores it against
your tuned voice and proven patterns. Server-side generation stays available as a
fallback when the agent can't write directly.

> **Full documentation** lives in [`docs/`](../docs/README.md): MCP
> [overview](../docs/mcp/overview.md) · [setup](../docs/mcp/setup.md) ·
> [tool tour](../docs/mcp/tools.md) · [generated tool reference](../docs/mcp/tools.generated.md) ·
> [workflows](../docs/mcp/workflows.md) · [troubleshooting](../docs/mcp/troubleshooting.md).

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
Your plan includes a monthly allowance (Free 100 / Pro 2,000 / Agent 7,500);
top-up packs never expire while subscribed. Metered tool results end with a
`credits: charged X, remaining Y` line, and a `402` error means the balance is
empty. Posts containing a URL cost **30** instead of 3 (X bills link posts at
~13×).

Per-action prices are in [`docs/api/credits.md`](../docs/api/credits.md) (and on
each tool in [`docs/mcp/tools.generated.md`](../docs/mcp/tools.generated.md)).

## Tools (36)

The full per-tool reference — every input, type, constraint, credit cost, and the
REST endpoint each maps to — is **generated** from the Zod schemas in
[`src/tools.ts`](src/tools.ts) and lives at
[`docs/mcp/tools.generated.md`](../docs/mcp/tools.generated.md) (regenerate with
`npm run gen-docs`). For a grouped narrative tour, see
[`docs/mcp/tools.md`](../docs/mcp/tools.md).

Both transports (this stdio package and the hosted `/api/v1/mcp` gateway) register
the identical set via the shared `registerTools()`.

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
- `src/tools.ts` — `registerTools(server, api)`: all 36 tools, hardened zod
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
