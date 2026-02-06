# Product Features (Current) — ContentAutomationPlatform ("Agent for X")

> Goal of this document: **document every currently-implemented feature**, why it exists, and **rank it by importance to our Ideal Customer Profile (ICP)**.
>
> Source of truth: the repo’s code + `project.md` (MVP rules) + `IMPLEMENTATION.md`.

---

## 0) Ideal Customer Profile (ICP) used for ranking

**ICP (current, per `project.md`):** a **single creator / indie builder** who posts on **X** (and optionally IG Reels) about **software dev / AI / building in public**, wants a repeatable workflow for:

- turning raw inputs (voice memos, notes, inspirations) into **drafts that sound like them**
- improving quality/consistency using **patterns from their own winners**
- staying **human-in-the-loop** (review + approve), not autoposting

If you want a different ICP (e.g., ghostwriters, agencies, B2B founders), tell me—this ranking will change.

---

## 1) Ranking scale

- **P0 (must-have):** core “idea → draft” loop; without it the product fails.
- **P1 (high):** strong leverage for quality/speed/consistency; major retention driver.
- **P2 (medium):** helpful support features; not a primary purchase driver.
- **P3 (low):** nice-to-have / admin / future wedge.

---

## 2) Feature inventory (ranked, most → least important)

### 1) Voice memo / raw idea ingestion (text transcript) — **P0**
**What:** paste a transcript/idea and save it as a `source`.

**Why it exists:** this is the **highest-frequency input** for the ICP (daily idea capture). It anchors the system in user-owned raw material.

**Where in code:**
- UI: `src/components/create/NewDraftForm.tsx` (transcript submit)
- API: `src/app/api/sources/transcript/route.ts`
- DB: `sources` table (see `IMPLEMENTATION.md`)

---

### 2) Draft generation from voice memo/source(s) (X post / X thread) — **P0**
**What:** generate `X_POST` or `X_THREAD` from one or more sources.

**Why:** core value: convert messy thoughts into publishable writing.

**Where:**
- API: `src/app/api/drafts/generate/route.ts`
- Core gen: `src/lib/openai/generate.ts`, `src/lib/openai/router.ts`, `src/lib/openai/analyzer.ts`
- Draft editor page: `src/app/drafts/[id]/page.tsx`

Notes:
- Supports **legacy pipeline** + **enhanced voice memo pipeline** (`generateFromVoiceMemo`) with fallback for “fragment content”.

---

### 3) Human-in-the-loop draft review/edit + status lifecycle — **P0**
**What:** drafts are created with status `GENERATED`, editable, then can be approved/rejected.

**Why:** explicitly required by `project.md` (no autonomous posting; approval is explicit).

**Where:**
- Draft editor: `src/app/drafts/[id]/page.tsx`
- Drafts API: `src/app/api/drafts/[id]/route.ts` (GET/PATCH/DELETE)
- Draft list: `src/components/create/DraftsList.tsx`

---

### 4) X connection (OAuth) + syncing your posts into the product — **P0/P1**
**What:** connect your X account and sync your tweets into the app.

**Why:** enables performance snapshot + pattern extraction. It makes the system self-improving using **your real winners**.

**Where:**
- OAuth flow: `src/app/api/x/connect/route.ts`, `src/app/api/x/callback/route.ts`, `src/lib/x-api/client.ts`
- Status/disconnect: `src/app/api/x/status/route.ts`
- Sync trigger: `src/app/api/x/sync/route.ts`
- UI: `src/components/settings/SettingsPage.tsx`, Dashboard `src/components/home/HomePage.tsx`

---

### 5) Captured posts system (your posts + inbox triage) — **P1**
**What:** store posts (captured/synced) with metrics and triage labels.

**Why:** creates a durable dataset for insights and pattern learning; enables “my posts” vs “inspiration” separation.

**Where:**
- List: `src/app/api/captured/route.ts`
- Single update/delete: `src/app/api/captured/[id]/route.ts`
- Promote to inspiration: `src/app/api/captured/[id]/promote/route.ts`
- UI:
  - Dashboard recent posts: `src/components/home/HomePage.tsx`
  - Library: `src/components/library/LibraryPage.tsx`
  - Insights tabs: `src/components/insights/*`

---

### 6) Pattern extraction from top posts (and niche posts) — **P1**
**What:** extract reusable patterns (hook styles, formats, timing, topics, engagement triggers) using OpenAI.

**Why:** this is the “content optimization” lever: it turns performance history into actionable writing constraints.

**Where:**
- Extract endpoint: `src/app/api/patterns/extract/route.ts`
- Pattern list/update/delete: `src/app/api/patterns/route.ts`, `src/app/api/patterns/[id]/route.ts`
- Suggestions: `src/app/api/patterns/suggestions/route.ts`
- UI: `src/components/insights/PatternsTab.tsx`, `src/components/home/PatternInsightsSection.tsx`, `src/components/voice/PatternControlsTab.tsx`

---

### 7) “Create from topic + patterns” (fast generation without sourcing flow) — **P1**
**What:** enter a topic, select patterns, generate 3 options.

**Why:** fast daily usage loop when you don’t have a transcript; supports “ship something today.”

**Where:**
- UI: `src/components/create/CreatePage.tsx`
- API: `src/app/api/drafts/generate-from-topic/route.ts`

---

### 8) Inspiration library (style references) — **P1/P2**
**What:** store inspiration posts and optionally apply them as style guidance during generation.

**Why:** helps mimic pacing/hooks/structure without copying; reduces blank-page anxiety.

**Where:**
- Inspiration API: `src/app/api/inspiration/route.ts`, `src/app/api/inspiration/[id]/route.ts`
- Voice inspiration API (separate namespace): `src/app/api/voice/inspiration/*`
- Style prompt assembly: `buildStylePrompt(...)` in `src/lib/openai/*` (wired in `drafts/generate`)
- UI: `src/components/create/StyleSelector.tsx`, `src/components/voice/InspirationTab.tsx`

---

### 9) Voice/Profile tuning (dials, examples, guardrails, preview) — **P1**
**What:** manage “voice settings” + pinned examples; preview outputs using current settings.

**Why:** biggest retention driver for creators: “it sounds like me.”

**Where:**
- Voice UI: `src/components/voice/VoicePage.tsx` and tabs under `src/components/voice/*`
- Settings API: `src/app/api/voice/settings/route.ts`
- Examples CRUD: `src/app/api/voice/examples/*`
- Prompt preview: `src/app/api/voice/prompt-preview/route.ts`
- Preview generation: `src/app/api/voice/preview/route.ts`

---

### 10) Analytics: best times to post (from captured metrics) — **P2**
**What:** compute “best times” recommendations.

**Why:** useful, but secondary to writing quality + distribution.

**Where:**
- API: `src/app/api/analytics/best-times/route.ts`
- UI: `src/components/analytics/BestTimesToPost.tsx`, `src/components/insights/BestTimesSection.tsx`

---

### 11) Niche accounts + niche posts (benchmark dataset) — **P2**
**What:** track accounts/posts in your niche; use them for pattern comparisons.

**Why:** helps creators learn what works in-category; not always necessary early.

**Where:**
- API: `src/app/api/niche-accounts/*`, `src/app/api/niche-posts/*`
- UI: `src/components/voice/NicheAccountsTab.tsx`

---

### 12) Generate-reply (AI replies to a post) — **P2**
**What:** generate reply options to a post.

**Why:** supports engagement/distribution behavior (“reply guy” strategy), but still optional.

**Where:**
- API: `src/app/api/generate-reply/route.ts`

---

### 13) Chrome extension capture pipeline — **P2**
**What:** extension sends captured posts into the app; supports bearer-token auth.

**Why:** makes “capture inspiration / capture my posts” frictionless.

**Where:**
- Capture endpoint: `src/app/api/capture/route.ts`
- Extension code: `chrome-extension/`
- Extension auth endpoints: `src/app/api/auth/login/route.ts`, `src/app/api/auth/refresh/route.ts`

---

### 14) X analytics sync via browser scraping / CSV ingestion — **P2/P3**
**What:** bring richer analytics via scraping or CSV upload.

**Why:** increases accuracy of “what worked” but not needed for MVP writing loop.

**Where:**
- API: `src/app/api/x/analytics-sync/route.ts`
- CSV upload: `src/app/api/voice/csv-upload/route.ts`

---

### 15) Source preprocessing helpers — **P3**
**What:** preprocess transcripts/inputs before generation.

**Why:** quality improvement; mostly invisible.

**Where:**
- API: `src/app/api/sources/preprocess/route.ts`
- Core: `src/lib/openai/preprocessor.ts`

---

### 16) Voice memo audio upload to Supabase storage — **P3 (currently constrained)**
**What:** upload audio files.

**Why:** enables direct capture from phone, but the repo’s docs suggest Apple transcription is the current preferred path.

**Where:**
- API: `src/app/api/sources/voice-memo/route.ts`
- Storage helpers: `src/lib/supabase/storage.ts`

---

### 17) Waitlist landing page for Agent for X — **P3**
**What:** marketing route with email capture.

**Why:** top-of-funnel, not product value.

**Where:**
- UI: `src/app/agent-for-x/page.tsx` (+ `/privacy`, `/terms`)
- API: `src/app/api/waitlist/route.ts` (dev-friendly append)

---

## 3) Cross-cutting “foundational” features (not ranked, but required)

### Authentication (Supabase)
**What:** login/signup, protected routes.

**Where:**
- Middleware gate: `src/middleware.ts`
- Client auth: `src/components/auth/AuthProvider.tsx`
- Login/signup pages: `src/app/login/page.tsx`, `src/app/signup/page.tsx`

### Environment health check
**What:** confirms which env vars exist (no values).

**Where:** `src/app/api/health/route.ts`

---

## 4) Not implemented (explicitly deferred / partially present)

Per `project.md` + `IMPLEMENTATION.md`:
- Autoposting (explicit non-goal)
- Multi-user org features (explicit non-goal)
- Heavy analytics/engagement scoring (out of MVP)
- Background jobs (BullMQ/Redis installed but not fully used)
- Drizzle DB access (schema exists, but Supabase JS is primary)

---

## 5) Open questions (to refine ranking)

1) Is the ICP **still a single creator** (builder-first), or are we pivoting toward **ghostwriters/agencies**?
2) Is “distribution automation” (DM/reply loops, scheduling) in-scope now? (`project.md` currently says no autoposting.)
3) What is the primary output we’re selling next: **before/after writing quality** or **distribution loop**?

If you answer those, I’ll re-rank with more precision and translate this into an execution roadmap.
