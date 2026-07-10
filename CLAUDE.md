# CLAUDE.md — Agents For X

Real-time writing assistant for X (Twitter). The user writes their own posts and replies;
as they type, the assistant shows where the draft drifts from *their* voice and where it
will lose to the algorithm, and fixes both in one click. AI generation exists only as an
optional on-ramp that seeds the editor — the human keeps the pen.

> Product definition: [docs/product/prd.md](docs/product/prd.md). Doc map: [docs/README.md](docs/README.md).

---

## CRITICAL RULES

- **ALWAYS read the relevant doc in `docs/features/` before modifying a subsystem, and update it after.** Those docs are the engineering source of truth (key files as `path:line`, data model, endpoints, current gaps). Index: [docs/features/README.md](docs/features/README.md).
- **NEVER publish replies via the X API.** Replies are handoff-only (open composer / copy). Posting replies programmatically is an account-safety / ToS decision already made — do not "fix" it.
- **NEVER hand-edit `docs/mcp/tools.generated.md`.** It is generated from the Zod defs in `mcp/src/tools.ts` — regenerate with `cd mcp && npm run gen-docs`.
- **Credit prices and plan limits live in code, not docs.** Change `CREDIT_COSTS` in `src/lib/billing/credits.ts` and plans in `src/types/subscription.ts`; then update the docs that cite them (`docs/api/credits.md`, `docs/features/billing-plans-and-credits.md`).
- **The REST contract is the OpenAPI spec** at `src/lib/api/openapi-spec.ts` (served at `GET /api/v1/openapi.json`, rendered at `/developers`). If you change a v1 route, update the spec — `src/lib/api/openapi-spec.test.ts` catches drift.
- **Database changes go through `supabase/migrations/`** (new dated `.sql` file), applied with the Supabase MCP `apply_migration`. Never mutate schema ad hoc with `execute_sql`. (`supabase/MIGRATIONS_TO_APPLY.md` is a stale one-off artifact — ignore it.)
- **ALWAYS run `npm test` (vitest) and `npm run lint` before suggesting a commit.**
- **NEVER commit secrets.** `.env.local` is gitignored — keep it that way.

## SELF-HEALING RULES

- When code, schema, or API changes, update the affected doc(s) in `docs/` before considering the task complete. New endpoint/table/tool → update the relevant source-of-truth doc.
- When the user corrects your behavior, add a specific rule to **Learned Anti-Patterns** below so it never recurs. Format: `**NEVER** [bad behavior]. Instead, [correct approach].`

---

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) + React | Next 16.1.1, React 19.2 |
| Language / styling | TypeScript 5, Tailwind CSS | v4 |
| Database / auth | Supabase (Postgres + RLS, `@supabase/ssr`) | supabase-js 2.x |
| Editor | ProseMirror | 1.x |
| AI | OpenAI + Anthropic SDKs; Groq/Cerebras for live-read (L3) | see `src/lib/ai/` |
| Jobs / cache | Upstash QStash (cron, queues) + Redis (rate limits) | |
| Billing | Stripe (subscriptions + credit packs) | stripe 20.x |
| Errors | Sentry (`@sentry/nextjs`) | |
| Hosting | Vercel | Node ≥20 |
| Tests | Vitest (`npm test`) | v4 |

## Architecture

| Domain | Entry point | Source-of-truth doc |
|--------|------------|---------------------|
| Real-time writing assistant (L0–L3) | `src/components/` + `src/lib/analysis/` | [features/writing-assistant.md](docs/features/writing-assistant.md) |
| AI generation on-ramps | `src/lib/openai/`, `src/lib/ai/` | [features/generation.md](docs/features/generation.md) |
| Voice engine (dials, examples, patterns, tune-up) | `src/lib/voice/` | [features/voice-engine.md](docs/features/voice-engine.md) |
| Analytics ingest + X-algorithm model | `src/lib/analysis/` | [features/analysis-and-insights.md](docs/features/analysis-and-insights.md) |
| Publishing, queue, scheduling | `src/lib/publish/`, `src/lib/qstash/` | [features/publishing-and-scheduling.md](docs/features/publishing-and-scheduling.md) |
| Reply finder | `src/app/reply/` | [features/reply-finder.md](docs/features/reply-finder.md) |
| Billing, plans, credits | `src/lib/billing/`, `src/lib/stripe/` | [features/billing-plans-and-credits.md](docs/features/billing-plans-and-credits.md) |
| X integration (OAuth, in-house client, sync) | `src/lib/x-api/`, `src/lib/oauth/` | [features/x-integration.md](docs/features/x-integration.md) |
| v1 REST API + MCP server | `src/app/api/`, `mcp/src/` | [features/mcp-and-public-api.md](docs/features/mcp-and-public-api.md) |
| Chrome extension (in-X surface) | `chrome-extension/src/` | [features/chrome-extension.md](docs/features/chrome-extension.md) |

Context you can't infer from code:
- Three clients share one backend, one credit currency, one scope set: **web app**, **v1 REST API** (`/api/v1/...`), **MCP server** (`mcp/`).
- The live-read engine (L3) uses provider fallback (Groq/Cerebras via `LIVE_READ_PROVIDER`), prompt caching, and a session edit ledger + finding budget to prevent suggestion churn — read [features/writing-assistant.md](docs/features/writing-assistant.md) before touching it.
- System narrative: [architecture/overview.md](docs/architecture/overview.md) · [architecture/loop.md](docs/architecture/loop.md).

## Data Model

> Full reference: [docs/reference/data-models.md](docs/reference/data-models.md) (sourced from `src/types/`). Schema: `public`, ~37 tables, 41 migrations in `supabase/migrations/`.

Core tables: `drafts`, `scheduled_posts`, `user_voice_settings` / `user_voice_examples` / `extracted_patterns` (voice engine), `user_analytics` / `prepublish_reads` / `assistant_live_reads` (analysis), `user_credits` / `credit_ledger` / `subscriptions` (billing), `x_connections` / `x_byo_apps` (X auth), `oauth_clients` / `oauth_tokens` / `api_keys` (public API + MCP auth).

## Repo Layout

```
src/
  app/            # Next.js App Router: pages + /api routes (v1 REST under api/v1)
  components/     # React UI (create, drafts, compose, assistant surfaces)
  lib/            # Domain logic: ai, analysis, voice, publish, billing, stripe,
                  #   x-api, oauth, qstash, supabase, api (OpenAPI spec)
  types/          # Shared types — source for docs/reference/data-models.md
  hooks/
mcp/              # Standalone MCP server (own package.json; npm run gen-docs)
chrome-extension/ # In-X surface (own build: build.js)
supabase/migrations/  # Dated SQL migrations
docs/             # Source-of-truth docs (see docs/README.md)
LLM-post-guidelines/  # Prompt/voice content, referenced by src/lib/openai/prompts/
research/         # Strategy / positioning / PMF (maintained separately)
scripts/          # One-off setup scripts (QStash schedule, Stripe credits)
```

## Environment Variables

Names only — values live in `.env.local` / Vercel env.

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL= NEXT_PUBLIC_SUPABASE_ANON_KEY= SUPABASE_SERVICE_ROLE_KEY=
# App
NEXT_PUBLIC_APP_URL= CRON_SECRET= EXTENSION_ID=
# X OAuth + API
X_CLIENT_ID= X_CLIENT_SECRET= X_REDIRECT_URI= X_API_KEY= X_API_SECRET=
# AI providers
OPENAI_API_KEY= CLAUDE_API_KEY= GROK_API_KEY= GROQ_API_KEY= CEREBRAS_API_KEY= LIVE_READ_PROVIDER=
# Jobs / cache / rate limits
QSTASH_TOKEN= QSTASH_CURRENT_SIGNING_KEY= QSTASH_NEXT_SIGNING_KEY= QSTASH_PUBLISH_URL=
UPSTASH_REDIS_REST_URL= UPSTASH_REDIS_REST_TOKEN=
# Stripe
STRIPE_SECRET_KEY= STRIPE_WEBHOOK_SECRET=
```

## Commands

| Task | Command |
|------|---------|
| Dev server | `npm run dev` → http://localhost:3000 |
| Tests | `npm test` (vitest) |
| Lint | `npm run lint` |
| Build | `npm run build` |
| Regenerate MCP tool docs | `cd mcp && npm run gen-docs` |

## Source-of-Truth Documentation

Read the relevant doc **before** modifying a subsystem; update it **after**. Full map and
rot-prone-value pointers: [docs/README.md](docs/README.md).

| Layer | Where | Covers |
|-------|-------|--------|
| Product (why) | [docs/product/](docs/product/) | PRD, current feature catalog, direction |
| Features (how, per subsystem) | [docs/features/](docs/features/README.md) | ⭐ engineering source of truth |
| Architecture (cross-cutting) | [docs/architecture/](docs/architecture/) | overview, loop, voice system, publishing, user journey |
| Reference | [docs/reference/](docs/reference/) | data models, model-call index |
| API / MCP | [docs/api/](docs/api/) · [docs/mcp/](docs/mcp/) | REST + MCP contracts and how-tos |

## Agent Instructions

- **Search before create** — never create `-v2` / `-copy` / `-new` file variants; edit existing files.
- **Read before modify, update after modify** — the `docs/features/` doc for the subsystem you touch.
- **Stage by name** — never `git add -A` / `git add .`.
- **Keep diffs minimal** — match surrounding code style; don't refactor beyond the task.
- **Use Supabase MCP tools** for database inspection and migrations, not raw psql.

### Learned Anti-Patterns

<!-- Add entries when a correction happens. Format: **NEVER** [bad thing]. Instead, [correct thing]. -->
