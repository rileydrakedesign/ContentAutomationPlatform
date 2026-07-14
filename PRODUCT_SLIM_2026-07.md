# Product Slim — cut list for the reply-first package (2026-07)

> **Status:** **Tiers 1, 2, and 4 EXECUTED** (2026-07-13, branch `feat/product-slim`). Tier 3 is a freeze — nothing to do. The §3 build items and the §5.1 spike remain open.
> **Date:** 2026-07-13 · **Owner:** Riley
> **Evidence base:** `research/market-scan/2026-07-pmf-validation.md`, `2026-07-true-signal-addendum.md`, `2026-07-direct-competitor-scan.md`, `2026-07-algorithm-mapping-teardown.md`, `2026-07-algorithm-freshness-design.md`, `PRODUCT_FOCUS_2026-07.md`, `PRD_CORE_2026-07.md`, plus a 2026-07-13 scan of xAI/X native-feature shipping (§2.2 below).
> **What this is:** the concrete streamlining plan — every subsystem resolved into **keep / delete / retire / freeze / slim**, mapped to the actual files, routes, and MCP/API tools that carry it. `PRODUCT_FOCUS_2026-07.md` defines what the product *is*; this doc defines what it *stops being*, and in what order.

---

## 0. Execution amendment (2026-07-13) — where this doc was wrong

Tiers 1, 2, and 4 were executed on `feat/product-slim`. Validating the doc against the tree first
found it **largely accurate** — the file paths exist, the 36-tool count was right, and both ⚠️ C1
compliance flags were really in the code. But **four instructions below are wrong**, and were
executed differently. The doc text is left intact for the record; **this section wins where they
conflict.**

1. **Strategy (§4 Tier 1) — the split is inverted. Do not execute as written.**
   The doc says *"fold the weekly-quota fields into Settings; delete the rest."* But `pillar_targets`
   — the field "the rest" would delete — is read by `prompt-assembler.ts:684` and injected into the
   system prompt for the **live assistant, voice-check, every generation path, `get_writing_context`,
   tune-up, and insights-chat**. Deleting it would have degraded output quality across the product
   **with no compile error to catch it**. The `*_per_week` fields the doc wanted to *keep* are the
   deletable ones — they only fed a dashboard widget and one Voice Report line.
   **What shipped:** the `content_strategy` table, `pillar_targets`, `/api/strategy`, the v1 route,
   the scopes, and every prompt-assembler read are **untouched**. Only the *surface* moved — the
   `/strategy` page, its nav link, and the `StrategyProgress` widget are gone; editing now lives in a
   Settings → Strategy tab.

2. **Agentic pipeline (§4 Tier 2) — `post-pipeline.ts` could not simply be deleted.**
   `/api/drafts/refine` — a **kept** feature — imported `cleanDraft`, `splitThread`, `PIPELINE_MODEL`,
   and `DraftType` from it. **What shipped:** those helpers were extracted to `src/lib/ai/draft-text.ts`
   first (with new unit tests — they had none), `PIPELINE_MODEL` renamed to `DRAFT_MODEL`, and *then*
   the pipeline was deleted. Also: the pipeline had **no `CREDIT_COSTS` entries** (it was gated by
   `ai_usage_log` daily slots, not credits), and the "3-slot quota logic" was a single literal `3`,
   not a removable subsystem — the `weight` machinery is shared by 10+ kept routes.

3. **`publish_reply` deprecation (§4 Tier 2) — the handoff URLs it points at did not exist.**
   `find_reply_posts` → `/api/v1/search/reply-targets` returned `EnrichedSearchTweet`, which had **no
   URL field at all**, and `/api/reply/handoff` is **cookie-authed** (unreachable from an API key) and
   returns `{success:true}`, not a URL — the intent URL was built client-side only.
   **What shipped:** `post_url` and `intent_url` were added to the reply-target shape *first*; the
   410 `code: "deprecated"` response then points callers at `intent_url` (append
   `&text=<url-encoded reply>`). The doc also **missed a second `X_REPLY` branch** in the dashboard
   `POST /api/publish/now` — it had zero callers and was deleted outright.

4. **Unsolicited-mention guard (§4 Tier 2) — DEFERRED, not built.** Owner decision. The guard needs to
   know whether an account is "conversant," and **no conversation graph exists**: there is no
   mentions-timeline call in `src/lib/x-api/client.ts` and no table recording who has replied to the
   user. "Has this account talked to me" is unanswerable from anything we store — the only available
   signal is one-directional (handles the user has replied to, parsable out of
   `extension_replies.replied_to_post_url`). A real guard needs **net-new X API integration plus a new
   table**; it is not the lookup this doc assumes. The C1 mention-audit for
   `publish_post`/`publish_thread` therefore **stays open**. The reply-publishing half of C1 — the
   actual compliance exposure — **is closed**.

Also note: **the `agency_clients` migration was kept** (append-only, inert), as §4 says — but the doc's
agency file list was incomplete. `src/components/agency/AgencyClientsPage.tsx` (~590 lines, the actual
UI), `docs/guides/agency.md`, and a fourth exhaustive `Record<PlanId, …>` in `src/lib/api/limiter-config.ts`
all had to go with it.

---

## 1. The verdict, in one paragraph

Concentrate on the **Radar → Composer → Results reply loop delivered through the extension**, keep the own-analytics voice + analytics engine as its invisible spine, and cut or freeze everything that generates, publishes, schedules, or serves an unvalidated buyer. Every surface on the cut list is now at least one of: **commoditized** (scheduling at a $0 OSS reference price; generic scoring free as SEO bait), **stigmatized** (generation), **policy-blocked** (API reply publishing), **natively free inside X** (generic rewrite via the composer's xAI button; raw X search via `x_search`), or **unvalidated after three research passes** (agency tier). The product collapses from ~10 marketable subsystems to one loop with three surfaces — which also fixes the research's meta-finding that buyers "can't tell analytics-driven from $9.99 mimicry" because the surface area is too broad to read.

## 2. Why now — three converging lines of evidence

### 2.1 Our own PMF research (July 2026)

- Reply targeting is the **only feature users have ever specced unprompted**, and reply-guy growth is the mainstream July-2026 playbook (`2026-07-pmf-validation.md` §3, §6; `2026-07-true-signal-addendum.md` §3).
- The pre-publish "sounds-like-AI" score got **newly demand-validated**: users hand-roll it with general LLMs today (`true-signal-addendum.md` §1). It belongs *inside* the assistant as the activation hook, not as a standalone product.
- Scheduling/publishing has a **$0 reference price** (Postiz, 12k stars). Generation is **stigmatized** (score-1,901 "please stop using AI" thread). The agency tier is **pain-evidenced but demand-unproven** across three passes — gate is interviews only, no build (`pmf-validation.md` §4–§6).

### 2.2 What X/xAI now ships natively (scanned 2026-07-13)

- **Grok in the native composer** ("Enhance your post," tone rewrites, Premium+) commoditizes generic rewriting at the platform level. It is a *rewriter that takes the pen* — the coach-that-doesn't remains an empty lane, but only if we stop shipping generation-shaped surfaces next to it.
- **xAI `x_search` / Agent Tools API** (server-side X search for any developer, with citations and handle filters) commoditizes raw X-search. The *finding* layer alone is no longer defensible; what `x_search` structurally lacks is our loop: per-user engagement-weighted grounding, a measured outcome loop, and compliant reply delivery.
- **Grok agents now consume custom MCPs** — a second distribution channel for our (slimmed) MCP server next to Claude.
- The algorithm teardown's best finding got *more* marketable: X runs a Grok `slop_score` on every post at publish time (`2026-07-algorithm-mapping-teardown.md` §1c). "X literally scores your post with an LLM for slop — we run the same kind of read before you post." No competitor uses this.

### 2.3 Platform policy

The Feb-2026 X rules restrict programmatic replies and unsolicited @mentions/quotes across all self-serve API tiers (`true-signal-addendum.md` §4). The extension writing into X's native composer is the **only universally safe reply delivery route** — which is also our differentiated surface. The dashboard already moved to handoff v1 (commit `c8ce88f`); the public API/MCP reply path is the remaining exposure, and this doc retires it (§4 Tier 2).

## 3. What stays — the product after the slim

| Keep | What it is | Where it lives |
| --- | --- | --- |
| **Reply Radar** | Sweeps, watches (topic / custom plain-English / niche-seeded), ranked bounded daily queue, alerts. Custom trackers ship *inside* Radar, not as a separate feature. | `src/lib/radar/`, `src/app/api/radar/`, `REPLY_RADAR_SCOPE.md` |
| **In-composer coach** | The check engine (voice drift · algorithm risk · sounds-like-AI lint) in the editor and injected into X's composer. Copy frames the *algorithm* as the enemy, never the user's writing (`2026-07-reddit-signal.md` §1). | `src/lib/analysis/assistant/`, `src/lib/analysis/voice-check.ts`, `chrome-extension/` |
| **Reply handoff** | Intent-prefill → extension assist → copy. The only reply delivery path. | `src/app/api/reply/handoff/`, extension assist tier |
| **Voice + analytics spine** | Post/reply voice pools, patterns, niche, tune-up, timeline sync, weighted engagement, attribution. Backstage — powers everything, marketed as receipts, not as a surface. | `src/lib/analysis/`, `src/lib/voice/`, `src/app/api/x/analytics-sync` |
| **Voice Report provenance** | The one *build* item this doc endorses: show which pattern came from which top post. The moat is currently invisible to buyers (`icp-user-story/00-hypothesis-canvas.md` §0.2, gap #1). | `src/lib/voice/trait-cards.ts` + report UI |
| **Algorithm claims layer, slimmed** | Refactor `x-algorithm.ts` off the stale 2023 coefficient table to the ordinal, provenance-tagged claims store (tier A/B/C + source + expiry) per `2026-07-algorithm-freshness-design.md`. Competitors fabricate weights; our attack line is that we don't. | `src/lib/analysis/x-algorithm.ts`, `algo-watch.ts`, `freshness.ts` |
| **MCP + v1 API, slimmed** | Distribution for the write-yourself → check loop (§4 Tier 4), pointed at both Claude and Grok custom-MCP support. | `mcp/`, `src/app/api/v1/` |

## 4. The cut list

### Tier 0 — already done (recorded so nobody re-litigates)

| Item | Status |
| --- | --- |
| Duplicate Opportunity Score (extension hand-copy vs. server) | Unified in `c8ce88f` — `opportunityTraction()` in `engagement.ts` is the single formula; parity tests guard it. |
| Dashboard API reply publishing | Replaced by handoff v1 in `c8ce88f` (`x.com/intent/post?in_reply_to=…`). |
| BullMQ remnants, voice-memo/audio ingestion, `/api/capture` | Not found in the current tree (grep 2026-07-13) — already removed. `icp-user-story/03-features.md` §3.4 is stale on these. |
| Niche-accounts watch (legacy form) | No remnants found; superseded by Radar's niche-seeded watches (`5c9d15e`). |

### Tier 1 — delete now (dead weight, no strategic cost)

| Item | Files / routes | Rationale |
| --- | --- | --- |
| **Agency multi-account module** | `src/lib/agency/clients.ts`, `src/lib/agency/guard.ts`, `src/app/agency/page.tsx`, `src/app/api/agency/clients/` | Three research passes: pain evidenced, tool-demand unproven; gate is 5 customer interviews, **no build** (`pmf-validation.md` §4, §8). Delete the surface; the `agency_clients` migration stays (append-only, inert). Remove the agency tier from pricing/marketing surfaces at the same time. |
| **Strategy as a page + API surface** | `src/app/strategy/`, `src/app/api/strategy/`, v1 `strategy` routes, MCP `get_strategy`/`update_strategy` | Both pivot docs demote it to Settings; nothing in the validated loop reads it as a first-class surface. Fold the weekly-quota fields into Settings; delete the rest. |

### Tier 2 — retire for compliance + focus

| Item | Files / routes | Rationale |
| --- | --- | --- |
| **API/MCP reply publishing** | `X_REPLY` branch in `src/app/api/v1/publish/now/route.ts` (the ⚠️ C1 compliance flag is the open decision — this doc closes it: **deprecate**), MCP `publish_reply` in `mcp/src/tools.ts` | Feb-2026 rules put API replies in the enforcement blast radius; the handoff is the only safe route and already exists. Return a structured error pointing callers at `find_reply_posts` handoff URLs. |
| **Agentic generation pipeline** | `src/lib/ai/agentic/post-pipeline.ts` + its SSE/QStash plumbing and the 3-slot quota logic | Heaviest infrastructure serving the most stigmatized feature, now competing with a free native Grok button. Keep only single-shot "seed a draft" as an unmarketed on-ramp. |
| **Unsolicited-mention audit for `publish_post`/`publish_thread`** | Same route + MCP tools | Not a removal — close the open audit flagged in the C1 comment: block or warn on @mentions of non-conversant accounts before publish. |

### Tier 3 — freeze (works, zero investment, never marketed)

| Item | Where | Rationale |
| --- | --- | --- |
| Scheduling/publishing for original posts | `src/lib/publish/execute.ts`, `src/app/api/publish/*`, QStash + cron dual path | Users expect it; it's a $0-commodity feature. Keep the safety-net architecture as-is; no new features, no marketing. |
| Quick generation ("seed a draft") | `/create`, `/api/v1` generation, MCP `generate_post`/`generate_reply` | Demand exists but stigmatized — starting points only, never the hero (`pmf-validation.md` §6). |
| Inspiration library | capture + `src/app/api/inspiration/`, library UI | Backstage feed for voice/patterns; no new UI. |
| Best-times | MCP `get_best_times`, `posts-pool.ts` | Cheap derived read; keep, don't extend. |

### Tier 4 — slim the distribution layer (MCP catalog audit)

The 36-tool catalog is generation-and-publish-centric — it tells agents to ghostwrite, the exact story the research says to exit (`icp-user-story/03-features.md` §3.2 contradiction #1). Target catalog:

| Disposition | Tools |
| --- | --- |
| **Keep — the loop** | `get_writing_context`, `check_draft`, `find_reply_posts` (reshape: return handoff URLs, never publish), `get_analytics`, `sync_analytics`, `get_voice_settings`, `update_voice_settings`, `list_patterns`, `toggle_pattern`, `get_niche`, `run_tuneup`, `get_tweet`, `whoami`, `health`, `get_credits`, `send_feedback` |
| **Keep — drafts on-ramp** | `create_draft`, `get_draft`, `update_draft`, `delete_draft`, `list_drafts`, `list_published` |
| **Keep, demote in docs** | `generate_post`, `generate_reply` (descriptions reframed to "seed a draft you'll edit — run `check_draft` before publishing"), `search_tweets`, `add_inspiration`, `list_inspiration` |
| **Keep, frozen** | `publish_post`, `publish_thread` (post-audit mention guard), `schedule_post`, `cancel_scheduled`, `list_queue`, `get_best_times` |
| **Remove** | `publish_reply`, `get_strategy`, `update_strategy` |

Then register the slimmed server against **Grok's custom-MCP support** as a second agent channel next to Claude. Update `docs/mcp/*` and the tool tour so the catalog leads with `get_writing_context` → `check_draft` → `find_reply_posts`.

## 5. Open questions that gate the plan

1. **Radar data source: pooled X API reads vs. xAI `x_search`.** PRD_CORE §12's #1 open item (pooled/cached-read ToS) now has a second candidate answer: spike `x_search` (Responses API) as the sweep/discovery source — compare cost, result fidelity for `since_id`-style sweeps (it returns synthesized results with citations, not raw streams), and ToS exposure. The answer materially changes Radar Phase 1's architecture. **Do the spike before freezing Phase 1.**
2. **Composer real estate.** X's native xAI button now lives where our orb injects. Add DOM-drift monitoring for the compose box and decide orb placement relative to the native button. Extension fragility is now a product risk, not a maintenance chore.
3. **Grok-native voice grounding (the moat-kill scenario).** Grok holds every user's post history at zero cost. If X ships "Grok writes/coaches in *your* voice from *your* top posts" in the composer, the closed own-analytics loop stops being unique. Nothing announced does this yet (current personalization is prompt-based). Watch for it explicitly in the weekly `algo-watch` sweep; provenance (§3) is the counter — receipts Grok doesn't show.

## 6. Sequencing

1. **Week 1 — deletions + decisions (Tier 1, Tier 2 decision):** delete agency + strategy surfaces; deprecate API/MCP `publish_reply`; open the `x_search` spike.
2. **Week 2 — distribution slim (Tier 4):** MCP catalog audit + doc rewrite; mention-guard audit for `publish_post`/`publish_thread`; point the server at Grok custom MCPs.
3. **Weeks 3–4 — concentration:** `x-algorithm.ts` → provenance-tagged claims store; Voice Report provenance; Radar Phase 1 architecture locked pending the spike.
4. **Ongoing:** freezes are enforced by omission — no roadmap items, no marketing copy, no new callers for anything in Tier 3.

## 7. Relationship to other docs

- `PRODUCT_FOCUS_2026-07.md` / `PRD_CORE_2026-07.md` — define the target product; this doc executes their **drop/demote** column with file-level specificity and adds the July-13 xAI landscape.
- `REPLY_RADAR_SCOPE.md` — unchanged as the Radar spec, except Phase 1's data source is now gated on the `x_search` spike (§5.1).
- `backlog.md` — items superseded by this doc: agency tier build-out, MCP tune-up (now Tier 4), reply-via-new-tab workaround (shipped as handoff v1), voice-to-post (already dropped).
