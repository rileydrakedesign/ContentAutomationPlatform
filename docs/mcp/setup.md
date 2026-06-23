# MCP server — setup

Both transports need an Agents For X account with X connected. Confirm with
`whoami` after connecting.

## stdio (API key) {#stdio}

### 1. Create an API key

In the app: **Settings → API Keys** → generate. Copy it once (`sk_live_...`) and
grant the [scopes](../api/authentication.md#scopes) the agent should have.

### 2. Add the server to your client

**Claude Code:**

```bash
claude mcp add agentsforx -e CONTENT_API_KEY=sk_live_... -- npx -y @agentsforx/mcp
```

**Claude Desktop** (`claude_desktop_config.json`) or any MCP client:

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

### Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `CONTENT_API_KEY` | yes | Your `sk_live_...` API key |
| `CONTENT_API_URL` | no | API base URL (default `https://app.agentsforx.com`; set to `http://localhost:3000` for local dev) |
| `MCP_DEBUG=1` | no | Structured request logs on stderr |

On start, the server runs a health ping and logs (to stderr) whether the key
authenticated and which scopes it has — a fast way to catch a bad key before the
first tool call.

> **Keep your key out of version control.** MCP config files are a common leak
> vector — prefer machine-local config and rotate the key in Settings if exposed.

## Hosted (OAuth 2.1) {#hosted-oauth}

No local install and no key handling — connect to the gateway and a browser
window asks you to log in and approve scopes. **API keys are not accepted here**;
this endpoint is OAuth-only.

Endpoint: `https://app.agentsforx.com/api/v1/mcp`

- **claude.ai:** Settings → Connectors → Add custom connector → paste the URL.
- **Claude Code:**

  ```bash
  claude mcp add --transport http agentsforx https://app.agentsforx.com/api/v1/mcp
  # then inside Claude Code: /mcp → Authenticate
  ```

The OAuth flow uses PKCE + dynamic client registration; clients discover it from
`/.well-known/oauth-authorization-server` and the protected-resource metadata at
`/.well-known/oauth-protected-resource`. A `401` from the endpoint carries a
`WWW-Authenticate` header pointing clients at that metadata.

## Verify

Ask the agent to call `whoami`. You should see your X handle, `x_connected:
true`, your granted scopes, plan, and credit balance. If `x_connected` is false,
reconnect X in the app. See [troubleshooting.md](troubleshooting.md) for common
failures.
