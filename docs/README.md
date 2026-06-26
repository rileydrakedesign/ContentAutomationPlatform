# Agents For X — Documentation

**Agents For X is a real-time writing assistant for X (Twitter).** You write your own posts
and replies; as you type, it shows where the post drifts from *your* voice and where it'll
lose to the algorithm — grounded in your own top-performing posts and how X actually ranks —
and fixes both in one click. AI generation still exists, demoted to an optional **on-ramp**
that seeds the editor. The human keeps the pen.

> Start with the **[PRD](product/prd.md)** for what we're building and why.

Everything in the product is reachable three ways, sharing one backend, one credit currency,
and one set of scopes: the **web app**, the **v1 REST API** (`/api/v1/...`), and the **MCP
server** for AI agents.

## Where to go

| You want to… | Start here |
| --- | --- |
| Understand the product (the *why*) | [product/prd.md](product/prd.md) · [product/product-features.md](product/product-features.md) |
| Learn how a subsystem works (the *how*, for builders) | [features/](features/README.md) |
| Understand the real-time writing assistant | [features/writing-assistant.md](features/writing-assistant.md) |
| See how the system fits together | [architecture/overview.md](architecture/overview.md) · [architecture/loop.md](architecture/loop.md) |
| Use a feature (user how-to) | [guides/](guides/) |
| Call the REST API | [api/getting-started.md](api/getting-started.md) → [auth](api/authentication.md), [credits](api/credits.md), [errors](api/errors.md), [examples](api/examples.md) |
| Connect Claude / an agent over MCP | [mcp/overview.md](mcp/overview.md) → [setup](mcp/setup.md), [tools](mcp/tools.md) |
| Look up a data model | [reference/data-models.md](reference/data-models.md) |
| See business economics | [business/cost-analysis.md](business/cost-analysis.md) · [business/cogs.md](business/cogs.md) |
| Run / deploy / schedule jobs | [operations/deployment.md](operations/deployment.md) · [operations/background-jobs.md](operations/background-jobs.md) |
| Strategy / positioning / ICP / copy | [`research/`](../research/README.md) |

## Map of the docs

```
docs/
  product/        ⭐ PRD + current-state feature catalog — the product definition
  features/       ⭐ engineering source-of-truth, one doc per subsystem
  architecture/   how it fits together: overview, voice-system, publishing, loop, user-journey
  guides/         user-facing feature how-tos: tune-up, patterns, reply, analytics, strategy
  api/            REST API: getting started, auth, credits, errors, examples
  mcp/            MCP server: overview, setup, tools, workflows, troubleshooting
  reference/      data models sourced from src/types/
  business/       cost analysis + COGS economics
  operations/     deployment + background jobs (cron/queues)
  archive/        superseded / pre-pivot docs (provenance only)
```

Three doc *layers*, by audience: **product/** (why) → **features/** (how, for builders) →
**guides/** (how-to, for users). **architecture/** is the cross-cutting system narrative.

## Source-of-truth pointers (do not duplicate, link)

- **Product definition:** [product/prd.md](product/prd.md). Strategy/GTM: [`research/`](../research/README.md) (maintained separately).
- **Pivot design rationale (historical):** repo-root `GRAMMARLY_PIVOT_PLAN.md`,
  `GRAMMARLY_PIVOT_UX.md`, `GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md` (kept at root for
  `research/` links; their TODO lists are **stale** — the work shipped).
- **REST contract:** OpenAPI 3.1 at [`src/lib/api/openapi-spec.ts`](../src/lib/api/openapi-spec.ts),
  served at `GET /api/v1/openapi.json`, rendered at **`/developers`** (Scalar). Drift test:
  `src/lib/api/openapi-spec.test.ts`.
- **MCP tools:** Zod defs in [`mcp/src/tools.ts`](../mcp/src/tools.ts); the per-tool
  reference [`mcp/tools.generated.md`](mcp/tools.generated.md) is **generated**
  (`cd mcp && npm run gen-docs`) — never hand-edited.
- **Credit prices:** [`src/lib/billing/credits.ts`](../src/lib/billing/credits.ts) (`CREDIT_COSTS`).
- **Plans & limits:** [`src/types/subscription.ts`](../src/types/subscription.ts).
- **Prompt/voice guidelines (product content):** [`LLM-post-guidelines/`](../LLM-post-guidelines/)
  — referenced by `src/lib/openai/prompts/`.

> Prose here is hand-written and accurate as of the last pass. Where a value can rot
> (endpoint, field, tool, credit cost), it is stated to match the spec / code; if you change
> those, update or regenerate the docs.
