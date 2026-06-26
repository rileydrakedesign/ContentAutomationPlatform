# Handoff: Dashboard Generation, Editor & Reply Improvements

> **Audience:** an engineer/agent implementing the next round of dashboard
> changes. This doc is self-contained — it includes the current behavior, the
> required behavior, the exact files, and acceptance criteria for each item.
> **Date:** 2026-06-20. **Repo:** `/Users/rileydrake/Desktop/content_automation`
> (Next.js 16 App Router + Turbopack, Supabase, TypeScript strict).

## 0. Orientation — how the relevant parts work today

Read these first; nearly every change below touches one of them.

- **One canonical voice context.** All generation/voice-check assembles a single
  tuned system prompt via `getAssembledPromptForUser(supabase, userId, voiceType)`
  in [`src/lib/openai/prompts/prompt-assembler.ts`](src/lib/openai/prompts/prompt-assembler.ts).
  It pulls voice settings, examples, niche, **enabled patterns (top 10 by
  multiplier)**, strategy, and feedback, and budgets them into the prompt. Do not
  fork it — extend it.
- **Patterns.** Extracted by `runVoiceTuneup` → `extractPatternsForUser`
  ([`src/lib/analysis/pattern-extract.ts`](src/lib/analysis/pattern-extract.ts)).
  Stored in `extracted_patterns` with `pattern_type ∈ {hook_style, format, topic,
  engagement_trigger, timing}`, `multiplier`, `pattern_value`, `is_enabled`,
  `source_post_examples` (jsonb provenance), `extraction_batch` (history).
- **Post generation** (dashboard): `POST /api/drafts/generate-from-topic`
  ([route](src/app/api/drafts/generate-from-topic/route.ts)) → returns N in-memory
  options. UI: [`src/components/create/CreatePage.tsx`](src/components/create/CreatePage.tsx).
  Saved drafts edited at [`src/app/drafts/[id]/page.tsx`](src/app/drafts/[id]/page.tsx).
- **Reply engine.** Server eligibility + traction in
  [`src/lib/x-api/reply-targets.ts`](src/lib/x-api/reply-targets.ts) (`findReplyTargets`)
  +/ [`src/lib/x-api/search-mapping.ts`](src/lib/x-api/search-mapping.ts)
  (`mapSearchResults`, `deriveEligibility`, `tractionScore`). Dashboard UI:
  [`src/components/reply/ReplyFinderPage.tsx`](src/components/reply/ReplyFinderPage.tsx).
- **Voice-check.** `runVoiceCheck` ([`src/lib/analysis/voice-check.ts`](src/lib/analysis/voice-check.ts))
  → `POST /api/voice/check` (3 credits). Reusable UI:
  [`src/components/create/useVoiceCheck.ts`](src/components/create/useVoiceCheck.ts),
  [`VoiceCheckResult.tsx`](src/components/create/VoiceCheckResult.tsx).
- **Publishing.** `postTweet(accessToken, text, { inReplyToStatusId })` in
  [`src/lib/x-api/client.ts`](src/lib/x-api/client.ts) → **no media support today**.
  Dashboard publish: `POST /api/publish/now` (`X_POST | X_THREAD | X_REPLY`).
- **Auth note:** in-app pages use Supabase session cookies; routes that the
  extension also calls accept a Bearer token via `getDualAuthUser`. Page routes
  are deny-by-default in [`src/proxy.ts`](src/proxy.ts) (public allowlist there).

---

## 1. Voice Report must be persistently accessible (not session-only)

**Why:** the Voice Report is the product's core "demonstrate, don't claim"
artifact (see `research/icp-user-story/BRIEF.md` §7). The user must be able to
open it any time, not just in the session a tune-up ran.

**Current behavior:** `InsightsPage`
([`src/components/insights/InsightsPage.tsx`](src/components/insights/InsightsPage.tsx))
holds the report in React state (`tuneupReport`). It is populated only by (a)
running a tune-up in that session, or (b) a one-shot `sessionStorage`
`pending_voice_report` handed off from the cold-start bootstrap. **Navigating
away loses it.** There is no endpoint that returns the last report, and the full
report is never persisted as a unit (its inputs — niche, patterns, top posts —
*are* persisted in their own tables).

**Required:**
1. Add a way to **view the latest Voice Report without re-running** the tune-up
   (which costs 5 credits). Two acceptable approaches — pick one and document it:
   - **(Preferred) Assemble-on-read:** add `GET /api/insights/report` that rebuilds
     the `VoiceReportData` from already-stored data (niche profile, enabled
     patterns w/ provenance, `getAnalyzablePosts` top posts, cadence, freshness,
     feedback themes). Most of this logic already exists in `runVoiceTuneup`
     ([`src/lib/analysis/tuneup.ts`](src/lib/analysis/tuneup.ts)) — extract the
     "assemble report from stored state" half into a shared function and call it
     from both the tune-up (after it writes) and this new GET (read-only, free).
   - **(Alt) Persist the report:** store the assembled report JSON on tune-up
     (e.g. a `voice_reports` row or a column on `user_niche_profile`) and read it
     back. Simpler but can go stale vs. the underlying tables.
2. On `/insights`, show the report by default when one exists (call the GET on
   load), with the "Run Voice Tune-Up" button as a refresh action.
3. Keep the existing post-tune-up and cold-start displays working.
4. Make sure the share flow (`POST /api/insights/share` → `/share/[token]`,
   already built) is reachable from this persistent view.

**Acceptance:** after running a tune-up, navigate away and back to `/insights` —
the Voice Report is still shown, with no new credit charge.

---

## 2. Exclude non-content patterns from generation (timing, post-type, visuals)

**Why:** patterns like **"Evening Posts"** (timing), **"Single Post" / "Thread
Format"** (post *type*), and any **visual/media** pattern are not things the text
generation model controls (post time is scheduling; post type is the user's
format choice; visuals are media attachments). Injecting them as "PROVEN
PATTERNS — apply where natural" pollutes generation and produces weird output.

**Current behavior (the bug):**
- `PatternSelector` ([component](src/components/create/PatternSelector.tsx)) filters
  out only `pattern_type === "timing"`. **Format/visual patterns still selectable.**
- `generate-from-topic` default pulls **top 3 enabled by multiplier with no type
  filter** — so "Evening Posts" / "Single Post" can be applied.
- `prompt-assembler` pulls **top 10 enabled with no type filter** and injects them
  into the PROVEN PATTERNS section of *every* generation/voice-check.
- Net: timing/format/visual patterns leak into generation in multiple paths.

**Required:**
1. Define a single canonical notion of **"generation-applicable" patterns**.
   Recommended: a helper `isGenerationApplicablePattern(pattern)` (new, e.g.
   `src/lib/analysis/pattern-applicability.ts`) that EXCLUDES:
   - `pattern_type === "timing"` (always),
   - post-*type* formats (e.g. names/values describing "single post", "thread",
     "post type", "X posts long"),
   - visual/media patterns (mentions of "image", "photo", "video", "media",
     "visual", "screenshot", "gif").
   Keep content-shaping patterns: `hook_style`, `engagement_trigger`, `topic`, and
   *structural* `format` patterns (e.g. "Numbered Lists", "Short paragraphs").
   Because `pattern_type` alone can't separate "Single Post" (type) from "Numbered
   Lists" (structure) — both are `format` — use type + a name/value keyword guard.
   Consider persisting the decision at extraction time (a boolean column
   `applies_to_generation` on `extracted_patterns`, set in `pattern-extract.ts`)
   so it's computed once and reusable everywhere; the runtime helper is the
   fallback for already-stored rows.
2. Apply the filter in **all three** places: `PatternSelector` (don't show
   non-applicable as selectable for generation), `generate-from-topic` (default +
   explicit selection both filtered), and `prompt-assembler`'s `buildPatternsSection`.
3. **Do not hide them from the Voice Report.** The Voice Report should still show
   timing/format/visual patterns as *insight* (they're real findings) — just label
   them as non-applied-to-generation context. So the exclusion is specifically for
   *generation application*, not for display.

**Acceptance:** generating a post never applies a timing/post-type/visual pattern;
the assembled system prompt's PROVEN PATTERNS section contains only
content-shaping patterns; the Voice Report still lists timing/format patterns as
insight.

---

## 3. Single-option generation with regenerate (not 3 options)

**Why:** the 3-card layout truncates each option and forces a click to read.
Better UX: one full post in view, regenerate for a new variation.

**Current behavior:** `generate-from-topic` defaults `generateCount = 3`;
`CreatePage` renders a 3-up grid of truncated cards (`line-clamp-4`), each needing
"Select & Edit" to see the full post.

**Required:**
1. Generate **one** option in full view by default (`generateCount = 1`).
2. Add a **Regenerate** action that requests a new variation, with an **optional
   free-text instruction** field ("make it punchier", "add a stat", "less formal")
   that is appended to the user prompt for that regeneration only (a one-off angle,
   subordinate to the tuned voice — mirror how `generate-reply`'s `tone` is framed:
   "one-off adjustment for this request only; the user's voice still applies").
3. Show the full post text (no clamp), the applied patterns (item #2), inline
   voice-check (optional per item #6), and a save/publish path.
4. Keep prior variations accessible (e.g. a small history/"previous variations"
   list) so a regenerate doesn't destroy a good earlier result. (Tie to #8.)

**Files:** `generate-from-topic/route.ts` (accept an optional `instructions`
string; default count 1), `CreatePage.tsx` (single-view + regenerate UI).

**Acceptance:** the composer shows one full post; "Regenerate" (with optional
instructions) produces a new variation without losing the previous one.

---

## 4. First-gen voice fidelity — harden the generation prompt structure

**Why:** the user wants generated posts to sound like them on the **first**
generation, before any voice-check. The voice-check is a safety net, not a crutch.

**Current behavior:** `generate-from-topic` sends the assembled system prompt
(voice settings, examples, niche, patterns) + a user prompt that restates the
topic, format instructions, inspiration, and a duplicate of the selected patterns,
then asks for a JSON array. With `generateCount` dropping to 1 (item #3) there's
budget to make each generation tighter.

**Required (review + tune, measure against real output):**
1. Audit `buildExamplesSection`, `buildPatternsSection`, `buildControlsSection`,
   and `buildPrecedenceNote` in `prompt-assembler.ts` — confirm the user's real
   high-engagement **examples** are weighted heavily and not crowded out by the
   token budget (examples are the strongest voice signal; patterns are secondary).
2. Ensure **selected** patterns (explicit per-request) are clearly prioritized over
   the default top-10 in the system prompt — today they're duplicated in the user
   prompt as a flat list; make the instruction unambiguous about applying the
   *selected* ones while staying in voice.
3. Verify the precedence order the model is told: **voice examples + controls
   (user law) > patterns (apply where natural) > topic/niche context**. Patterns
   must never override the authentic voice (the `optimization_authenticity` dial
   already softens/removes patterns < 30 / ≤ 70 — keep that).
4. Consider raising example count / lowering temperature for single-option gen now
   that we generate 1 not 3.
5. Add a lightweight eval: generate for a few topics, run `runVoiceCheck` on the
   raw output, and confirm scores are high *before* any edit. (No new ML; just a
   manual/spot check documented in the PR.)

**Acceptance:** for a tuned account, first-gen output voice-checks well (high
score, few deviations) without manual editing, and selected patterns are visibly
reflected.

---

## 5. Post editor parity with the native X composer

**Why:** users expect the dashboard editor to match X's composer so they can
finalize a post without leaving.

**Current behavior:** `XPostEditor`/`XThreadEditor` in
[`src/app/drafts/[id]/page.tsx`](src/app/drafts/[id]/page.tsx) are bare textareas
with a naive `.length` character count (max 25,000). **No media, no link preview,
no X-accurate counting.** `postTweet` in `x-api/client.ts` sends **text only** —
there is no media-upload pipeline anywhere in the repo.

**Required — bring the editor to X parity:**
1. **X-accurate visible character count.** X weights characters (URLs always count
   as 23 regardless of length; CJK counts as 2; the standard limit is 280 for
   non-premium, longer for premium). Use a `twitter-text`-style weighted counter,
   show the count and the limit, and indicate what will be truncated/visible.
   (Confirm the account's actual limit — this app posts via the user's own X auth.)
2. **Media uploader.** Add image/GIF/video upload. X media upload is the **v1.1
   `media/upload`** (INIT/APPEND/FINALIZE) or the newer v2 media endpoints; you must
   obtain `media_ids` and pass them to the tweet create call. This requires:
   - extending `postTweet` (and the publish routes / `executeScheduledPost`) to
     accept `mediaIds`,
   - a server upload route (the X token lives server-side; never expose it),
   - alt-text support (accessibility; X supports it),
   - storing attached media on the draft (`drafts` content) so it survives save and
     scheduling.
3. **Link preview.** Render the card preview for the first URL (fetch OG metadata
   server-side; do not rely on X to expand). Note URLs count as 23 chars in #1.
4. **Other native options to cover** (audit X's composer and match what applies):
   reply-audience setting, poll creation (if feasible via API), emoji picker,
   thread add/remove/reorder, draft autosave. Document any that the X API cannot
   support and mark them N/A.
5. Keep the existing voice-check affordance (now optional — item #6) in the editor.

**Scope note:** this is the largest item. Media upload alone is a vertical slice
(server route + token handling + tweet-create change + scheduled-publish change +
UI). Suggest landing it incrementally: (a) accurate counter + link preview, (b)
image upload + alt text, (c) video/GIF, (d) polls/audience.

**Acceptance:** a user can attach media (with alt text), see an accurate visible
character count and link preview, and publish/schedule the post with media through
the dashboard — and the media survives draft save + scheduling.

---

## 6. Voice-check is optional everywhere — offer "post" AND "voice-check & post"

**Why:** the current dashboard forces a voice-check before publishing/replying.
The user wants both: a quick **post** and a **voice-check then post**, consistently
across the app.

**Current behavior:** the W2 work made voice-check a **hard gate**:
- Draft editor ([`drafts/[id]/page.tsx`](src/app/drafts/[id]/page.tsx)) — `handlePostNow`/`handleSchedule`
  run a check first and only publish on a second click (`isVoiceCheckSurfaced`,
  [`src/lib/voice/publish-gate.ts`](src/lib/voice/publish-gate.ts)).
- Reply page ([`ReplyFinderPage.tsx`](src/components/reply/ReplyFinderPage.tsx)) —
  `postReply` blocks until voice-checked.
- Extension reply picker — on-demand check (already optional there).

**Required:**
1. Everywhere a user can publish (post composer/editor, reply page, and any reply
   flow), present **two clearly-labeled actions**: a primary **Post** (publishes
   immediately, no check) and a secondary **Voice-check & post** (runs the 3-credit
   check, shows the score, then lets them publish). Same for replies: **Post reply**
   and **Voice-check & reply**.
2. Voice-check stays **prominent but not mandatory.** Keep the score UI
   (`VoiceCheckResult`) and one-click apply-suggested-edit.
3. Remove the forced two-click gate; `isVoiceCheckSurfaced`/`publish-gate.ts` can be
   deleted or repurposed as an optional "you haven't checked this yet" hint.
4. Apply the **same principle to the MCP/agent and v1 surfaces** for consistency:
   they already separate `check_draft` from `publish_*` (good) — just ensure docs
   state voice-check is optional, never required, to publish.

**Acceptance:** on every publish surface the user can post directly OR voice-check
first; nothing blocks publishing on an un-checked draft. Update
[`docs/architecture/voice-system.md`](docs/architecture/voice-system.md) (it
currently says the dashboard gate is mandatory) and
[`docs/architecture/user-journey.md`](docs/architecture/user-journey.md).

---

## 7. Reply search must exclude posts the user can't reply to (avoid 403s)

**Why:** users hit hard failures like:
```
Failed to post tweet (403): {"detail":"Reply to this conversation is not allowed
because you have not been mentioned or otherwise engaged by the author of the post
you are replying to.","type":"about:blank","title":"Forbidden","status":403}
```
That 403 corresponds to a restricted reply audience (author limited replies to
people they follow / have engaged / mentioned). These posts must not be offered as
reply targets.

**Current behavior:** `deriveEligibility` in
[`search-mapping.ts`](src/lib/x-api/search-mapping.ts) maps `reply_settings`:
`everyone` → allowed; `mentionedUsers` → allowed only if our handle is mentioned;
`following` / `subscribers` → not allowed; `null`/unknown/other → not allowed.
`findReplyTargets` returns only `reply_allowed` posts, and `searchRecentTweets`
requests `reply_settings` + `entities`. So the dashboard reply search *should*
already filter these. The residual 403s mean one or more of: (a) X uses a
`reply_settings` value we don't map (audit against X's current enum — e.g.
`verified`, `subscribers`, follower-only variants), (b) `reply_settings` is absent
on some search results and we must keep treating absent as not-allowed (we do), or
(c) X 403s even when `reply_settings === "everyone"` because the author blocked the
user / limited the specific conversation — undetectable pre-flight.

**Required:**
1. **Audit + harden eligibility mapping** against X's current `reply_settings`
   values; ensure anything not provably open (only `everyone`, or `mentionedUsers`
   when we're mentioned) is excluded. Confirm the search query requests the field
   and that we never surface `unknown`. The MCP `find_reply_posts` already enforces
   this — keep the dashboard, `/api/search/reply-targets`, and v1 in lockstep
   (they share `findReplyTargets`, so fix it once).
2. **Graceful residual-403 handling.** Because some restrictions are undetectable
   pre-flight, when a reply publish returns 403 with this restriction: surface a
   clear message ("X won't allow a reply here — the author limited who can reply"),
   **remove that post from the list**, do not treat it as a generic failure, and
   (if credits were charged on the API/MCP path) ensure the refund path covers it.
   The v1 publish route already refunds on X rejection — verify the dashboard path
   messages it cleanly.
3. Keep the existing transparency line ("N of M repliable; the rest restrict
   replies and are hidden") accurate after the mapping audit.

**Acceptance:** the dashboard reply finder never lists a post that fails with the
"not allowed to reply" 403 for a *detectable* reason; if an undetectable 403 still
occurs on publish, the user gets a clear message and the post is removed, not a raw
error.

---

## 8. Persist page state across navigation (no lost progress)

**Why:** users lose in-progress work (a typed topic, generated variations, a
drafted reply, search results, the selected client) when they navigate away and
back. Every page should restore its state.

**Current behavior:** the main interactive pages hold everything in `useState` with
no persistence: `CreatePage` (topic, generated options, selected patterns,
inspiration, compose text), `ReplyFinderPage` (query, results, active composer,
reply text, voice-check), the draft editor, and `AgencyClientsPage` (selected
client, report). Only one-off handoffs use `sessionStorage` (the cold-start
`pending_voice_report`).

**Required:**
1. Choose **one** persistence strategy and apply it consistently (document the
   choice):
   - **sessionStorage-backed state hook** (recommended): a small `usePersistentState(key, initial)`
     that mirrors `useState` to `sessionStorage` (survives client-side navigation
     and reloads within the tab; clears when the tab closes). Good default for
     "don't lose my draft".
   - or **URL/query state** for things that should be shareable/bookmarkable (e.g.
     the create tab, reply query) — some already use `useSearchParams`.
   - or a lightweight client store (Context/Zustand) if cross-page state grows.
2. Apply to at least: `/create` (topic, draft type, selected patterns, generated
   variations + history from #3, compose text), `/reply` (query, sort, results,
   open composer + reply text), `/drafts/[id]` (unsaved edits — warn or autosave),
   `/agency` (selected client + loaded report).
3. Be careful with **stale/expensive state**: persist inputs and generated text,
   but re-validate server-derived lists (drafts, search results) on mount if they
   could be stale. Don't persist secrets or large blobs unboundedly.
4. Guard against hydration mismatches (read persisted state in an effect, not
   during SSR render — see the existing `FirstRunAnalysis` pattern that avoids
   setState-in-render).

**Acceptance:** typing a topic + generating a post, navigating to another page, and
returning restores the topic and the generated variation(s); the same holds for an
in-progress reply and the selected agency client.

---

## Cross-cutting requirements & guardrails

- **Reuse, don't fork.** Use the canonical libs (`prompt-assembler`,
  `runVoiceCheck`, `findReplyTargets`, `weightedEngagement`, `posts-pool`,
  `csv-import`). New shared logic goes in a lib with a unit test.
- **Parity.** Any capability added to the dashboard that the API/MCP should also
  have must stay in lockstep (the three surfaces share cores). The voice-check
  optionality (#6) and reply eligibility (#7) especially must read consistently
  across web, v1, and MCP. Update the parity matrix
  ([`docs/architecture/loop.md`](docs/architecture/loop.md)).
- **Credits unchanged.** Generation/voice-check/publish costs and the credit
  currency stay as-is; you may change *where/whether* a metered action triggers
  (e.g. voice-check now optional) but not the prices.
- **Quality gates (must stay green):** `npm run build`, `npm test` (root) + MCP
  package build/test, `npx tsc --noEmit` (ignore stale `.next/` dup-type errors),
  `npx eslint` clean on changed files. Add a loop/unit test per item where feasible
  (pattern-applicability filter, X char counter, eligibility mapping, persistent
  state hook).
- **Migrations:** DDL via Supabase `apply_migration` (e.g. the optional
  `applies_to_generation` column, any media columns). Note: a recent fix changed
  `extracted_patterns.source_post_ids` from `uuid[]` → `text[]` (it stores tweet
  IDs); that migration was applied to the remote DB but **is not yet captured as a
  repo migration file** — capture it if you keep migrations in-repo.
- **Docs in lockstep (W7 discipline):** update `docs/` (voice-system, publishing,
  patterns, voice-tuneup, reply, user-journey, loop) and regenerate the MCP
  reference if any tool/endpoint changes.

## Suggested sequencing
1. **#2 (pattern filtering)** and **#4 (prompt fidelity)** — cheap, high-impact on
   output quality; do them together.
2. **#3 (single-option + regenerate)** — depends on #2/#4 being right.
3. **#6 (optional voice-check)** and **#7 (reply eligibility)** — behavior fixes,
   relatively contained.
4. **#1 (persistent Voice Report)** — small, self-contained.
5. **#8 (page persistence)** — app-wide; do after the page UIs settle from #3/#6.
6. **#5 (X editor parity)** — largest; land incrementally (counter → media → polls).
