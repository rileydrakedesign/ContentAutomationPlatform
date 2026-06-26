# Feature Source-of-Truth Docs

Each file here is the **engineering source of truth** for one subsystem of the product:
what it is, how it works, the key files (`path:line`), the data model, the endpoints, and
its **current state & gaps**. Audience: builders. For the *why*, see the
[PRD](../product/prd.md); for *user-facing how-to*, see [`../guides/`](../guides/); for
*cross-cutting system narrative*, see [`../architecture/`](../architecture/).

> Convention: when a value can rot (endpoint, table, credit cost), these docs state it to
> match the code and cite where. If you change the code, update the doc.

| Doc | What it covers |
|---|---|
| ⭐ [writing-assistant.md](writing-assistant.md) | The real-time assistant — L0–L3 engine, scoring, anchoring, the three surfaces |
| [generation.md](generation.md) | AI on-ramps: Quick, Agentic pipeline, Refine, reply gen; seeding the editor |
| [voice-engine.md](voice-engine.md) | The wedge: dials, guardrails, examples, patterns, niche, prompt assembly, tune-up |
| [analysis-and-insights.md](analysis-and-insights.md) | Analytics ingest, weightedEngagement, X-algorithm model, prepublish read, insights |
| [publishing-and-scheduling.md](publishing-and-scheduling.md) | Publish/thread/reply, queue, scheduled cron, media, retry |
| [reply-finder.md](reply-finder.md) | Reply target discovery, opportunity score, in-voice reply gen, account safety |
| [billing-plans-and-credits.md](billing-plans-and-credits.md) | Plans, quota slots, credits, gating primitives, Stripe |
| [chrome-extension.md](chrome-extension.md) | In-X surface: injection, shared engine bundle, orb/underlines, opportunity pill |
| [mcp-and-public-api.md](mcp-and-public-api.md) | MCP server + v1 REST API (engineering index; links to docs/mcp, docs/api) |
| [x-integration.md](x-integration.md) | X OAuth, in-house API client, sync, media, tweet-text utilities |

## Reading order for a new engineer

1. [PRD](../product/prd.md) → what we're building and why.
2. [writing-assistant.md](writing-assistant.md) → the pivot centerpiece.
3. [voice-engine.md](voice-engine.md) + [analysis-and-insights.md](analysis-and-insights.md) → the wedge that grounds it.
4. The rest as needed.
