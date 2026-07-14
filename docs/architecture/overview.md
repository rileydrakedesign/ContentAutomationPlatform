# Architecture overview

Agents For X is a Next.js 16 app (App Router, Turbopack) on Vercel, backed by
Supabase (Postgres + auth + storage). Three client surfaces — the web app, the
v1 REST API, and the MCP server — all funnel through the **same v1 handlers and
core engine**, so voice, credits, scopes, and rate limits behave identically
everywhere.

## System diagram

```
        ┌─────────────┐   ┌──────────────┐   ┌──────────────────────┐
        │  Web app UI │   │  v1 REST API │   │  MCP clients         │
        │ (app.*)     │   │  consumers   │   │  (Claude, agents)    │
        └──────┬──────┘   └──────┬───────┘   └─────────┬────────────┘
               │                 │                     │
               │           Bearer sk_live_       stdio │ / hosted (OAuth 2.1)
               │                 │            ┌────────┴─────────┐
               │                 │            │ @agentsforx/mcp  │  /api/v1/mcp
               │                 │            │ (API key)        │  (mcp_at_ token)
               │                 │            └────────┬─────────┘
               │                 │       registerTools │ (33 tools, shared)
               ▼                 ▼                     ▼
        ┌───────────────────────────────────────────────────────────┐
        │            v1 route handlers  (src/app/api/v1/**)          │
        │   auth + scopes · rate limit · credit metering · CORS      │
        └───────────────────────────────┬───────────────────────────┘
                                         ▼
        ┌───────────────────────────────────────────────────────────┐
        │                       Core engine                          │
        │  prompt-assembler (one tuned voice context)                │
        │  voice-check · analysis (niche/patterns/freshness)         │
        │  billing/credits · publish/execute · qstash/enqueue        │
        └───┬───────────────┬───────────────┬───────────────┬───────┘
            ▼               ▼               ▼               ▼
      ┌──────────┐   ┌────────────┐   ┌──────────┐   ┌──────────────┐
      │ Supabase │   │   X API    │   │  Stripe  │   │ Upstash      │
      │ Postgres │   │ (v2/posts) │   │ billing  │   │ QStash+Redis │
      └──────────┘   └────────────┘   └──────────┘   └──────────────┘
```

## The pieces

- **Client surfaces.** The web UI, the REST API (`sk_live_` keys), and the MCP
  server. The MCP server has two transports — the stdio package (API key) and the
  hosted gateway at `/api/v1/mcp` (OAuth 2.1) — both registering the identical
  tool set via [`registerTools`](../../mcp/src/tools.ts). Each MCP tool maps to
  one v1 REST endpoint.
- **v1 handlers** ([`src/app/api/v1/`](../../src/app/api/v1)). Every request goes
  through [`withApiAuth`](../../src/lib/api/v1-handler.ts): validate the bearer
  credential, check scopes, apply the per-key rate limit, then run the handler.
  Metered handlers debit credits before the external call and refund on failure.
- **Core engine** (`src/lib/`). The shared logic the handlers call:
  - **prompt-assembler** — assembles *one* tuned voice context per voice type
    (see [voice-system.md](voice-system.md)).
  - **analysis** — niche, pattern extraction, and context freshness.
  - **billing/credits** — the single credit currency and ledger
    ([credits.ts](../../src/lib/billing/credits.ts)).
  - **publish** — immediate posting and the scheduled-post executor
    (see [publishing.md](publishing.md)).
- **External services.** Supabase (data + auth), the **X API** (reads, search,
  posting), **Stripe** (subscriptions + credit packs), and **Upstash QStash +
  Redis** (scheduled-publish delivery and rate-limit windows).

For how these surfaces compose into the compounding voice loop — and a
stage-by-stage cross-surface parity matrix — see [loop.md](loop.md).

## Where the source of truth lives

| Concern | Source |
| --- | --- |
| REST contract | [`src/lib/api/openapi-spec.ts`](../../src/lib/api/openapi-spec.ts) (guarded by a test) |
| MCP tools | [`mcp/src/tools.ts`](../../mcp/src/tools.ts) → generated [reference](../mcp/tools.generated.md) |
| Credit prices | [`src/lib/billing/credits.ts`](../../src/lib/billing/credits.ts) |
| Plans & limits | [`src/types/subscription.ts`](../../src/types/subscription.ts) |
| Scopes | [`src/lib/api/scopes.ts`](../../src/lib/api/scopes.ts) |

For deeper background, see [`PUBLIC_API_AND_MCP_PLAN.md`](../../PUBLIC_API_AND_MCP_PLAN.md)
and [`MCP_PROD_READINESS_PLAN.md`](../../MCP_PROD_READINESS_PLAN.md).
