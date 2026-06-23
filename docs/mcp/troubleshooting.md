# MCP troubleshooting

Every API error surfaces to the agent as `API error (<status> <code>): <message>`
plus an actionable hint. Common cases:

| Symptom | Code (status) | Fix |
| --- | --- | --- |
| Tools fail right away | `unauthorized` (401) | Bad/revoked key. Check `CONTENT_API_KEY` (stdio) or re-authenticate (hosted). |
| "Missing required scopes: …" | `forbidden` (403) | The key lacks a scope. Create a key with the needed scopes (see [../api/authentication.md](../api/authentication.md#scopes)). |
| "Out of credits" | `INSUFFICIENT_CREDITS` (402) | Top up in Settings → Billing or wait for the monthly reset. `whoami` shows the balance. |
| "Upgrade required …" | `plan_limit` (403) | Search, scheduling, and timeline sync are **Pro**. Upgrade. |
| "X account not connected …" | `x_not_connected` (400) | Reconnect X in the app, then retry. `whoami` should show `x_connected: true`. |
| Rate limit hit | `rate_limited` (429) | The client waits out `Retry-After` automatically; if persistent, slow down or upgrade (limits: Free 20 / Pro 60 / Agent 120 req/min). |
| Daily cap hit | `daily_cap` (429) | Per-plan daily publish/generate cap — wait for rollover or upgrade. |
| Reply rejected after `reply_allowed: true` | `x_api_error` (403/502) | `reply_allowed` is best-effort; the author may block replies or spam heuristics trip. Surface it and move on. |
| Thread partially posted | `x_partial_thread` (502) | **Do not** retry the whole thread. The error includes `remainingTweets` — resume with only those. |

## Auth failures

- **stdio:** the startup health ping logs (stderr) whether the key authenticated
  and its scopes. Run with `MCP_DEBUG=1` for structured request logs. A missing
  `CONTENT_API_KEY` exits immediately with a clear message.
- **hosted:** a `401` returns `WWW-Authenticate` pointing at the OAuth metadata;
  re-run the connector's authenticate step. The hosted endpoint accepts **only**
  `mcp_at_` OAuth tokens — an `sk_live_` key will not work there.

## Tool missing (e.g. `find_reply_posts`)

The hosted gateway always matches the repo (36 tools). If a locally-installed
stdio package is missing a tool, it predates that tool — upgrade:

```bash
npx -y @agentsforx/mcp@latest
```

## Nothing is in my voice / generations feel generic

The voice context may be stale or thin. Check `context_freshness` (via `whoami`);
if `retune_recommended` is true, run `run_tuneup`. Make sure voice settings,
examples, and inspiration exist in the app (see
[../guides/voice-tuneup.md](../guides/voice-tuneup.md)).

## Local development

Point the stdio server at a local app with `CONTENT_API_URL=http://localhost:3000`.
Build and poke the server directly:

```bash
cd mcp
npm install && npm run build
npm run inspector   # MCP Inspector
```
