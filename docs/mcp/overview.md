# MCP server — overview

The Agents For X **MCP** (Model Context Protocol) server lets Claude and other
AI agents draft, voice-check, schedule, and publish X posts and replies **in your
voice**, read your analytics, and manage your patterns, inspiration, niche, and
strategy — all through your Agents For X account.

Generation and voice-checking run against your saved voice settings, examples,
and proven patterns on the server, so the agent doesn't need to know your style;
it asks for context or content and gets it in your voice.

## Two transports, one tool set

Both surfaces register the **identical 36 tools** via the shared
[`registerTools()`](../../mcp/src/tools.ts), and both enforce the same scopes,
rate limits, and credit metering as the [REST API](../api/getting-started.md):

| | stdio package | hosted gateway |
| --- | --- | --- |
| Where | `@agentsforx/mcp` run locally (`npx`) | `https://app.agentsforx.com/api/v1/mcp` |
| Transport | stdio | streamable HTTP |
| Auth | **API key** (`sk_live_...` via `CONTENT_API_KEY`) | **OAuth 2.1** (PKCE + dynamic client registration) |
| Best for | local dev, full control, self-hosting | claude.ai connectors, zero local install, no key handling |
| Setup | [setup.md](setup.md#stdio) | [setup.md](setup.md#hosted-oauth) |

Because they share one code path, the tool list, inputs, costs, and behavior are
guaranteed to match. The per-tool reference is **generated** from the Zod schemas:
[tools.generated.md](tools.generated.md).

> **Published-package note:** the hosted gateway always tracks the repo. If your
> locally-installed `@agentsforx/mcp` predates a tool (e.g. `find_reply_posts`),
> upgrade the package (`npx -y @agentsforx/mcp@latest`) to match.

## When to use which

- **Use the hosted gateway** for claude.ai or any remote MCP client: add it as a
  custom connector, log in once, approve scopes — no key to store.
- **Use the stdio package** when you want a local process, a self-hosted
  deployment (`CONTENT_API_URL`), debug logs (`MCP_DEBUG`), or to pin a version.

Prefer neither over the other for capability — they're the same tools.

## How an agent should use it

The server ships **instructions** that steer agents to the cheapest, best path:

1. `whoami` — confirm the X account is connected and check credits.
2. **Write it yourself:** `get_writing_context` (free) returns your assembled
   voice prompt + proven patterns + rules; the agent writes the post/reply
   directly. Server-side `generate_post` / `generate_reply` (3 credits) are a
   fallback.
3. `check_draft` (3 credits) — score the draft 0-100 against your tuned voice;
   apply the suggested edit and iterate.
4. Save (`create_draft`), schedule (`schedule_post`), or publish
   (`publish_post`/`publish_reply`/`publish_thread`) **after explicit user
   confirmation** — publishing is irreversible.

See [workflows.md](workflows.md) for the detailed patterns and
[setup.md](setup.md) to connect.
