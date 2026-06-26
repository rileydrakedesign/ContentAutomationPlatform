# Agent for X (ContentAutomationPlatform) — Project Guide

This file exists so future agents/devs don’t hallucinate the product direction.
If reality changes, update this.

## Product direction (current)
**Extension-first X growth assistant**.

Primary value:
- save posts/inspiration from X (dataset building)
- generate high-quality **replies** quickly (reply agent)
- voice editing + guardrails
- patterns/suggestions grounded in real metrics
- publish now + schedule via queue

Secondary value:
- generate drafts from topics + patterns

## What we ditched / deprioritized
- Voice memo → transcript ingestion as the primary loop (legacy code may exist, but not the focus).
- “News ingestion” as a primary workflow.

## Sources of truth
- Feature inventory (code-derived): `PRODUCT_FEATURES.md` (also mirrored under `docs/agent-for-x/`).
- Supabase migrations: `supabase/MIGRATIONS_TO_APPLY.md`.

## Core tables (conceptual)
- `captured_posts`: canonical posts stream (your own posts + saved inspiration intake)
- `inspiration_posts`: curated/analyzed inspiration library used by Create
- `drafts`: generated content for human review
- `scheduled_posts`: queue rows (linked to BullMQ jobs)
- `user_analytics`: uploaded CSV analytics

## Hard rules for changes
- Keep everything **explicit and reviewable**.
- Prefer defense-in-depth (`user_id` scoping in code) even when RLS exists.
- Publishing must backfill `captured_posts` so insights/voice/patterns stay consistent.

## Guiding question
Does this change strengthen the extension-first loop (save → reply/draft → review → publish) without breaking data integrity?
