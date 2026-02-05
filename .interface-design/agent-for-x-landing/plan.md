# Agent for X — Landing page plan

## Goal
A minimal, high-signal landing page for **Agent for X** with a single primary CTA: **email waitlist signup**.

## Constraints
- This repo is a Next.js app with auth + app shell.
- Marketing page must be public (no auth redirect).
- Keep it minimal: one hero, one form, lightweight proof.

## Primary CTA
- Waitlist email capture (front and center)

## URL
- `/agent-for-x` (public)

## Data
- `POST /api/waitlist` stores signups in Postgres (`waitlist_signups`).

## Next
- Tighten copy once you confirm the exact promise.
- Replace placeholder privacy/terms with real links.
- Add a small “how it works” block + a single screenshot/proof asset when available.
