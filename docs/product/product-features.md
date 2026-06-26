# Product Features — Current-State Catalog

> A flat inventory of **what the product does today**, organized by user-facing area, with a
> one-line status and a pointer to the engineering source of truth. Complements the
> [PRD](prd.md) (the *why*) and [`docs/features/`](../features/README.md) (the *how*).
>
> **Updated:** 2026-06-26. ✅ live · 🟡 partial / in-flight · ⏸ deferred.

---

## Write & assist (the core)

| Feature | Status | Notes | SoT |
|---|---|---|---|
| Real-time writing assistant (live underlines, scores, fixes) | ✅ | On by default; editor is the front door of `/create` | [writing-assistant](../features/writing-assistant.md) |
| Tier-0 deterministic checks (links, bait, reply-hook, length, reach) | ✅ | Client-side, free, every keystroke | ↑ |
| Voice Match + Performance scores (embeddings) | ✅ | ~1s after pause, unmetered | ↑ |
| Live Read (LLM voice-drift findings + missing-pattern chips) | ✅ | On-demand, unmetered, hash-cached | ↑ |
| One-click Accept / Dismiss fixes | ✅ | Span-anchored replacements | ↑ |
| Decorated editor (ProseMirror inline decorations) | ✅ | Replaced the textarea overlay | ↑ |
| L1 local grammar/clarity (WASM) | ⏸ | Planned; tiny filler list is the placeholder | ↑ |
| Thread-level scoring (per-tweet + hook strength) | ⏸ | Phase 4 | ↑ |

## Generate (on-ramps)

| Feature | Status | Notes | SoT |
|---|---|---|---|
| Quick generation (topic → draft) | ✅ | 1 quota slot; seeds the editor | [generation](../features/generation.md) |
| Agentic generation (research → draft → voice-check → refine) | ✅ | 3 slots; SSE chain + async QStash path | ↑ |
| Refine (feedback-driven revise) | ✅ | Lightweight, no pipeline | ↑ |
| Reply generation | ✅ | In-voice, reply guidelines | [reply-finder](../features/reply-finder.md) |
| Seed-the-editor handoff | ✅ | `draft:new:seed` → `/drafts/new`, no DB write until saved | [generation](../features/generation.md) |
| From-inspiration on-ramp | ✅ | `?inspiration=` routes to AI Generate | ↑ |

## Voice & strategy

| Feature | Status | Notes | SoT |
|---|---|---|---|
| Voice dials (tone/energy/stance/directness/humor/emoji/authenticity) | ✅ | `user_voice_settings` (post + reply) | [voice-engine](../features/voice-engine.md) |
| Guardrails (avoid words/topics, custom rules, special notes) | ✅ | Feeds prompt assembly + Tier-0 | ↑ |
| Voice examples (pinned + auto-captured) | ✅ | `user_voice_examples` | ↑ |
| Pattern extraction (engagement-weighted, multipliers) | ✅ | `extracted_patterns` | ↑ |
| Niche profile | ✅ | `user_niche_profile` | ↑ |
| Voice check (0–100 + deviations) | ✅ | `voice_check_results`; feeds calibration | ↑ |
| Tune-up loop (refresh examples/patterns/niche) | ✅ | Retune recommendation | ↑ |
| Content strategy / progress | ✅ | `/strategy` | — |

## Analytics & insights

| Feature | Status | Notes | SoT |
|---|---|---|---|
| Analytics sync (X API) + CSV upload | ✅ | `user_analytics` | [analysis-and-insights](../features/analysis-and-insights.md) |
| weightedEngagement (canonical scoring) | ✅ | All scoring routes through it | ↑ |
| X-algorithm model (weights + flags) | ✅ | 2023 heavy-ranker + 2025 Grok caveat | ↑ |
| Prepublish read (resemblance + algorithm-fit + patterns) | ✅ | Cold-start + confidence | ↑ |
| Insights report / chat | ✅ | | ↑ |
| Outcome attribution ("your posts vs baseline") | ✅ | Home dashboard card | ↑ |
| Voice health · consistency · boost opportunities · best times | ✅ | Dashboard surfaces | ↑ |

## Publish & schedule

| Feature | Status | Notes | SoT |
|---|---|---|---|
| Publish now (post / thread / reply) | ✅ | In-house X client | [publishing-and-scheduling](../features/publishing-and-scheduling.md) |
| Schedule + queue | ✅ | Cron sweep + QStash | ↑ |
| Media upload | ✅ | Chunked; durable re-upload | [x-integration](../features/x-integration.md) |
| Failure handling / retry / cancel | ✅ | | [publishing-and-scheduling](../features/publishing-and-scheduling.md) |
| Char counting + link surcharge | ✅ | `tweet-text`; URL credit premium | ↑ |

## Reply growth

| Feature | Status | Notes | SoT |
|---|---|---|---|
| Reply target finder | ✅ | `/reply`, search → reply-targets | [reply-finder](../features/reply-finder.md) |
| Opportunity score (should I reply?) | 🟡 | **Duplicated** server vs extension — known seam | ↑ |
| In-extension reply pill + generate | ✅ | `extension_replies` | [chrome-extension](../features/chrome-extension.md) |

## Surfaces & integration

| Feature | Status | Notes | SoT |
|---|---|---|---|
| Chrome extension (orb + underlines + pill on X) | ✅ | Tier-0 client-side; shared TS engine | [chrome-extension](../features/chrome-extension.md) |
| In-X fuzzy (LLM) underlines | 🟡 | Deterministic-only on X today; fuzzy → panel | ↑ |
| MCP server (~36 tools) | ✅ | write+check loop; catalog still gen-heavy | [mcp-and-public-api](../features/mcp-and-public-api.md) |
| Public v1 REST API + OpenAPI/Scalar | ✅ | `/developers`; drift test | ↑ |
| X OAuth / account connect | ✅ | PKCE | [x-integration](../features/x-integration.md) |

## Billing

| Feature | Status | Notes | SoT |
|---|---|---|---|
| Plans (Free/Pro/Agent/Agency) + Stripe | ✅ | Webhook idempotency | [billing-plans-and-credits](../features/billing-plans-and-credits.md) |
| Assistant entitlement (unmetered) | ✅ | `requireFeature("writingAssistant")` | ↑ |
| Generation daily quota | ✅ | `ai_usage_log` | ↑ |
| API/MCP monthly credits + packs | ✅ | `credit_ledger`, `user_credits` | ↑ |
| Free → Tier-0-only gating | ⏸ | Lever exists, not pulled | ↑ |
| In-app publish metering | 🟡 | Only v1/MCP meters publish — known gap | [publishing-and-scheduling](../features/publishing-and-scheduling.md) |
