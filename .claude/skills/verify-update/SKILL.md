---
name: verify-update
description: Run at the end of a fix or feature session to spin up the app locally and get a focused, click-by-click frontend checklist for what changed. Use when the user says they're done with a change and want to verify it in the browser ("verify this", "let me check it works", "end-of-session check").
---

# Verify Update

End-of-session bridge between "code looks done" and "I've seen it work." Figure out what this
session changed, start the app locally, and hand the user a tight checklist of exactly what to
click and what they should see — derived from the actual diff, not generic advice.

## Steps

### 1. Determine what changed

Run these to scope the session's work:

```bash
git status --short
git diff --stat HEAD
git diff HEAD -- '*.tsx' '*.ts' '*.css'
```

Focus on **user-facing** changes: files under `src/app/**` (routes/pages), `src/components/**`
(UI), and API routes under `src/app/api/**` that the frontend calls. Ignore pure refactors,
tests (`*.test.ts`), migrations, and config unless they change observable behavior.

If the diff is large, group changes by feature/route rather than listing every file.

### 2. Start the app locally

Check nothing is already on the dev port, then start the dev server **in the background** so the
session stays interactive:

```bash
lsof -ti:3000 || echo "port free"
```

Start it with the Bash tool's `run_in_background: true`:

```bash
npm run dev
```

Then poll until it's ready (don't block on a fixed sleep):

```bash
until curl -sf http://localhost:3000 >/dev/null 2>&1; do sleep 1; done; echo "ready"
```

If `npm run dev` fails on missing env vars, tell the user which vars are missing (check
`.env.local`) and stop — there's nothing to verify against a broken boot. Report the boot error
verbatim rather than guessing.

### 3. Produce the verification checklist

For each user-facing change in the diff, write a checklist item with:

- **Where** — the exact URL to open (e.g. `http://localhost:3000/create`, `/drafts`, `/reply`).
  Map the changed file to its route: `src/app/<route>/page.tsx` → `/<route>`; a component →
  whatever page(s) render it (grep imports if unsure).
- **What to do** — the specific interaction that exercises the change (click X, type Y, submit,
  toggle, scroll).
- **What you should see** — the expected result tied to the code you changed, plus the
  before/after if it's a fix.
- **Edge to poke** — one likely failure mode for this specific change (empty state, long input,
  error path, loading/disabled state, mobile width).

Format as a numbered, copy-pastable list grouped by page. Order by what's fastest to reach.
Keep each item to 2–4 lines. Don't pad with generic QA boilerplate ("check the console for
errors" once at the end is enough) — every item should trace back to a real line in the diff.

End with the running dev URL and a note that the server is running in the background (and how to
stop it). If Playwright MCP is available and the user wants, offer to drive the checks in-browser
rather than having them do it by hand.

## Notes

- Default dev URL is `http://localhost:3000` (Next.js + Turbopack, `next dev`).
- This skill verifies **frontend-observable** behavior. It does not replace `/code-review` (bug
  hunting) or the test suite (`npm run test`) — mention those as complements if the change has
  logic worth covering there.
- Leave the dev server running unless the user asks to stop it; they'll want it up while clicking
  through.
