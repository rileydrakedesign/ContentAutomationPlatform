# Deployment & Environments — Source of Truth

> How the app ships and runs. **Updated:** 2026-06-26.

---

## 1. Stack

- **Framework:** Next.js 16 (App Router, Turbopack) — `next.config.ts`.
- **Host:** Vercel (project `riley-drakes-projects/agentsforx`). Linked via `.vercel/`.
- **Data:** Supabase (Postgres + Auth + RLS). Migrations in `supabase/migrations/`.
- **Async/cache:** Upstash QStash (queues) + Redis (rate limits).
- **Payments:** Stripe.
- **AI:** Claude (chat/generation, `CLAUDE_ONLY` path) + OpenAI embeddings
  (`text-embedding-3-small`) for the assistant's L2 scores. See
  [writing-assistant](../features/writing-assistant.md) and [generation](../features/generation.md).

## 2. Deploy flow

- **Production:** push to `main` → Vercel auto-builds and deploys to Production. (Confirmed:
  the pivot push triggered a Production build that went Building → Ready.)
- **Preview:** every other branch/PR gets a preview deployment.
- **Config:** `vercel.json` (crons; see [background-jobs](background-jobs.md)).
- **Validation before push:** `npx tsc --noEmit` · `npx vitest run` · `npm run build`.
  Extension: `cd chrome-extension && node build.js` (+ `node --check`).

## 3. Environments & secrets

- Env contract is documented in `.env.example` and validated at boot by `src/lib/env.ts`
  (production refuses to start without required vars; dev logs a warning).
- Key vars: Supabase URL/keys, Stripe keys + price IDs, Claude/OpenAI keys, Upstash
  (QStash/Redis), X API credentials, `CRON_SECRET`, and the assistant flag
  `NEXT_PUBLIC_WRITING_ASSISTANT` (**on by default**; set `"0"` to force-disable a deploy —
  see `src/lib/assistant/flag.ts`).
- Manage with `vercel env` / the `vercel:env` skill. Never commit real `.env`.

## 4. Database

- Migrations live in `supabase/migrations/` (DDL). Apply order/notes in
  `supabase/MIGRATIONS_TO_APPLY.md`.
- Supabase MCP rule: `apply_migration` = DDL only; `execute_sql` = DML.
- Recent assistant migration: `20260625_assistant_vectors.sql`
  (`user_assistant_vectors`, `assistant_live_reads`).

## 5. Other surfaces

- **Chrome extension** — built with `chrome-extension/build.js` (esbuild bundles the real TS
  assistant engine via `src/engine-entry.ts`); loaded unpacked / packaged from `dist/`. See
  [chrome-extension](../features/chrome-extension.md).
- **MCP server** — published as a package; release workflow `.github/workflows/mcp-publish.yml`.
  See [mcp-and-public-api](../features/mcp-and-public-api.md).
- **Landing site** — `landing/` (separate app). Positioning lags the pivot (known TODO; copy
  lives in `research/marketing-positioning/`).

## 6. Related docs

- [background-jobs.md](background-jobs.md) — cron + queues.
- [billing-plans-and-credits.md](../features/billing-plans-and-credits.md) — Stripe wiring.
- [`research/`](../../research/README.md) — positioning for the landing/MCP surfaces.
