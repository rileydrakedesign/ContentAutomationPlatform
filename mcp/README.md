# Agents For X — MCP Server

An [MCP](https://modelcontextprotocol.io) server that lets Claude (and other MCP
clients) draft, schedule, and publish X posts and replies **in your voice**, and
read your analytics — all through your Agents For X account.

Generation runs through your saved voice settings, examples, and inspiration
posts on the server, so Claude doesn't need to know your style — it just asks for
content and gets it in your voice.

## Setup

### 1. Create an API key

In the app, go to **Settings → API Keys** and generate a key. Copy it (shown
once) — it looks like `sk_live_...`. Give it the scopes you want the agent to
have (e.g. `drafts:generate`, `drafts:write`, `publish:write`, `analytics:read`,
`voice:read`, `strategy:read`, `publish:read`).

### 2. Build the server

```bash
cd mcp
npm install
npm run build
```

### 3. Add it to your MCP client

**Claude Desktop** (`claude_desktop_config.json`) or **Claude Code**
(`.mcp.json`):

```json
{
  "mcpServers": {
    "agents-for-x": {
      "command": "node",
      "args": ["/absolute/path/to/content_automation/mcp/dist/stdio.js"],
      "env": {
        "CONTENT_API_KEY": "sk_live_...",
        "CONTENT_API_URL": "https://app.agentsforx.com"
      }
    }
  }
}
```

Once published to npm you can instead use:

```json
{
  "mcpServers": {
    "agents-for-x": {
      "command": "npx",
      "args": ["-y", "@agentsforx/mcp"],
      "env": { "CONTENT_API_KEY": "sk_live_...", "CONTENT_API_URL": "https://app.agentsforx.com" }
    }
  }
}
```

`CONTENT_API_URL` defaults to `https://app.agentsforx.com` if omitted. Point it at
`http://localhost:3000` to develop against a local app.

## Tools

| Tool | What it does |
|------|--------------|
| `whoami` | Confirm the connected X account and key scopes |
| `get_voice_settings` | Read post/reply voice config + examples |
| `get_strategy` | Read weekly content strategy & targets |
| `generate_post` | Generate post/thread options in the post voice (no publish) |
| `generate_reply` | Generate reply options in the reply voice (no publish) |
| `get_tweet` | Fetch a tweet's text/metrics by ID or URL (reply context) |
| `list_drafts` / `get_draft` | Browse saved drafts |
| `create_draft` / `update_draft` / `delete_draft` | Manage drafts |
| `publish_post` / `publish_thread` / `publish_reply` | Publish to X **now** (irreversible) |
| `schedule_post` | Schedule a post or thread for later (Pro) |
| `list_queue` / `cancel_scheduled` | Manage scheduled posts |
| `get_analytics` | Read post analytics (summary / posts / all) |

Publishing tools post to X immediately and are irreversible — Claude is instructed
to confirm the exact text with you first.

## Typical flow

1. `whoami` → confirm connection.
2. `generate_post` with a topic, or `get_tweet` + `generate_reply` to reply.
3. Review the options.
4. `create_draft` / `schedule_post`, or `publish_*` after confirming.

## Local testing

Inspect the server interactively with the MCP Inspector:

```bash
CONTENT_API_KEY=sk_live_... CONTENT_API_URL=http://localhost:3000 npm run inspector
```

## Architecture

- `src/client.ts` — thin v1 REST client (the only place that knows the API key).
- `src/tools.ts` — `registerTools(server, api)`: transport-agnostic tool layer.
- `src/server.ts` — builds the configured `McpServer` (name, version, instructions).
- `src/stdio.ts` — stdio entrypoint.

The tool layer is deliberately transport-agnostic so the same tools can later be
served over streamable-HTTP for a hosted claude.ai **Connector** (with OAuth)
without rewriting any tools.
