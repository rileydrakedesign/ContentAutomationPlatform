# Reply Finder & Reply Engine — Source of Truth

> Find high-value tweets to reply to, score whether the opportunity is worth taking, and generate/check replies in your own voice — with reply eligibility and human approval enforced at every step.
> **Status (2026-06-26):** Live on three surfaces (dashboard `ReplyFinderPage`, Chrome extension pill, MCP `find_reply_posts`). Server-side discovery + traction ranking is unified through one core (`findReplyTargets`). The "should I reply at all" opportunity score exists in **two** implementations that share a formula but diverge in shape — see §2 and §7.

---

## 1. Role — reply-growth at the small-account stage; account safety

Replies are the cheapest, highest-volume growth lever for a small account: you borrow someone else's audience instead of waiting for your own to compound. The product treats this as a distinct surface from posting because the economics and risk profile differ:

- **High-volume / low-cost.** A user can fire dozens of replies a day. Each is cheap to generate (`generate-reply` runs the `fast` model tier, `temperature: 0.7`, `maxTokens: 400` — `src/app/api/generate-reply/route.ts:204`). The bottleneck is finding *worth-replying-to* posts, not writing.
- **Account safety = survival.** After the May 2026 suspension wave, keyword-spray reply bots are the fastest way to get suspended. The architecture's answer is **human-in-the-loop everywhere** plus **never surfacing a post you can't actually reply to** (§5). The dashboard makes this an explicit selling point — the "Account-safe by design" banner at `src/components/reply/ReplyFinderPage.tsx:206-217`.
- **Two scores, two questions.** The reply engine answers *"should I reply to this post at all?"* via the **Opportunity Score** (§2). The writing assistant answers *"is this reply any good / does it sound like me?"* via Voice Match (see `docs/features/writing-assistant.md`). They are deliberately separate signals computed by different code.

The assistant's reply surface is intentionally **stripped down** vs. the post composer: on the reply box the assistant runs cheap L2 voice scores continuously but only runs the expensive L3 LLM deep-check on demand (`autoDeepCheck=false` for replies — `src/components/assistant/useAssistant.ts:55-57`). Replies are too high-frequency to justify an LLM call per pause; Voice Match is the focus.

---

## 2. Finding targets & the Opportunity Score

### 2a. Discovery core (`findReplyTargets`)

All server-side reply discovery funnels through one function so no surface forks the logic:

`src/lib/x-api/reply-targets.ts:34` — `findReplyTargets(userId, { query, maxResults, sort })`:
1. Get a valid X access token + the auth account's username (`reply-targets.ts:38-39`).
2. `searchRecentTweets` against X v2 recent search (`reply-targets.ts:41`).
3. `mapSearchResults` enriches each tweet with reply-eligibility (`reply-targets.ts:42`).
4. **Filter to repliable only** — `allTweets.filter((t) => t.reply_allowed)` (`reply-targets.ts:43`). We never hand back a post the account can't reply to.
5. If `sort === "traction"`, sort the repliable subset by `tractionScore` descending (`reply-targets.ts:45-48`).
6. Return `{ tweets, returned_count, repliable_count }` — `returned_count` is what X billed us for; `repliable_count` is what survived the filter (`reply-targets.ts:50-54`).

**Reply eligibility** (`src/lib/x-api/search-mapping.ts:41-65`, `deriveEligibility`) is allow-list, not deny-list. Reply is *provably* allowed only when `reply_settings === "everyone"` (`open`), or `=== "mentionedUsers"` AND our handle is in the tweet's mentions (`open_mentioned`). `following` / `subscribers` / `verified` depend on a relationship not in the payload → `restricted`. Absent/empty → `unknown`. Anything not provably open is **not** surfaced. The audited X v2 enum is documented inline at `search-mapping.ts:26-36`.

**Traction score** (`search-mapping.ts:126-147`, `tractionScore`): canonical `weightedEngagement` (replies 5× · reposts 4× · likes/bookmarks 3× · impressions 0.001× — `src/lib/utils/engagement.ts`) divided by post age in hours (`engagement / ageHours`, min 1h). Fresh posts with momentum outrank old saturated ones — a reply on a still-rising post gets more eyeballs.

### 2b. Server route surfaces

Two HTTP routes wrap the same core, both pre-charging X's per-post billing and refunding the overcount:

| Route | Auth | Notes | File |
|---|---|---|---|
| `GET /api/search/reply-targets` | dual-auth (cookie **or** Bearer) | Dashboard + extension. Pro-gated via `requireFeature(..., "xApiSync")`. | `src/app/api/search/reply-targets/route.ts:30` |
| `GET /api/v1/search/reply-targets` | API key (`search:read`) | Agent/API + MCP. Returns credit headers. | `src/app/api/v1/search/reply-targets/route.ts:29` |

Billing model (identical in both): X bills **per post returned**, so debit worst-case up front (`maxResults × CREDIT_COSTS["search.per_post"]`), run the search, then refund the difference based on `returned_count` (min charge 5). Restricted posts that get filtered out are **not** refunded — we already paid X for them (`route.ts:64-87`; `v1/.../route.ts:57-83`). `max_results` clamped to 10–25.

Note: `POST /api/x/search` (`src/app/api/x/search/route.ts`) is a separate, simpler "search for inspiration" route — raw tweets, no eligibility/traction enrichment, throttled per-user. It is **not** part of the reply engine; don't confuse it with reply-targets.

### 2c. The Opportunity Score (extension, client-side)

The Chrome extension computes its own opportunity score in the page as you scroll X, because it has no server round-trip per visible tweet. `chrome-extension/src/content/content.js`:

- `weightedEngagement(metrics)` (`content.js:120-127`) — **same formula** as the server (likes×3 + retweets×4 + replies×5 + bookmarks×3 + views×0.001), explicitly commented to mirror `src/lib/utils/engagement.ts` (`content.js:115-119`).
- `calculateOpportunityScore(metrics, ageMinutes)` (`content.js:129-173`) — applies hard display filters (`maxReplies` default 200, `maxAgeHours` default 24 — `content.js:32-37`), then the **same traction = weightedEngagement / ageHours** (`content.js:149`). Also derives human-readable `reasons` ("High views per hour", "Low competition", "Fresh post") and a `isProxy` flag when views are unavailable.
- `normalizeScore(rawScore)` (`content.js:178-199`) — rolling min/max over the last 100 samples → 0–100. This is the displayed "Opp NN" number.
- Display gated by thresholds: `greenThreshold` 75, `yellowThreshold` 60 (`content.js:30-31`); pill + border only above yellow (`content.js:473`, `applyOpportunityBorder` `content.js:410-419`).
- **Eligibility gate first.** `scoreAndDisplayOpportunity` bails via `isReplyRestricted(articleElement)` (`content.js:429`, gate at `content.js:322-364`) — DOM-based: a post is restricted only when X's native `[data-testid="reply"]` control is absent **and** a short "Who can reply" notice is present. Conservative (fails open to repliable).

### 2d. Duplicate opportunity score (server vs extension) — still present

The ICP doc flagged this and it still holds: **the opportunity/traction signal is implemented twice.**

- **Server**: `tractionScore` in `search-mapping.ts:126` (used by `findReplyTargets` when `sort=traction`). Raw float, used only to *rank* an already-filtered list.
- **Extension**: `calculateOpportunityScore` + `normalizeScore` in `content.js:129`/`content.js:178`. Normalized 0–100, used to *decide whether to show a pill at all* and color it.

They share the engagement weights and the `engagement / ageHours` traction core (and the extension comments say so), but they are not the same code path, and the extension layers on display thresholds, proxy scoring, and 0–100 normalization that the server doesn't have. Risk: the weights or decay can drift in one place and not the other. See §7 for the cleanup note.

---

## 3. Generating & checking replies in-voice

### 3a. Generation (`POST /api/generate-reply`)

`src/app/api/generate-reply/route.ts:127`. Flow:
1. Dual-auth, then per-request LLM rate-limit guard (`guardLlmRoute`) **before** the daily quota so a throttled call doesn't burn a daily slot (`route.ts:140-141`).
2. AI-generation gate (free tier 5/day) — `requireAiGeneration` (`route.ts:144`).
3. Build the user prompt from `post_text` + optional rich `context` (parent/quoted/link/media — `buildContextPrompt` `route.ts:79-124`) + an optional one-off `tone` **angle** that is explicitly subordinate to the tuned voice (`getToneInstruction` `route.ts:59-74`).
4. **System prompt = the user's assembled reply voice** via `getAssembledPromptForUser(supabase, userId)` — which defaults `voiceType='reply'` (`prompt-assembler.ts:614-617`). Falls back to base `REPLY_SYSTEM_PROMPT` on failure (`route.ts:169-175`).
5. Provider resolved from the user's `user_voice_settings` row where `voice_type='reply'`, column `ai_model` (`route.ts:179-187`; `CLAUDE_ONLY` env forces Claude).
6. Returns up to 3 cleaned replies labeled `["Punchy","Insight","Spicy"]` (`route.ts:248-274`).

### 3b. Reply voice = its own tuned voice

The reply voice is a **separate row/dataset** from the post voice:
- `user_voice_settings` filtered by `voice_type='reply'` (controls + `ai_model` — `prompt-assembler.ts:626-631`).
- `user_voice_examples` filtered by `content_type='reply'`, non-excluded, ranked by pin then engagement (`prompt-assembler.ts:634-641`).
- `inspiration_posts` where `include_in_reply_voice=true` (`prompt-assembler.ts:649-650`).
- `generation_feedback` where `generation_type='reply'` (`prompt-assembler.ts:658-662`).
- Base prompt is `REPLY_SYSTEM_PROMPT` when `mode==='reply'` (`prompt-assembler.ts:524`).

### 3c. Reply guidelines & exemplars

`src/lib/openai/prompts/reply-guidelines.ts`:
- `loadReplyGuidelines()` (`:11`) reads and caches the shared `LLM-post-guidelines/*.md` set (human-writing, writing-principles, copywriting-principles, feedback-examples, algo-principles).
- `getHighPerformingReplyExamples()` (`:44`) is a hard-coded block of real high-engagement replies ("They do. They're called markdown files", "Bye adobe", etc.) — short, punchy, opinionated exemplars that set the default register.
- `getReplyGenerationContext()` (`:89`) concatenates both.

### 3d. Checking a reply (Voice Match)

Separate from the opportunity score and from generation. `POST /api/voice/check` accepts `voice_type` (`'reply'` vs `'post'` — `src/app/api/voice/check/route.ts:49`) and is invoked from the dashboard via `useVoiceCheck("reply")` (`src/components/create/useVoiceCheck.ts:19`, `:35`). It's an **optional, ~3-credit** pre-flight: how well does this reply sound like you, before it ships (`ReplyFinderPage.tsx:380-388`). The live assistant L3 deep-check also passes `voice_type` (`useAssistant.ts:191`).

---

## 4. Surfaces

### 4a. Dashboard — `ReplyFinderPage`

`src/components/reply/ReplyFinderPage.tsx`. The reference end-to-end flow:
- Search box + a relevance/traction toggle (`:238-255`) → `GET /api/search/reply-targets?...&max_results=25` (`:83-85`).
- Results show only repliable posts, each badged `repliable` / `you're mentioned` from `reply_eligibility` (`:298-302`), with a transparency line "_N of M posts are repliable — the rest restrict replies and are hidden_" (`:263-268`).
- "Reply in my voice" opens a one-at-a-time composer → `generateReplies` calls `/api/generate-reply` (`:110-137`) → user picks/edits an option.
- **Post path is a handoff, never an API publish.** The reply leaves the app via the extension → X web intent (pre-filled composer) → copy + open post (`src/components/reply/useHandoff.ts`); the human sends it from X. The dashboard `POST /api/publish/now` no longer accepts `X_REPLY` at all.
- Conversation-level reply limits are undetectable pre-flight; because the send happens in X's own UI, the user simply sees X reject it there.
- Search/draft state persists across navigation via `usePersistentState` (`:50-65`).

### 4b. Chrome extension — opportunity pill + inline reply

`chrome-extension/src/content/content.js`. As the user scrolls X:
- An `IntersectionObserver` (`content.js:2044-2058`) calls `scoreAndDisplayOpportunity` per visible article; the **"Opp NN" pill** is injected into the tweet's action bar (`createOpportunityPill` `:373`, inserted `:500`) and the article gets a colored border above threshold.
- Clicking the pill triggers the extension's own reply button (`:486-497`), which generates a reply via `background.js` → `POST /api/generate-reply` (`background.js:244`), honoring `payload.tone` (`content.js:1059`).
- When the user actually sends a reply on X, the extension logs it to `POST /api/extension/replies` (`src/app/api/extension/replies/route.ts:12`), inserting into the **`extension_replies`** table (`reply_text`, `replied_to_post_id`, `replied_to_post_url`, `sent_at` — `:38-46`) for consistency tracking. This is a **logging** endpoint; it does not post to X.

### 4c. MCP / agent — `find_reply_posts`

`find_reply_posts` in `mcp/src/tools.ts` wraps `GET /api/v1/search/reply-targets`. The tool description is doing real safety work: it tells the agent to use this instead of `search_tweets` when the goal is replying, that `reply_allowed` is **best-effort not a guarantee**, that credits bill per post X returns (not per repliable post), and to only set `sort='traction'` when the user asks for momentum. Sibling `search_tweets` returns raw eligibility fields without filtering.

**There is no agent reply-publish path (2026-07).** `publish_reply` was removed from the catalog, and `POST /api/v1/publish/now` with `contentType: "X_REPLY"` returns `410 Gone` (`code: "deprecated"`) *before* any credit debit. Instead, every reply target now carries two handoff fields (`src/lib/x-api/search-mapping.ts:138-141`):

- **`post_url`** — the permalink (`https://x.com/<author>/status/<id>`; `null` when the author username is unknown).
- **`intent_url`** — `https://x.com/intent/post?in_reply_to=<id>`. The caller appends `&text=<url-encoded reply>` and opens it; X's composer opens pre-filled and the **human** sends it.

This is the same handoff the dashboard uses (`useHandoff.ts`), expressed as data for agents.

---

## 5. Account safety / human-in-the-loop

The architecture is "human-in-the-loop is the architecture," realized as layered guards:

1. **Never surface an un-repliable post.** Server filters to `reply_allowed` (`reply-targets.ts:43`) with an allow-list eligibility model (`search-mapping.ts:41-65`); the extension applies a DOM eligibility gate before any pill (`content.js:429`). No keyword-spray surface exists.
2. **Nothing posts a reply programmatically.** Replies are **handoff-only** everywhere: the dashboard hands off to the extension, X's web intent, or copy+open (`useHandoff.ts`); the extension posts through X's own UI; MCP/the API have **no reply-publish path at all** (`publish_reply` removed; `X_REPLY` → 410). Generation, where used, only seeds text the human edits and sends.
3. **Voice is the anti-spam signal.** Replies are written from the user's tuned reply voice (§3) and an optional Voice Match check, so they read as the person, not a bot.
4. **Graceful 403 handling.** Conversation-level reply limits are undetectable pre-flight. Since replies now leave via the handoff, X itself rejects the send in its own composer; the `isReplyForbiddenError` helper (`search-mapping.ts:85`) survives for any X-API path that can still hit that 403.
5. **Rate-limit + quota + Pro gating.** `generate-reply` runs `guardLlmRoute` + daily AI-generation quota; search is `xApiSync` Pro-gated and per-post metered. These cap volume independent of intent.

---

## 6. Key files, routes & tables

| Concern | Path |
|---|---|
| Discovery core (filter + rank) | `src/lib/x-api/reply-targets.ts:34` |
| Eligibility + traction mapping | `src/lib/x-api/search-mapping.ts:41` / `:126` |
| Engagement weights (canonical) | `src/lib/utils/engagement.ts` (`weightedEngagement`) |
| Dashboard reply-targets route | `src/app/api/search/reply-targets/route.ts:30` |
| API/agent reply-targets route | `src/app/api/v1/search/reply-targets/route.ts:29` |
| Raw inspiration search (not reply engine) | `src/app/api/x/search/route.ts:8` |
| Reply generation | `src/app/api/generate-reply/route.ts:127` |
| Reply prompt assembly (voiceType reply) | `src/lib/openai/prompts/prompt-assembler.ts:614` |
| Reply guidelines + exemplars | `src/lib/openai/prompts/reply-guidelines.ts` |
| Voice check (reply) | `src/app/api/voice/check/route.ts:49`; `src/components/create/useVoiceCheck.ts:19` |
| Dashboard UI | `src/components/reply/ReplyFinderPage.tsx` |
| Assistant on reply box (L2/L3) | `src/components/assistant/useAssistant.ts:55` |
| Extension opportunity score + pill | `chrome-extension/src/content/content.js:129` / `:373` / `:424` |
| Extension eligibility gate | `chrome-extension/src/content/content.js:322` |
| Extension reply generation | `chrome-extension/src/background/background.js:244` |
| Extension reply logging route | `src/app/api/extension/replies/route.ts:12` |
| MCP tool | `mcp/src/tools.ts` (`find_reply_posts`) |
| Reply handoff (dashboard) | `src/components/reply/useHandoff.ts` |
| **Tables** | `user_voice_settings` (`voice_type='reply'`), `user_voice_examples` (`content_type='reply'`), `inspiration_posts` (`include_in_reply_voice`), `generation_feedback` (`generation_type='reply'`), `extension_replies` |

---

## 7. Current state & gaps

- **Duplicate opportunity score (open).** As in §2d, the traction/opportunity signal lives in both `search-mapping.ts:126` (server, raw float, ranking-only) and `content.js:129`/`:178` (extension, normalized 0–100, display-gating). They share the formula by convention and a code comment, not by shared code. They cannot be trivially merged (the extension scores DOM-scraped metrics offline with no server call), but the **weights + decay should be the single source of truth** the extension imports/syncs from, rather than a hand-copied mirror that can silently drift.
- **Two eligibility implementations.** Server eligibility reads X's `reply_settings` enum (`search-mapping.ts:41`); the extension infers eligibility from the DOM (`content.js:322`). Different signals for the same question, each appropriate to its context, but both must be kept in sync with X's UI/API changes (the enum was last audited 2026-06-20 — `search-mapping.ts:26`).
- **Opportunity vs. Voice Match are correctly separate** but there's no surface that combines them ("high-opportunity post + here's a high-Voice-Match reply ready to send") — currently the user bridges the two manually.
- **Best-effort eligibility is load-bearing.** `reply_allowed=true` is never a guarantee; the 403 fallback (§5.4) is the real safety net. Any new reply surface MUST handle `isReplyForbiddenError`.
- **`extension_replies` is log-only.** It records what the user sent for consistency tracking; it is not yet wired into Voice Match or opportunity feedback loops.
- **Pre-charge/refund metering** for search depends on X's `returned_count`; restricted posts are paid for but filtered out (no refund) — intended, but a noisy query can spend credits for few repliable results.

---

## 8. Related docs

- `docs/features/writing-assistant.md` — the "is this reply good / does it sound like me" side (L0/L2/L3 assistant, Voice Match, the reply-box stripped-down config).
- `docs/features/voice-engine.md` — how the reply voice (`voice_type='reply'`) is tuned, examples ranked, and prompts assembled.
- Chrome extension: no current `docs/features/` entry; see `chrome-extension/src/content/content.js` (opportunity UI) and archived context in `docs/archive/chrome_extension_addition.md`.
