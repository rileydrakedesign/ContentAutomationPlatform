# Product Features (Current) — ContentAutomationPlatform (Agent for X)

This is an **implementation-based** feature inventory.

- I derived this from the **actual code paths** in `src/` and `chrome-extension/`.
- I am *not* using repo docs as the source of truth for what’s “in” or “out” (except to clarify naming).

---

## ICP assumption used for ranking (you can override)

**ICP (as you just clarified):** an X power-user who spends most of their time **inside X**, wants to:

- save inspiration posts *in the moment* (browser → one click)
- generate high-quality, on-voice **replies** quickly (reply agent)
- maintain a **voice system** (examples + settings) so outputs stay consistent

---

## Ranking scale

- **P0:** the product’s core wedge / daily driver
- **P1:** major leverage; strong retention driver
- **P2:** useful support; not the primary reason they buy
- **P3:** nice-to-have / legacy / incomplete / not aligned to current ICP

---

## Feature inventory (ranked: most → least important)

## 1) Chrome extension: save posts to your pipeline (one-click) — **P0**
**What it does:** injects a “save” button on X posts; saves the post (URL, author, text, metrics, timestamp) into your backend via `/api/capture`.

**Why it exists (product reason):** the main workflow happens *where the user already is* (X). Capturing inspiration in-context beats any separate “library” UI.

**Where in code:**
- Extension content script UI injection + extraction: `chrome-extension/src/content/content.js`
- Extension background API call: `chrome-extension/src/background/background.js` (`SAVE_POST` → `/api/capture`)
- Server capture endpoint: `src/app/api/capture/route.ts`

**Notes:**
- Duplicate prevention: server returns `409` and extension treats it as `DUPLICATE`.
- Handles auth via Bearer token (extension-managed).

---

## 2) Chrome extension: AI reply agent (tone picker + inject into composer) — **P0**
**What it does:** injects a reply button (split button + tone dropdown). On click, it:
1) extracts rich context (parent post, quoted tweet, link card, media alt) from the DOM
2) calls backend `/api/generate-reply`
3) displays 3 reply options (with “approach” labels)
4) on “Use this reply”, opens X reply composer and injects the reply text

**Why it exists:** this is the highest-frequency value loop for growth: **engage faster, with higher quality, in your voice**.

**Where in code:**
- Extension reply UI + tone picker + composer injection: `chrome-extension/src/content/content.js`
- Background worker: `chrome-extension/src/background/background.js` (`GENERATE_REPLY` → `/api/generate-reply`)
- Server endpoint: `src/app/api/generate-reply/route.ts`
- Reply prompt + personalization: `src/lib/openai/prompts/reply-prompt`, `src/lib/openai/prompts/prompt-assembler` (assembled per-user)

**Tones implemented (extension → server):** controversial, sarcastic, helpful, insight, enthusiastic.

---

## 3) Voice system (settings + examples) powering generation (especially replies) — **P0**
**What it does:** lets you store/manage voice settings and example posts; the backend assembles a personalized system prompt for reply generation.

**Why it exists:** “sounds like me” is the compounding advantage—otherwise replies feel generic and users churn.

**Where in code:**
- Voice UI: `src/app/voice/page.tsx`, `src/components/voice/*`
- Voice settings API: `src/app/api/voice/settings/route.ts`
- Voice examples CRUD: `src/app/api/voice/examples/*`
- Prompt preview + preview generation:
  - `src/app/api/voice/prompt-preview/route.ts`
  - `src/app/api/voice/preview/route.ts`
- Reply generation uses assembled prompt: `src/app/api/generate-reply/route.ts`

---

## 4) Chrome extension auth + API token refresh (so extension can act on your behalf) — **P1**
**What it does:** extension stores `authToken` + `refreshToken`, automatically refreshes on 401, and then retries requests.

**Why it exists:** makes the “in-X” workflow durable. Users won’t tolerate logging in repeatedly.

**Where in code:**
- Extension token handling: `chrome-extension/src/background/background.js`
- Server auth endpoints:
  - `src/app/api/auth/login/route.ts`
  - `src/app/api/auth/refresh/route.ts`

---

## 5) Chrome extension: niche account watch + niche post saving — **P1/P2**
**What it does:**
- “Watch” an account (store it) for later analysis
- Save niche posts into a niche dataset (for benchmarking/patterns)

**Why it exists:** lets users build a controlled “reference set” of what works in their niche.

**Where in code:**
- Extension UI + storage: `chrome-extension/src/content/content.js`
- Background calls:
  - `WATCH_ACCOUNT` → `/api/niche-accounts`
  - niche save → `/api/niche-posts`
- Server endpoints:
  - `src/app/api/niche-accounts/*`
  - `src/app/api/niche-posts/*`

---

## 6) Chrome extension: opportunity scoring overlay — **P2**
**What it does:** calculates an “opportunity score” for posts (based on views/velocity or engagement proxy + age + reply competition) and can show UI affordances (pill/border) to guide where to engage.

**Why it exists:** helps prioritize where a reply is most worth writing.

**Where in code:**
- Scoring logic + settings loaded from `chrome.storage`: `chrome-extension/src/content/content.js` (look for `oppSettings`, `calculateOpportunityScore`, `normalizeScore`)

---

## 7) Captured posts library + triage primitives (backend + UI) — **P2**
**What it does:** stores captured posts, supports listing/filtering, updating triage fields, deleting, and promoting a captured post to inspiration.

**Why it exists:** once posts are captured, you need a durable place to review and curate.

**Where in code:**
- API:
  - list: `src/app/api/captured/route.ts`
  - get/update/delete: `src/app/api/captured/[id]/route.ts`
  - promote: `src/app/api/captured/[id]/promote/route.ts`
- UI:
  - library: `src/app/library/page.tsx`, `src/components/library/*`

---

## 8) Pattern extraction + pattern controls + suggestions — **P2**
**What it does:** analyzes your posts + niche posts to extract patterns (hook styles, formats, timing, topics, engagement triggers), stores them, lets you enable/disable, and generates suggestions.

**Why it exists:** helps the system learn “what works” and turn that into constraints.

**Where in code:**
- Extract: `src/app/api/patterns/extract/route.ts`
- CRUD: `src/app/api/patterns/route.ts`, `src/app/api/patterns/[id]/route.ts`
- Suggestions: `src/app/api/patterns/suggestions/route.ts`
- UI: `src/components/insights/*`, `src/components/voice/PatternControlsTab.tsx`

---

## 9) X connection + sync (OAuth 1.0a) — **P2**
**What it does:** connects an X account, verifies status, and can sync a user timeline into the product.

**Why it exists:** alternative/backup to extension-capture for building your dataset.

**Where in code:**
- OAuth + API client: `src/lib/x-api/*`
- Endpoints: `src/app/api/x/connect`, `/callback`, `/status`, `/sync`
- UI: `src/components/settings/SettingsPage.tsx`

---

## 10) Analytics ingestion helpers (CSV upload, analytics sync) + best-times view — **P3**
**What it does:** endpoints exist to sync analytics data and compute best posting times; UI components show best-times sections.

**Where in code:**
- Analytics sync: `src/app/api/x/analytics-sync/route.ts`
- CSV upload: `src/app/api/voice/csv-upload/route.ts`
- Best-times API: `src/app/api/analytics/best-times/route.ts`
- UI: `src/components/analytics/BestTimesToPost.tsx`, insights tabs

---

## 11) “Create” page: draft generation (topic → drafts) — **P3**
**What it does:** UI exists to generate `X_POST`/`X_THREAD` drafts from a topic and selected patterns.

**Why it’s lower now:** it’s outside the extension-first loop you described, but still useful as a fallback.

**Where in code:**
- UI: `src/app/create/page.tsx`, `src/components/create/CreatePage.tsx`
- API: `src/app/api/drafts/generate-from-topic/route.ts`

---

## 12) Voice memo transcript ingestion + draft generation from sources — **P3 (deprioritized/legacy)**
**What it does (still implemented):** you can submit a transcript or upload audio as a source and generate drafts from it.

**Why it’s ranked low:** you told me this workflow has been ditched. I’m leaving it documented because it is currently in the codebase and can confuse scope if undocumented.

**Where in code:**
- UI: `src/components/create/NewDraftForm.tsx` (transcript + audio)
- APIs: `src/app/api/sources/*`, `src/app/api/drafts/generate/route.ts`

---

## 13) Agent for X waitlist landing page — **P3**
**What it does:** a marketing page + dev-friendly waitlist endpoint.

**Where in code:**
- UI: `src/app/agent-for-x/*`
- API: `src/app/api/waitlist/route.ts`

---

## Cross-cutting foundations (required for everything above)

### A) Supabase auth + route protection
- Middleware gate: `src/middleware.ts`
- Client auth context: `src/components/auth/AuthProvider.tsx`

### B) CORS handling for extension endpoints
- `src/lib/cors.ts` (used by `/api/capture`, `/api/generate-reply`, etc.)

### C) AI provider abstraction
- `src/lib/ai/*` (reply generation uses `createChatCompletion`)

---

## What I need from you to finalize the “importance ranking” correctly

1) **Define ICP precisely** (choose one):
   - (a) growth-focused solo creator
   - (b) founder doing distribution
   - (c) ghostwriter
   - (d) agency

2) Confirm: is the primary paid value **(1) reply agent** or **(2) full post drafting**?

If you answer those, I can tighten the ranking and translate it into a roadmap + metrics (without changing any code yet).
