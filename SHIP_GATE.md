# SHIP GATE — Production Readiness (goal mode)

> **How to use:** paste the `/goal` command from the GOAL COMMAND section below
> (requires Claude Code v2.1.139+). Goal mode re-runs turns until a separate
> evaluator model confirms the condition is met. The evaluator reads ONLY the
> conversation transcript — it cannot open this file or run commands — so every
> turn MUST end with the printed GATE STATUS block defined below. This file is the
> persistent work state: checkboxes survive context compaction and `--resume`.

---

## GOAL COMMAND (paste this verbatim)

```
/goal The app is production-ready per SHIP_GATE.md. The condition is met ONLY when the current turn's transcript shows all five gates: (1) `grep -cE '^- \[ \]' SHIP_GATE.md` prints 0 — every checklist item is [x] done or [~] handed off; (2) `npm run build` completes with "Compiled successfully" and no type errors; (3) `npx tsc --noEmit` prints no errors; (4) `npm run lint` output shows zero errors in files under src/; (5) `git status --porcelain` prints nothing. Process: work SHIP_GATE.md items strictly in order (BLOCKERS → HIGH → MEDIUM → HUMAN-ONLY → VERIFY) following its PER-TURN PROTOCOL — re-verify each finding in code before fixing, fix minimally, verify concretely, mark the checkbox with a done-note, commit each item. Mark items needing dashboard/credential access [~] with an explicit handoff instruction; never silently skip. Never disable or weaken checks to satisfy gates: no ignoreBuildErrors, no eslint-disable sweeps, no deleting validation, no editing gate commands or this condition's checklist semantics. End EVERY turn by printing the GATE STATUS block (remaining unchecked count via the grep above; once it is 0, also run gates 2-5 and print their full output).
```

(~1,500 chars — well under the 4,000 limit. Check progress anytime with bare
`/goal`; abort with `/goal clear`.)

## PER-TURN PROTOCOL

1. **Read this file first.** Work unchecked `- [ ]` items strictly in section
   order: BLOCKERS → HIGH → MEDIUM → HUMAN-ONLY → VERIFY. Complete as many items
   as you can **properly verify** this turn — don't rush items to inflate count.
2. **Re-verify each finding before fixing** — read the cited code. If already
   fixed or the finding is wrong, mark `[x]` with a note saying exactly that.
3. **Fix minimally and in-pattern.** Match existing code style. No drive-by
   refactors, no scope creep beyond the item.
4. **Verify concretely** after each item: `npx tsc --noEmit` plus a targeted
   check (read the diff, curl the route, run the script). Record HOW in the note.
5. **Update this file**: `[ ]` → `[x]`, append ` — done: <what/how verified>` on
   the same line. For items requiring human/dashboard access: `[ ]` → `[~]`,
   append ` — HANDOFF: <exact instruction for the human>`.
6. **Commit each completed item** together with this file:
   `fix(ship-gate): <id> <summary>`.
7. **Honor stated orderings** (e.g. H3 requires B2 first). If the previous turn's
   evaluator feedback names a failed gate, address that first.
8. **Never** disable checks to pass them — no `ignoreBuildErrors`, no
   eslint-disable sweeps, no deleting tests/validation, and never edit the GATE
   STATUS commands or checkbox grammar of this file to game the grep. That is
   failure, not progress.
9. **End every turn with the GATE STATUS block** (the evaluator sees only this):

   ```
   GATE STATUS
   unchecked items: <output of grep -cE '^- \[ \]' SHIP_GATE.md>
   completed this turn: <ids>
   next up: <id>
   ```
   When unchecked items = 0, additionally run and print full results of:
   `npm run build` && `npx tsc --noEmit` && `npm run lint` &&
   `git status --porcelain`.

---

## BLOCKERS

- [x] **B1. Build fails from working tree** — `landing/` is swept into the root
  app typecheck. Add `landing` to `exclude` in root `tsconfig.json`. Verify:
  `npm run build` exits 0. — done: added "landing" to tsconfig exclude; `npm run build` prints "✓ Compiled successfully in 7.9s".
- [x] **B2. Double-publish race** — `src/lib/publish/execute.ts:24-29` sets
  `status='publishing'` without `WHERE status='scheduled'` and ignores rows
  affected. Make it an atomic compare-and-swap (`.update(...).eq("id", id)
  .eq("user_id", userId).eq("status", "scheduled").select()`) and abort if 0 rows
  returned. Apply the same TOCTOU fix in `src/app/api/qstash/publish/route.ts` and
  the loop in `src/app/api/cron/publish-scheduled/route.ts`. Reference pattern:
  the CAS in `src/lib/x-api/client.ts:171`. — done: claim in executeScheduledPost is now
  `.eq("status","scheduled").select()` aborting on 0 rows; both the QStash route and the
  cron loop delegate to executeScheduledPost, so the CAS guards every path (their own
  status checks remain as fast-path skips). Verified via tsc + reading the diff.
- [x] **B3. Stuck-`publishing` posts dropped forever** — add recovery: in
  `cron/publish-scheduled`, also select rows with `status='publishing'` older than
  ~10 min and transition them to `failed` with an error message (visible + retryable
  in the queue UI). Do NOT auto-republish (tweets may have partially posted). — done:
  cron now flips `publishing` rows with `updated_at` >10 min old to `failed` with an
  explanatory error, returns `recovered` count; never republishes. executeScheduledPost
  touches `updated_at` on every thread-tweet progress write so active publishes aren't
  reaped. Verified via tsc + reading the diff.
- [x] **B4. Thread retry double-posts** — `src/lib/publish/execute.ts:54-58`:
  persist successfully-posted tweet IDs on the row as each thread tweet posts; on
  retry, resume from the first unposted tweet instead of re-posting from index 0.
  Same flaw in `src/app/api/publish/now/route.ts:86-97`. — done: execute.ts persists
  `posted_post_ids` after each tweet and resumes the loop at index `postedIds.length`
  (captured_posts backfill only covers newly posted). publish/now is stateless, so on
  mid-thread failure it now backfills the posted prefix and returns 500 with
  `postedIds`/`failedAtIndex`/`remainingTweets` so callers resume instead of re-posting.
  Verified via tsc + reading the diff.
- [x] **B5. Schema not reproducible** — dump the live schema into a baseline
  migration: use Supabase MCP/`pg_dump --schema-only` to create
  `supabase/migrations/00000000000000_baseline.sql` covering the ~11 ad-hoc tables
  (`x_connections`, `x_oauth_requests`, `api_keys`, `user_voice_settings`,
  `user_voice_examples`, `inspiration_posts`, `extracted_patterns`,
  `captured_posts`, `drafts`, `user_settings`, `generation_feedback`). `[~]` with
  handoff if no DB access from this session. — done: generated baseline from live
  pg catalogs (columns/constraints/indexes/enums/RLS+policies for all 11 tables;
  no triggers exist on them); idempotent (IF NOT EXISTS / DROP POLICY IF EXISTS).
  Verified by executing the entire file against the live DB inside BEGIN…ROLLBACK
  via Supabase MCP — zero errors.
- [x] **B6. `generation_feedback` RLS unknown** — verify RLS is enabled with
  own-row policies on `generation_feedback` (via Supabase MCP `execute_sql` on
  `pg_policies`); if missing, write + apply an RLS migration matching the pattern
  in `supabase/migrations/20260325_rls_security_hardening.sql`. — done: verified via
  pg_class/pg_policies — RLS enabled, policy "Users manage own feedback" FOR ALL
  USING/WITH CHECK (auth.uid() = user_id). No migration needed.
- [x] **B7. packageManager conflict** — uncommitted `"packageManager": "pnpm@..."`
  in `package.json` vs committed npm `package-lock.json`. Remove the pnpm field
  (repo is npm). Verify `git diff package.json` is clean of it. — done: removed the pnpm packageManager field; `git diff package.json` shows only the removal.
- [x] **B8. Dirty working tree** — commit or discard all remaining modified files
  (tour/onboarding + chrome-extension diffs were audited as complete and
  committable). Verify `git status --porcelain` only shows ignored/intentional
  files. Do not commit screenshots, `waitlist_signups.dev.jsonl`, or worktree dirs
  — see H9. — done: committed app/tour/extension/x-api diffs + docs/blog/logo in two
  commits; debris handled in H9. `git status --porcelain` now shows only
  drizzle.config.ts (untracked, deleted by M6). 42MB landing-page-assets/ media kept
  local and gitignored rather than committed.

## HIGH

- [x] **H1. Stripe webhook loses claimed events** —
  `src/app/api/stripe/webhook/route.ts:228-236`: on processing failure the event is
  already claimed in `stripe_events` and a 200 is returned, so Stripe never
  retries. Fix: delete the `stripe_events` claim row in the catch block and return
  500 so Stripe retries (or claim only after successful processing). — done: catch
  block now deletes the claim row and returns 500. ALSO found+fixed: the
  `stripe_events` table did not exist on the live DB (20260430 migration was never
  applied — every webhook would 500 at the claim insert); applied it via Supabase
  MCP and verified `to_regclass('public.stripe_events')` is non-null. tsc clean.
- [x] **H2. No error tracking** — add Sentry (`@sentry/nextjs`) wired into
  `instrumentation`, `src/app/error.tsx`, `global-error.tsx`, the Stripe webhook
  catch, `executeScheduledPost` failures, and cron route catches. DSN via env
  (`SENTRY_DSN`), no-op when unset. `[~]` note for creating the Sentry project +
  setting the DSN in Vercel. — done: installed @sentry/nextjs; added
  src/instrumentation.ts (register + onRequestError) and
  src/instrumentation-client.ts (NEXT_PUBLIC_SENTRY_DSN + onRouterTransitionStart);
  captureException in error.tsx, global-error.tsx, webhook catch (tagged with event
  id/type), executeScheduledPost catch, and all 4 cron catches. `enabled` is gated
  on the DSN env so it's a no-op when unset. Verified: build + tsc clean. Project
  creation + DSN env remains HU6's handoff.
- [x] **H3. Publish safety-net cron is daily** — change `vercel.json`
  `publish-scheduled` schedule to `*/5 * * * *`. ONLY do this after B2 is checked
  (CAS prevents the double-publish the frequent cron would otherwise amplify).
  Note in HANDOFF: requires Vercel Pro for sub-daily crons — confirm plan (HU1).
  — done: schedule changed after B2's CAS landed; verified by reading vercel.json.
  HANDOFF reminder: sub-daily crons need Vercel Pro — confirm under HU1.
- [ ] **H4. `/api/auth/login` unthrottled** — add per-IP + per-email rate limiting
  (reuse `@upstash/ratelimit` from `src/lib/api/rate-limit.ts`, e.g. 5/min/IP,
  10/hr/email) to `src/app/api/auth/login/route.ts` and `auth/refresh`. Return a
  generic error message on failed login (no Supabase error passthrough). Must fail
  OPEN if Redis is unconfigured in dev, fail CLOSED in production (match existing
  rate-limit.ts behavior).
- [ ] **H5. No env validation** — create `src/lib/env.ts` that validates required
  server env vars at boot (imported from `instrumentation.ts` or next.config) and
  throws a single clear error listing ALL missing vars. Cover: Supabase (URL, anon,
  service role), Stripe (secret, webhook secret, price ID), QStash (token, publish
  URL, both signing keys), Upstash Redis (URL, token), X OAuth (client id/secret),
  OpenAI/Anthropic keys, `CRON_SECRET`, `NEXT_PUBLIC_APP_URL`.
- [ ] **H6. `.env.example` incomplete** — document all ~30 vars read by
  `src/`, grouped with comments (the QStash section header currently has zero vars
  under it). Cross-check by grepping `process.env.` across `src/`.
- [ ] **H7. X tokens readable from the browser** — `x_connections` has a client
  SELECT policy exposing plaintext `access_token`/`refresh_token` to any XSS.
  Write a migration replacing the SELECT policy with one excluding token columns
  (column-level: revoke SELECT on token columns from `authenticated`, or move
  tokens to a service-role-only table). Verify no client code reads them
  (`grep -r "x_connections" src/components src/lib/supabase`).
- [ ] **H8. No security headers** — add `headers()` to `next.config.ts`:
  `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy: camera=(), microphone=(), geolocation=()`, and a
  Report-Only CSP to start. Verify with `npm run build` + reading the config.
- [x] **H9. PII + debris in repo root** — delete `waitlist_signups.dev.jsonl`,
  root `*.png` screenshots, `CONSOLE_OUTPUT.md`; add `.gitignore` rules for
  `*.dev.jsonl`, root screenshots pattern, `.claude/worktrees/`. Verify with
  `git status` + `ls`. — done (with B8): deleted the jsonl, 19 root pngs,
  CONSOLE_OUTPUT.md; .gitignore now covers *.dev.jsonl, /*.png (except /icon.png),
  .claude/worktrees/, landing-page-assets/. Verified: 0 pngs in root,
  `git status --porcelain` shows none of them.
- [ ] **H10. `user_analytics.posts` unbounded JSONB** — add a retention cap in the
  merge paths (`src/app/api/analytics/csv/route.ts:296-339` and
  `src/app/api/cron/analytics-sync/route.ts:105`): keep most recent N posts
  (e.g. 2000) sorted by date after merge. Keep `weightedEngagement` consumers
  working (they read this blob).

## MEDIUM

- [ ] **M1. Stripe out-of-order events** — guard `customer.subscription.*`
  handlers: skip the upsert if stored `updated_at` is newer than `event.created`
  (store event timestamp on the row).
- [ ] **M2. Unknown price ID defaults to `"pro"`** — webhook plan resolution
  (`route.ts:124,155,184,211`): log loudly + keep existing stored plan (or map to
  free) instead of silently granting pro on lookup failure.
- [ ] **M3. Dunning grace too generous** — `src/types/subscription.ts:76-88` /
  webhook `subscription.deleted` handler: on involuntary cancellation (dunning),
  revoke at event time instead of honoring the unpaid `current_period_end`.
- [ ] **M4. Cron analytics-sync ungated** — `src/app/api/cron/analytics-sync/route.ts:29-44`
  syncs every `x_connections` row regardless of plan. Filter to users whose
  effective plan includes `xApiSync` (reuse the gate logic server-side). Also
  DECIDE: schedule `analytics-sync`/`metrics-refresh` in `vercel.json` or delete
  both routes — don't leave dead authenticated endpoints.
- [ ] **M5. Token refresh HTTP race** — `src/lib/x-api/client.ts:125`: wrap the
  refresh HTTP call so an `invalid_grant` triggers the existing re-read-from-DB
  recovery path (another process may have already rotated the token) instead of
  failing the publish.
- [ ] **M6. Delete dead BullMQ system** — remove `scripts/publish-worker.mjs`,
  `src/lib/queue/`, the `worker:publish` script, and `bullmq`/`ioredis` deps
  (verify nothing imports them first: `grep -r "lib/queue\|bullmq\|ioredis" src/ scripts/`).
  Also drop the legacy `job_id` select in `src/app/api/publish/list/route.ts:21`,
  vestigial `drizzle.config.ts` + `run-migration.mjs`, and the deprecated
  voice-memo/reels dead code (`src/lib/openai/transcribe.ts`,
  `prompts/voice-memo-instructions.ts`, memo branches, `REEL_SCRIPT` type usages).
- [ ] **M7. Shared fetch wrapper** — add `src/lib/utils/apiFetch.ts` that checks
  `res.ok`, redirects to `/login` on 401, and throws a typed error; adopt it in the
  worst offenders: `HomePage.tsx`, `QueuePage.tsx` (incl. surfacing cancel/retry
  failures to the user), `ApiKeysTab.tsx`. Full adoption can be incremental.
- [ ] **M8. AI route timeouts** — set `export const maxDuration = 60` on the AI
  routes (`drafts/generate-from-topic`, `generate-reply`, `voice/chat`,
  `voice/preview`, `insights-chat`, `niche/analyze`) and pass an explicit
  `timeout` (~45s) + bounded `maxRetries` to the OpenAI/Anthropic client configs.
- [ ] **M9. CORS + health hardening** — pin the published extension ID in
  `src/lib/cors.ts:13` (env var `EXTENSION_ID`, fallback to current behavior in
  dev only); make `/api/health` return only `{status:"ok"}` publicly (env
  enumeration behind `CRON_SECRET`).
- [ ] **M10. Pagination on list routes** — add `.limit()` (+ optional cursor) to
  `captured`, `drafts`, `inspiration`, `patterns`, `extension/replies` list
  routes, mirroring the v1 routes' pattern. Verify UI callers still render.
- [ ] **M11. Lint errors to zero** — fix the 989 lint **errors** in `src/`
  (`prefer-const`, `no-explicit-any`, unused vars; `--fix` where safe). Warnings
  may remain. Verify gate 4.
- [ ] **M12. Hygiene** — add `"engines": {"node": ">=20"}` to all 3 package.jsons;
  replace boilerplate README with real setup/deploy docs (env vars, Vercel, crons,
  QStash, landing/ + mcp/ subprojects); migrate `middleware.ts` to the `proxy`
  convention Next 16 expects (or note the deprecation timeline).
- [ ] **M13. Subscriptions integrity** — migration: `UNIQUE` on
  `subscriptions.stripe_customer_id`; partial index on
  `scheduled_posts (scheduled_for) WHERE status='scheduled'`.

## HUMAN-ONLY (mark `[~]` with a precise handoff note — not automatable from this repo)

- [ ] **HU1.** Confirm Vercel plan supports `maxDuration: 300` + sub-daily crons.
- [ ] **HU2.** Verify all prod env vars set in Vercel (use the completed
  `.env.example` from H6 as the checklist), incl. QStash signing keys and Redis.
- [ ] **HU3.** Create a separate dev Supabase project; stop developing against prod
  (`hfoypwvlazficzvxwakb`). Confirm backups/PITR enabled on prod.
- [ ] **HU4.** Confirm all `supabase/migrations/` files are actually applied to the
  live DB (compare against `pg_dump` baseline from B5).
- [ ] **HU5.** Stripe dashboard: webhook endpoint events list matches handled set;
  live-mode keys + price ID in prod; Stripe Tax activated.
- [ ] **HU6.** Create Sentry project + set `SENTRY_DSN` in Vercel (pairs with H2).
  Configure a QStash failure callback / monitor the DLQ in Upstash console.

## VERIFY (final items — only when everything above is `[x]`/`[~]`)

- [ ] **V1.** Spawn a fresh subagent to adversarially review the publish-pipeline
  changes (B2–B4, H3, M5): confirm no status transition lacks a CAS guard and no
  path can re-post already-posted tweet IDs. Fix anything it finds before checking
  this off.
- [ ] **V2.** Spawn a fresh subagent to adversarially review the security changes
  (H4, H7, H8, M9): headers present in a build, login rate limit fails closed in
  prod, no client path can select X token columns. Fix anything it finds first.
- [ ] **V3.** Run all five gates and print full results in the GATE STATUS block:
  `grep -cE '^- \[ \]' SHIP_GATE.md` (must be 0), `npm run build`,
  `npx tsc --noEmit`, `npm run lint`, `git status --porcelain`. If any fail, add
  a new checklist item for the failure and fix it before checking this off.
