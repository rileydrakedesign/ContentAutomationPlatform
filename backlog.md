# Backlog

Running backlog of issues and improvements.

## Bugs

- [ ] **Free-plan UI flashes before paid plan loads on home.** For paid users, when the home page is loading it briefly renders the free-account blockers/gating before the paid plan resolves. Likely a default/initial plan state (free) shown before the user's plan is fetched — should gate on a loading state or default to a neutral state until the plan is known.
- [x] **Suggested changes don't move the score.** Applying a suggested change in the editor does not actually drive the score up. ~~Make sure applied suggestions are wired into the scoring so the score recalculates and reflects the change.~~ Done, then **fixed structurally (2026-07-04)**: the score is now findings-coupled — every open finding holds a deduction out of the score (`FINDING_DEDUCTIONS` in `score.ts`: live voice −6, avoid-word −4, live algorithm −7, correctness −5, clarity −1 capped), released on accept/dismiss, so any accepted suggestion raises the headline *by construction* (invariant pinned in `assistant.test.ts`). Weights rebalanced to `0.40·voice + 0.40·algorithm + 0.20·performance` (was 0.45/0.35/0.20 with the algorithm at 0.20), and the L3 read now returns dedicated algorithm findings grounded in the heavy-ranker weights.
- [x] **"Reading your draft" loader is too slow.** ~~The loader in the editor takes way too long.~~ Done: trimmed the live-read LLM prompt (fewer example posts, maxTokens 1100→800) for a faster round-trip, and Accept only re-runs L3 when *other* live findings remain — so the loader no longer fires on the common single-suggestion case.
- [x] **Algorithm checks not surfacing.** ~~Algorithm-side checks are not appearing in the editor.~~ Done: added deterministic algorithm checks (hashtag overuse, leading @mention) alongside link/bait, and the panel now groups suggestions into a distinct, co-equal "Algorithm & reach" section so the algo side is as prominent as voice.
- [x] **Algorithm insights not applicable in the editor.** ~~Unlike voice insights, algorithm insights can't be applied to the draft from the editor.~~ Done: link, engagement-bait, and extra-hashtag findings now carry a one-click `replacement` (clean removal incl. adjacent space) and Accept like voice findings.
- [x] **Swiping to the side clears post text.** ~~Swiping should not wipe out the post text in the editor.~~ Done: `usePersistentState` now flushes the freshest value to sessionStorage on `pagehide`/`visibilitychange`, so a swipe-to-back gesture can't lose the last keystrokes before the write effect commits.
- [x] **AI write tools missing from the threads editor.** ~~Apply the same write tooling to threads, not just single posts.~~ Done (2026-07-04): shared `ThreadTweetEditor` wired into both `CreatePage`'s thread branch and `DraftEditor`'s `XThreadEditor` — every tweet gets Tier-0 underlines + its own L2 score; the focused tweet auto-runs L3 and shows the inline score panel + suggestions ("Tweet n of m"). Note: the two editors carry different tweet caps (CreatePage 25 vs DraftEditor 6) — pre-existing, worth unifying. Whole-thread aggregate scoring (hook-tweet strength, arc) still open.

## Features

- [ ] **Work inspiration posts into the editor.** Find a way to surface and use inspiration posts directly within the editor flow. _(Deferred — assisted-compose follow-up.)_
- [ ] **Apply proven patterns to the post from the editor.** Proven patterns surface but there's no way to apply them to the post in the editor. Add an apply action. _(Deferred — pattern chips currently carry no insertable text; an apply action needs either stored template text on `extracted_patterns` or an LLM "weave this pattern in" call at accept time.)_
- [ ] **Post editor persistence (must-have).** Edits must persist so work isn't lost. Add reliable draft persistence in the post editor. _(Partially improved: the sessionStorage flush above hardens in-session persistence against swipe/navigation loss. Full "must-have" durability — server-side autosave that survives tab close — is still open.)_
- [ ] **App-wide loading, latency, and persistence.** Add consistent loading states, reduce latency, and add persistence across the app.
- [ ] **Whisperflow-style voice-to-post.** Let users speak directly into the post box and have their speech transcribed and formatted into a proper post.
- [ ] **Native post box formatter (X publish spec).** Format the post in the post box to match exactly what X expects on the publish side.
- [ ] **Multi-account support.** Let a user connect and manage multiple X accounts under one login, switching the active account for writing, scoring, publishing, and analytics. _(The 2026-06 agency/client module that covered this was removed in the 2026-07 slim — the `agency` plan tier and `multiAccount` flag are gone. Re-open from scratch if it comes back.)_
- [ ] **Visual preview for threads.** Render a true-to-X visual preview of a thread (per-tweet cards, numbering, connective layout) so users see how the thread will look before publishing.
- [ ] **Visual preview for tweets + links/media.** Render an X-accurate visual preview for single tweets and threads, including link cards/unfurls and attached media (images/video), so the previewed layout matches the published result.
- [x] **Reply-via-new-tab workaround (X API reply restriction).** ~~Add a fallback that opens X in a new tab with the reply text pre-filled.~~ Done (2026-07) — and it is now the *only* reply path: API/MCP reply publishing is deprecated (`X_REPLY` → 410, `publish_reply` removed) and every surface hands the reply off (extension assist → X web intent `intent_url` + `&text=…` → copy + open). Reply targets carry `post_url` and `intent_url`.

## Cleanup / Pivot alignment

- [x] **Drop features not aligned with the new pivot.** ~~Audit and remove features that don't fit the writing-assistant pivot.~~ Done (2026-07-04 alignment pass): reply finder rebuilt on the live assistant (metered voice-check button removed from the web app; on-ramp reframed as "starting points"); onboarding/tour now end in the editor ("Write your first post"), not on analytics; nav reordered Write-first. Deliberate keeps at the time: `/strategy` and the dashboard root stay (owner decision); voice-check lib/endpoints stay (extension + MCP use them). _Superseded in part by the 2026-07 slim: the agency module is deleted, and `/strategy` is now a Settings tab rather than a page._
- [x] **Remove launch toggles; bake in defaults.** ~~Clear all toggles and bake the defaults in.~~ Done: `src/lib/assistant/flag.ts` deleted (assistant unconditionally on; threads got the per-tweet assistant later the same day); `AI_CLAUDE_ONLY` env + stored `ai_model` read-path removed, Claude baked as the resolved provider (also fixed the v1 generate route that fell back to OpenAI, bypassing the override). `LIVE_READ_PROVIDER` kept — infra choice, not a user toggle.
- [x] **Code cleanup for cohesiveness and dead code.** ~~Sweep the codebase for dead code and inconsistencies.~~ Done this pass: orphaned `BestTimesSection` deleted; `InspirationPostsTab` moved from `components/voice/` to `components/library/`; dead `?filter=inspiration` param dropped; bare `/drafts` now redirects to `/create?tab=drafts`; URL detection unified (billing `containsUrl` now uses the canonical `findLinks`/`LINKED_TLDS` in `tweet-text.ts` — one definition for counting, underlines, and billing; emails no longer counted as URLs); boost-opportunities scoring reconciled onto canonical `weightedEngagement`; pre-pivot copy rewritten on `/agent-for-x`, the marketing landing, and Settings "How It Works".

## Launch readiness

### Infra & reliability
- [ ] **Uptime monitor setup.** Stand up uptime/health monitoring with alerting.
- [ ] **Load balancer and rate limiter check.** Verify the load balancer and rate limiter are correctly configured and behaving under load.
- [ ] **QStash and 3rd-party check.** Verify QStash and all third-party integrations are healthy and correctly wired.
- [ ] **MCP tune-up and cohesiveness.** Review the MCP server/tooling for cohesiveness and fix any rough edges.

### Billing & legal
- [ ] **Stripe production setup.** Configure Stripe for production (live keys, webhooks, products/prices, plan gating).
- [ ] **Pricing model lock-in + unified credit system.** Lock in the pricing model and update the credit system so app, API, MCP, and the Chrome extension all draw from the same unified credit/billing system.
- [ ] **Terms, conditions, and legal.** Add terms of service, privacy policy, and required legal pages.

### Auth
- [ ] **Verify Google login and auth flow.** Make sure Google login and the full auth flow work end to end.
- [ ] **Add "Sign in with X" feature.** Add X (Twitter) as a sign-in option.

### Surfaces & content
- [x] **Landing page: clear out stale data.** ~~Remove stale/placeholder content from the landing page.~~ Done: both landing surfaces (`/agent-for-x` and the `landing/` marketing app) rewritten off the "generate content" pitch onto the writing-assistant story (two-fogs framing, live underlines, "you keep the pen").
- [ ] **Deploy Chrome extension + ensure cohesiveness.** Ship the Chrome extension and make sure it's cohesive with the rest of the product.
- [ ] **Add API docs page.** Add a public API documentation page.
- [ ] **Voice page setup redesign.** Redesign the voice page setup flow.
