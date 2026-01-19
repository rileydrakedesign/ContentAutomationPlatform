# Content Pipeline - Implementation Documentation

> Last updated: January 2025

## Overview

A content automation pipeline for generating X posts, X threads, and Instagram Reel scripts from raw inputs (voice memo transcripts, inspirations, news articles).

**Core Flow:** `Source → Generate → Review → Approve`

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS |
| Backend | Next.js API Routes |
| Database | Supabase Postgres |
| Storage | Supabase Storage (voice-memos bucket) |
| AI | OpenAI GPT-4 (content generation) |
| ORM | Supabase JS Client (not Drizzle - see notes) |

### Notes
- Drizzle ORM is installed but **not used** due to DATABASE_URL IPv6 connectivity issues
- All database operations use the Supabase JS client instead
- BullMQ/Redis are installed but **not implemented** (background jobs deferred)

---

## Database Schema

### Tables

#### `sources`
Raw input materials for content generation.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| type | ENUM | `VOICE_MEMO`, `INSPIRATION`, `NEWS` |
| raw_content | TEXT | Transcript or text content |
| source_url | TEXT | URL for inspirations/news |
| audio_path | TEXT | Supabase Storage path (voice memos) |
| metadata | JSONB | Additional data (platform, author, etc.) |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

#### `drafts`
Generated content awaiting review.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| type | ENUM | `X_POST`, `X_THREAD`, `REEL_SCRIPT` |
| status | ENUM | `PENDING`, `GENERATED`, `APPROVED`, `REJECTED` |
| content | JSONB | Generated content structure |
| source_ids | UUID[] | References to source materials |
| edited_content | JSONB | Human edits (if any) |
| created_at | TIMESTAMP | Creation time |
| updated_at | TIMESTAMP | Last update time |

### Content Structures (JSONB)

```typescript
// X_POST
{ text: string }

// X_THREAD
{ tweets: string[] }

// REEL_SCRIPT
{
  hook: string,
  body: string,
  callToAction: string,
  estimatedDuration: string
}
```

---

## API Routes

### Sources

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sources` | List all sources |
| POST | `/api/sources/inspiration` | Add inspiration (text/URL) |
| POST | `/api/sources/news` | Add news article |
| POST | `/api/sources/voice-memo` | Upload audio file |
| POST | `/api/sources/transcript` | Add voice memo transcript (text) |

#### POST `/api/sources/inspiration`
```json
{
  "text": "Content text",
  "url": "https://...",
  "platform": "X|Instagram|LinkedIn|Blog|Other",
  "author": "optional"
}
```

#### POST `/api/sources/news`
```json
{
  "content": "Article content",
  "url": "https://...",
  "title": "Article title",
  "author": "optional",
  "publication": "optional"
}
```

#### POST `/api/sources/transcript`
```json
{
  "transcript": "Voice memo transcript text",
  "title": "optional"
}
```

#### POST `/api/sources/voice-memo`
- Content-Type: `multipart/form-data`
- Body: `file` (audio file)

### Drafts

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/drafts` | List all drafts |
| POST | `/api/drafts/generate` | Generate draft from sources |
| GET | `/api/drafts/[id]` | Get single draft |
| PATCH | `/api/drafts/[id]` | Update draft (edit/approve/reject) |
| DELETE | `/api/drafts/[id]` | Delete draft |

#### POST `/api/drafts/generate`
```json
{
  "sourceIds": ["uuid1", "uuid2"],
  "draftType": "X_POST|X_THREAD|REEL_SCRIPT"
}
```

#### PATCH `/api/drafts/[id]`
```json
{
  "status": "APPROVED|REJECTED",
  "editedContent": { ... }
}
```

---

## UI Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard - stats overview, quick actions |
| `/sources` | List sources, add new (inspiration/news/voice memo) |
| `/drafts` | List drafts with status filters |
| `/drafts/generate` | Select sources, choose type, generate draft |
| `/drafts/[id]` | Edit draft content, approve/reject |

---

## File Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout with navigation
│   ├── page.tsx            # Dashboard home
│   ├── globals.css         # Global styles
│   ├── sources/
│   │   └── page.tsx        # Sources list + add forms
│   ├── drafts/
│   │   ├── page.tsx        # Drafts list
│   │   ├── generate/
│   │   │   └── page.tsx    # Generate new draft
│   │   └── [id]/
│   │       └── page.tsx    # Draft editor
│   └── api/
│       ├── sources/
│       │   ├── route.ts           # GET /api/sources
│       │   ├── inspiration/
│       │   │   └── route.ts       # POST
│       │   ├── news/
│       │   │   └── route.ts       # POST
│       │   ├── voice-memo/
│       │   │   └── route.ts       # POST (audio upload)
│       │   └── transcript/
│       │       └── route.ts       # POST (text transcript)
│       └── drafts/
│           ├── route.ts           # GET /api/drafts
│           ├── generate/
│           │   └── route.ts       # POST
│           └── [id]/
│               └── route.ts       # GET, PATCH, DELETE
├── lib/
│   ├── db/
│   │   ├── index.ts        # Drizzle client (unused)
│   │   └── schema.ts       # Drizzle schema (reference only)
│   ├── supabase/
│   │   ├── index.ts        # Exports
│   │   ├── client.ts       # Supabase client
│   │   └── storage.ts      # Storage helpers
│   ├── openai/
│   │   ├── index.ts        # Exports
│   │   ├── client.ts       # OpenAI client
│   │   ├── transcribe.ts   # Whisper transcription (unused)
│   │   └── generate.ts     # Content generation with brand voice
│   └── queue/
│       ├── index.ts        # Exports
│       ├── connection.ts   # Redis connection (unused)
│       └── queues.ts       # BullMQ queues (unused)
└── types/
    ├── index.ts
    └── content.ts          # TypeScript types
```

---

## Environment Variables

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
OPENAI_API_KEY=sk-...

# Optional (not currently used)
DATABASE_URL=postgresql://...  # For Drizzle (IPv6 issues)
REDIS_URL=redis://...          # For BullMQ (not implemented)
```

---

## Brand Voice (Built into Generation)

The OpenAI generation prompt enforces these rules:

**Voice Principles:**
- Write as a builder, not a marketer
- Curious, practical, slightly opinionated
- Concrete > abstract
- Short sentences > long explanations

**Tone Constraints:**
- No hype language
- No emojis (unless requested)
- No generic motivational fluff
- No clichés ("game-changer", "revolutionary")

**Content Heuristics:**
- Prefer "what I learned" over "what you should do"
- Reference tools with practical context
- News requires impact explanation

---

## Current Workflows

### Adding a Voice Memo
1. Record on iPhone Voice Memos app
2. View transcript in app
3. Copy transcript
4. Sources → Voice Memo → Paste Transcript → Save

### Adding Inspiration
1. Sources → + Inspiration
2. Paste content, add URL/platform
3. Save

### Generating a Draft
1. Drafts → Generate New Draft
2. Select content type (X Post, Thread, Reel Script)
3. Select one or more sources
4. Click Generate
5. Redirects to editor

### Reviewing a Draft
1. Drafts → Click draft card
2. Edit content in editor
3. Approve or Reject

---

## Not Implemented (Deferred)

| Feature | Reason |
|---------|--------|
| Audio transcription | Using Apple's built-in transcription instead |
| Background jobs (BullMQ) | MVP uses synchronous operations |
| Drizzle ORM | IPv6 connectivity issues with Supabase direct connection |
| Auto-posting | Explicit non-goal per project spec |
| Multi-user auth | MVP is single-user |
| Analytics | Out of scope for MVP |

---

## Running Locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev -- -p 3003

# Build for production
npm run build

# Start production server
npm start
```

---

## Supabase Setup

1. Tables created via Supabase MCP (migrations in Supabase dashboard)
2. Storage bucket `voice-memos` created
3. RLS is **disabled** (single-user MVP)

---

## Future Considerations

1. **iOS Shortcut automation** - Direct transcript posting from iPhone
2. **Background transcription** - Process audio with Whisper async
3. **Scheduled posting** - Queue approved content for publishing
4. **Content analytics** - Track performance of posted content
5. **Voice input in web UI** - Record directly in browser
