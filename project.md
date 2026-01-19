# Content Pipeline MVP — Project Guide for Claude Code

## Purpose
This repository implements an MVP automation pipeline for generating **X posts** and **Instagram Reel scripts** to grow a personal brand focused on **software development, AI, and building in public**.

Claude Code should treat this document as the **source of truth** for:
- Product goals
- Non-goals
- Architecture decisions
- Development rules
- Output constraints
- Iteration philosophy

This project prioritizes **clarity, speed, and human-in-the-loop control** over automation maximalism.

---

## High-Level Product Goals

### Primary Goal
Create a system that:
1. Ingests **raw ideas** (voice memos, inspirations, news)
2. Converts them into **high-quality draft content**
3. Allows **easy human editing and approval**
4. Outputs **publish-ready** content for X and Instagram Reels

### Success Criteria
- Drafts are useful without heavy rewriting
- Content sounds **human, opinionated, and builder-first**
- System is reliable and debuggable
- MVP is usable daily by a single creator

---

## Explicit Non-Goals (MVP)

- ❌ No autonomous posting without approval
- ❌ No complex auth / multi-user systems
- ❌ No heavy analytics or engagement tracking
- ❌ No premature scaling optimizations

If a feature does not directly improve **idea → draft → post**, it is out of scope.

---

## Core Inputs (Sources)

All generated content must trace back to **at least one SourceItem**.

### Source Types

#### VOICE_MEMO
- Audio uploaded by the user
- Transcribed verbatim
- Often messy, exploratory, personal

#### INSPIRATION
- URLs or raw text from X posts, IG Reels, blogs, etc.
- Used for structural and stylistic signals
- May be manually or programmatically collected

#### NEWS
- AI / tech-related articles
- Focus on: what changed, why it matters, who it affects

---

## Core Outputs (Drafts)

### Draft Types
- `X_POST` — single tweet (≤ 280 chars)
- `X_THREAD` — up to 6 tweets
- `REEL_SCRIPT` — 25–40s vertical video script

All drafts must:
- Be opinionated or experiential
- Contain a clear takeaway
- Match the stored **brand voice profile**
- Be validated against strict JSON schemas

---

## Brand Voice Principles (Hard Rules)

Claude must always write as:
- A **builder**, not a marketer
- Curious, practical, slightly opinionated
- Concrete > abstract
- Short sentences > long explanations

### Tone Constraints
- No hype language
- No emojis unless explicitly requested
- No generic motivational fluff
- Avoid clichés (e.g., “game-changer”, “revolutionary”)

### Content Heuristics
- Prefer “what I learned” over “what you should do”
- If referencing tools, mention *why* they matter in practice
- If referencing news, always explain **impact**

---

## Generation Rules (Very Important)

### Inspiration Handling
- Inspiration is used for:
  - Hooks
  - Pacing
  - Structure
- Inspiration should not result in verbatim copying
- Outputs must be novel, transformed, and creator-specific

### News Handling
- Every news-based draft must include:
  - A plain-language summary
  - Why it matters to builders
  - One concrete implication or example

### Voice Memo Handling
- Voice memos are primary signal
- Preserve personal language when possible
- Clean up clarity, not personality

---
## Tech Stack (Authoritative)

Claude must not suggest alternatives unless explicitly asked.

### Frontend
- Next.js (App Router)
- Tailwind CSS

### Backend
- Next.js API routes

### Database
- Supabase Postgres

### ORM
- Drizzle

### Storage
- Supabase Storage (voice memos)

### Jobs / Background Processing
- BullMQ
- Redis

### AI
- OpenAI (transcription + generation)

---

## Development Philosophy

### MVP First
- Prefer simple, explicit code
- Avoid abstractions until needed
- Optimize for readability over cleverness

### Human-in-the-Loop
- Every draft is editable
- Approval is explicit
- Automation assists, never replaces judgment

### Deterministic Behavior
- Inputs → outputs should be explainable
- Logs matter
- Jobs should be retryable and idempotent

---

## Claude Code Instructions

When working in this repo, Claude should:

1. Follow this document before any other assumptions
2. Ask for clarification only when a decision impacts:
   - Data integrity
   - Content quality
   - User control
3. Prefer incremental changes over refactors
4. Keep generated code minimal but production-leaning
5. Default to explicit, reviewable behavior over hidden automation

If uncertain, default to:

> “Make it simple, explicit, and reviewable.”

---

## Future Phases (Not MVP)

These are intentionally deferred:

- Automatic mobile ingestion
- Embeddings / similarity detection
- Full auto-posting workflows
- Analytics and engagement scoring
- Multi-user support

Claude should not implement these unless explicitly instructed.

---

## Guiding Question (Always Ask Internally)

> Does this change make it easier to go from a raw idea to a good post?

If the answer is no, it probably does not belong in the MVP.
