# Phase 2 Handoff — Broken / Half-Built Features

You are picking up Agents For X pre-launch work. Phase 1 (security + billing) is complete and committed. Your job is Phase 2: the broken and half-built features.

Working directory: `/Users/rileydrake/Desktop/content_automation`. Branch: `main`. The repo is a Next.js 16.1.1 app (Turbopack) on Supabase. There's a separate Next app under `landing/` for marketing — don't touch it unless an item explicitly says so.

## Read these first (in order)

1. `BACKLOG.md` — the authoritative list. The `## Progress log` table near the top tells you what's already shipped. Items marked `[x]` are done; `[ ]` are open.
2. The two most recent commits (`git log -2`) — see exactly what Phase 1 changed and the conventions used.
3. `~/.claude/projects/-Users-rileydrake-Desktop-content-automation/memory/MEMORY.md` — auto-memory with key conventions (engagement weights, Supabase MCP DDL/DML split, Turbopack build is fast, etc).

## What is already done (do not redo)

- **SEC-1 → SEC-7**: all P0 security ship-blockers (commit `114416ea`).
- **MONEY-1 → MONEY-15** except MONEY-14: all billing fixes including Business plan removal, Pro at $29, Stripe Tax, idempotent webhook, grace on cancel (commits `18a6a338`, `50071267`).
- MONEY-14 is intentionally deferred — it's the same `alert()` work tracked under OBSERVE-3 (toast component).

## Phase 2 scope (P0 first, then P1)

The following are open and in-scope for this phase. Reference the full item text in `BACKLOG.md` — line numbers, file paths, and acceptance criteria are there.

### P0 — start here

| ID | Effort | Notes |
|---|---|---|
| **EXT-1** | tiny (1-line) | Extension save hits `/api/inspiration` (paid AI) instead of `/api/capture`. Free user burns 5 generations in 5 saves. Highest-leverage fix in the entire phase. |
| **LIBRARY-2** | small | `.single()` throws on first-run users with no `user_analytics` row. Crashes the dashboard for new signups. Use `.maybeSingle()`. |
| **LIBRARY-3** | small | `confidence_score` rendering bug — stored 0–1, rendered without the ×100. Every pattern shows 0% or 100%. |
| **LIBRARY-4** | small | Same `.single()` bug pattern in `/api/analytics/best-times`. |
| **LIBRARY-5** | small | Verify whether `BestTimesToPost.tsx` should exist or product docs are wrong. May be a doc-only fix. |
| **PUBLISH-1** | medium | Atomic claim to prevent QStash + cron double-posting. Needs an atomic `UPDATE … RETURNING` in both publish paths. |
| **PUBLISH-2** | medium | Thread publish has no rollback / partial-publish state. |
| **LIBRARY-1** | large | `/library` is dead code — wrapper around inspirations tab. Build the captured-posts grid + pagination + triage. The component is already in `PostCard.tsx` (also dead). |
| **VOICE-1** | medium | `/api/voice/csv-upload` parses but doesn't persist to `user_analytics.posts`. Decide whether to unify with `/api/analytics/csv` (which does persist) or fix in place. **Read both before deciding.** |
| **VOICE-2** | small | `/api/voice/preview` uses a divergent prompt builder — preview lies. Call `assemblePrompt()` like production. |
| **VOICE-3** | tiny | `RefreshButton` is dead UI. Mount it in voice header or delete component + `/api/voice/refresh`. |
| **EXT-2** | medium-hard | Reply injection uses `document.execCommand('insertText')` against X's Draft.js editor. Needs `InputEvent` with `inputType: "insertText"`. May require browser experimentation. |
| **EXT-3** | unknown | "Niche account watch" feature is in product copy but has zero code. Either build it or strike from the public feature list. **Recommend striking** unless the user pushes back. |
| **X-1** | small | `/api/x/status` cannot detect expired/revoked tokens. Call `/2/users/me` or check `access_token_expires_at`. |
| **X-2** | medium | `/api/x/sync` caps at 100 tweets, no pagination. |
| **X-3** | small | Two competing analytics-sync paths writing to different tables. Pick one canonical or document the split. |
| **ONBOARD-1** | medium | No password reset flow. Add `/forgot-password` + `/reset-password` + Supabase reset email. |
| **ONBOARD-2** | tiny | `/drafts` index doesn't exist; `drafts/[id]/page.tsx:303` back-link 404s. Either create the page or change the back-link to `/create?tab=drafts`. |

### P1 — after P0s land

The remaining P1s in `LIBRARY`, `EXT`, `VOICE`, `PUBLISH`, `X`, `ONBOARD` sections of `BACKLOG.md`. About 30-40 items, mostly small. Group by file and batch.

## Conventions Phase 1 established (follow these)

1. **Stay in scope.** The agreed-on batch is the agreed-on batch — don't sweep up adjacent items even if they're trivial. The user pushed back on this once already.
2. **Stage only files you touched.** The repo has a lot of pre-existing dirty state (`chrome-extension/manifest.json`, `src/components/home/HomePage.tsx`, etc.). `git add <specific-files>`, never `git add -A` or `git add .`.
3. **Typecheck before committing.** `npx tsc --noEmit | grep -v "landing/src/app/blog"` should be empty. The 13 blog errors are pre-existing (DEAD-1 / CUT-3); ignore them.
4. **One commit per logical batch**, message format: `<type>(<scope>): <summary>` — e.g. `fix(library): close LIBRARY-1..LIBRARY-5`. Add Co-Authored-By trailer for Claude. Use HEREDOCs for multi-line messages.
5. **Update `BACKLOG.md` as you go**: flip `[ ]` → `[x]` and add a row to the `## Progress log` table at the top. Same commit as the fix.
6. **Migrations follow `supabase/migrations/YYYYMMDD_<name>.sql`.** Phase 1 added `20260430_stripe_events.sql` and `20260430_subscription_cancel_at_period_end.sql`. Don't apply them yourself — the user applies via their normal flow. Mention them in the commit message.
7. **Use `TaskCreate` / `TaskUpdate`** to track each item. Mark in_progress when starting, completed when done. Don't batch.
8. **Engagement scoring**: always use `weightedEngagement()` from `@/lib/utils/engagement`. Replies 5×, retweets/reposts 4×, likes/bookmarks 3×, impressions 0.001×. Several Phase 2 items (e.g. `LIBRARY-13`, `VOICE-15`) involve replacing ad-hoc engagement math with this canonical helper.
9. **Don't add tests, comments, docstrings, or backwards-compat shims** unless they exist for a non-obvious reason. Codebase style is terse.
10. **Ask before destructive or wide-blast actions** (DB writes outside a migration, force pushes, deleting whole directories like `landing/src/app/blog/`). Ask before product/UX decisions you can't infer.

## Things that bit me in Phase 1

- **Audit recommended `/` as a public middleware path.** Wrong for this app — `/` is the dashboard, marketing lives in `landing/`. Always sanity-check audit recommendations against what's actually in `src/app/`.
- **`document.execCommand('insertText')`** is referenced in EXT-2 — this is what Phase 2 needs to replace. Before touching, read `chrome-extension/src/content/content.js:1517-1624` and try the InputEvent approach in a real browser tab; X's editor is finicky.
- **`.env.production` is now gitignored** but still on disk for local builds. Don't recommit it.
- **The `landing/` Next app is separate.** It has its own deps, env, deploy. Phase 2 items shouldn't need to touch it.
- **`tsc` reports 13 errors in `landing/src/app/blog/*`** — pre-existing, tracked as DEAD-1 / CUT-3. Don't try to fix; the user has decided to delete that subtree later.

## Pre-deploy checklist (the user owns these — do not run them)

These are the deploy gates from Phase 1 the user still has to do before promoting `main`. If the user mentions deploying, remind them:

1. **Vercel env**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_APP_URL` must be set (now hard-required, no fallbacks).
2. **Apply migrations**: `20260430_stripe_events.sql`, `20260430_subscription_cancel_at_period_end.sql`.
3. **Stripe**: activate Stripe Tax; create new $29 Pro price; update `NEXT_PUBLIC_STRIPE_PRO_PRICE_ID`; remove `NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID`; confirm webhook subscribes to `checkout.session.completed`, `customer.subscription.{created,updated,deleted}`, `invoice.payment_{succeeded,failed}`.

## Recommended first move

Open with: "I've read BACKLOG.md and the last two commits. I'd recommend starting with EXT-1 (1-line, instant impact), then sweeping LIBRARY-2/3/4 (small bug-fix batch — same file pattern), then PUBLISH-1 (the highest-stakes data-integrity P0). Sound good or want a different starting point?"

Then wait for the green light before writing code. Do not start with "let me explore the codebase" — Phase 1's exploration is already in `BACKLOG.md`.
