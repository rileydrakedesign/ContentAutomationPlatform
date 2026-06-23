# Agents For X — Documentation

Agents For X is a content **voice tuner** for X (Twitter). It analyzes your
niche, positioning, and top-performing posts, then helps you draft, check,
schedule, and publish posts and replies that sound like *you* and match what
actually performs for your account.

Everything in the product is reachable three ways, all sharing one backend, one
credit currency, and one set of scopes:

- the **web app** (app.agentsforx.com),
- the **v1 REST API** (`/api/v1/...`, API-key auth),
- the **MCP server** for AI agents (stdio package + hosted OAuth gateway).

## Who each section is for

| You want to… | Start here |
| --- | --- |
| Call the REST API from your own code | [api/getting-started.md](api/getting-started.md) |
| Understand auth, keys, and scopes | [api/authentication.md](api/authentication.md) |
| Know what each call costs | [api/credits.md](api/credits.md) |
| Handle errors and rate limits | [api/errors.md](api/errors.md) |
| Copy working request examples | [api/examples.md](api/examples.md) |
| Connect Claude / an agent over MCP | [mcp/overview.md](mcp/overview.md) → [mcp/setup.md](mcp/setup.md) |
| See every MCP tool | [mcp/tools.md](mcp/tools.md) → [mcp/tools.generated.md](mcp/tools.generated.md) |
| Understand how the system fits together | [architecture/overview.md](architecture/overview.md) |
| See the whole loop & cross-surface parity | [architecture/loop.md](architecture/loop.md) |
| Walk the user journey through every surface | [architecture/user-journey.md](architecture/user-journey.md) |
| Learn a specific feature | the [guides/](guides/) folder |
| Look up a data model | [reference/data-models.md](reference/data-models.md) |

## Map of the docs

```
docs/
  api/            REST API: getting started, auth, credits, errors, examples
  mcp/            MCP server: overview, setup, tool tour, workflows, troubleshooting
  architecture/   How it works: system overview, voice system, publishing lifecycle
  guides/         Feature guides: tune-up, patterns, replying, analytics, agency, strategy
  reference/      Data models sourced from src/types/
```

## Source-of-truth pointers (do not duplicate, link)

- **REST contract:** the OpenAPI 3.1 spec at [`src/lib/api/openapi-spec.ts`](../src/lib/api/openapi-spec.ts),
  served at `GET /api/v1/openapi.json` and rendered interactively at **`/developers`**
  (Scalar). A test (`src/lib/api/openapi-spec.test.ts`) fails if the spec and the
  route set drift.
- **MCP tools:** the Zod tool definitions in [`mcp/src/tools.ts`](../mcp/src/tools.ts).
  The per-tool reference [`mcp/tools.generated.md`](mcp/tools.generated.md) is
  **generated** from them (`cd mcp && npm run gen-docs`) — never edited by hand.
- **Credit prices:** [`src/lib/billing/credits.ts`](../src/lib/billing/credits.ts)
  (`CREDIT_COSTS`). [api/credits.md](api/credits.md) mirrors it.
- **Plans & limits:** [`src/types/subscription.ts`](../src/types/subscription.ts).
- **Cost economics (business):** [cost-analysis.md](cost-analysis.md).

> Prose in these docs is hand-written and accurate as of this pass. Where a value
> can rot (endpoint, field, tool, credit cost), it is stated to match the spec /
> `tools.ts`; if you change those, update or regenerate the docs.
