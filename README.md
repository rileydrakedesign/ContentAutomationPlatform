# Agents For X

X (Twitter) content platform: generate posts and replies in your own voice,
schedule and publish them, and track what performs. Next.js 16 app backed by
Supabase, deployed on Vercel.

## Documentation

Full product & integration docs live in **[`docs/`](docs/README.md)**:

- **API** — [getting started](docs/api/getting-started.md) ·
  [auth & scopes](docs/api/authentication.md) · [credits](docs/api/credits.md) ·
  [errors](docs/api/errors.md) · [examples](docs/api/examples.md)
- **MCP** — [overview](docs/mcp/overview.md) · [setup](docs/mcp/setup.md) ·
  [tool tour](docs/mcp/tools.md) · [generated tool reference](docs/mcp/tools.generated.md) ·
  [workflows](docs/mcp/workflows.md) · [troubleshooting](docs/mcp/troubleshooting.md)
- **How it works** — [architecture](docs/architecture/overview.md) ·
  [voice system](docs/architecture/voice-system.md) ·
  [publishing](docs/architecture/publishing.md)
- **Guides** — [tune-up](docs/guides/voice-tuneup.md) ·
  [patterns](docs/guides/patterns.md) · [inspiration](docs/guides/inspiration.md) ·
  [analytics](docs/guides/analytics.md) · [strategy](docs/guides/strategy.md)
- **Reference** — [data models](docs/reference/data-models.md)

The REST API also has an interactive reference at **`/developers`** (Scalar,
driven by [`src/lib/api/openapi-spec.ts`](src/lib/api/openapi-spec.ts)).

## Repository layout

| Path | What it is |
| --- | --- |
| `src/` | The main Next.js app (app.agentsforx.com) — UI, API routes, crons |
| `landing/` | Separate Next.js app for the marketing site + blog |
| `mcp/` | MCP (Model Context Protocol) stdio server wrapping the v1 API |
| `chrome-extension/` | Manifest V3 extension for capturing posts / replying on x.com |
| `supabase/migrations/` | Database schema (start from `00000000000000_baseline.sql`) |

## Requirements

- Node.js >= 20 (see `engines` in package.json)
- npm (the repo commits `package-lock.json`; don't use pnpm/yarn)
- A Supabase project, Stripe account, Upstash (QStash + Redis), and an X
  developer app for full functionality

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in every var — they're documented inline
npm run dev
```

`src/lib/env.ts` validates required env vars at boot: production refuses to
start when any are missing; dev logs a warning so you can work with a subset.

Apply database migrations to your Supabase project in filename order from
`supabase/migrations/` (the baseline file reproduces the original schema;
later files are incremental). With the Supabase CLI: `supabase db push`.

## Scheduled publishing (QStash + cron)

Publishing is driven by two paths that share `src/lib/publish/execute.ts`:

1. **QStash** delivers each scheduled post to `/api/qstash/publish` at its
   scheduled time (signature-verified; needs `QSTASH_*` env vars and
   `QSTASH_PUBLISH_URL` pointing at the deployed route).
2. **Vercel cron** `/api/cron/publish-scheduled` runs every 5 minutes as a
   safety net, recovers posts stuck in `publishing`, and publishes anything
   QStash missed.

Crons are defined in `vercel.json` (voice-refresh daily 04:00,
publish-scheduled every 5 min, analytics-sync daily 06:00, metrics-refresh
daily 07:00). All require the `CRON_SECRET` bearer header; sub-daily schedules
require a Vercel Pro plan.

## Deploy (Vercel)

1. Import the repo into Vercel (root project = the main app; `landing/` can be
   a second Vercel project with its root directory set to `landing`).
2. Set every variable from `.env.example` in Project Settings → Environment
   Variables (incl. both QStash signing keys, Upstash Redis, `SENTRY_DSN`,
   `EXTENSION_ID`).
3. Point the Stripe webhook at `/api/stripe/webhook` and the X app's OAuth
   redirect at `/api/x/callback`.

## Subprojects

- **landing/**: `cd landing && npm install && npm run dev` — independent
  Next.js app with its own lint/build.
- **mcp/**: `cd mcp && npm install && npm run build` — stdio MCP server; auth
  via an API key created in the app's Settings → API Keys.
- **chrome-extension/**: load `chrome-extension/` unpacked, or run its build
  script for a packed build. Production CORS pins the published extension ID
  via the `EXTENSION_ID` env var.

## Scripts

- `npm run dev` — dev server (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint (zero errors policy under `src/`)
- `npx tsc --noEmit` — typecheck
