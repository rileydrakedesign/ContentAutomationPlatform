# PRD — The Core Product (2026-07)

> **Status:** Draft for Riley's sign-off · **Date:** 2026-07-08
> **Supersedes:** `PRD.md` for core scope (kept for history). Decision record: `PRODUCT_FOCUS_2026-07.md`. Architecture donor docs: `REPLY_RADAR_SCOPE.md`, `GRAMMARLY_PIVOT_PLAN.md`, `docs/architecture/voice-system.md`.
> **Evidence:** `research/market-scan/2026-07-pmf-validation.md` · `2026-07-true-signal-addendum.md` · `2026-07-reddit-signal.md`. Every requirement here traces to validated demand or a platform constraint; peripheral features are explicitly listed in §8 and get no new investment.

---

## 1. Product statement

> **We watch X for the conversations worth joining. You write the reply — with a coach that keeps it in your voice, aligned with the algorithm, and free of AI smell. Then we show you exactly what each reply earned.**

Three pillars, one loop:

| Pillar | Job | Surface |
|---|---|---|
| **① Reply Radar** | *Find the moment* — watch topics/phrases/accounts, surface a bounded ranked queue of reply-worthy posts, alert on perishable windows | Radar (dashboard + extension badge) |
| **② Assisted Composer** | *Write it yourself, coached* — one composer, one check bar: **Voice · Algorithm · AI-sound**; hand off to X compliantly | Composer (dashboard + extension in-composer) |
| **③ Analytics** | *Learn what worked* — per-reply outcomes + account-level trends; feed back into Radar ranking and the voice context | Results |

**Everything else in the codebase is peripheral** (§8): it either silently feeds these pillars or is frozen.

## 2. Who it's for, and the job

**ICP (unchanged from BRIEF):** build-in-public founder / indie creator, 500–50k followers, spends time inside X, wants growth without ghostwriting or automation risk. Pro-user tell: already knows "reply guy" as a strategy (it is the mainstream 2026 playbook — live signal).

**JTBD:** *"When I have 20 minutes for X, let me spend it replying to the right posts with replies that perform — instead of doomscrolling for targets or shipping generic AI text that gets me sneered at or suspended."*

**Why now (the defensibility triangle):**
1. X killed automated replies (Feb-2026 API rule + ban waves) → the *finding* can be automated, the *writing* legally can't → our exact split.
2. Audiences punish AI-sounding text, escalating monthly → coach > generator.
3. The algorithm is open source and favors replies the author engages with (~150× a like) → our checks have receipts.

## 3. Pillar ① — Reply Radar

### 3.1 The one primitive: Watch

All discovery is a **watch**. Three types, one pipeline, identical output cards.

| Type | Created by | Sweep unit (pooled?) | Example |
|---|---|---|---|
| **Topic watch** | Auto from niche analysis (`niche-analyze.ts` pillars → compiled queries); user trims | Pooled per cluster | "indie SaaS marketing" |
| **Custom watch** | **User types a plain-English phrase** → we compile keyword queries + an embedding centroid; test sweep shows "~N matches/24h" + sample posts before saving | Personal, daily read budget | "student chat products", "AI writing pain points" |
| **Account watch** | Seeded from engagement history + niche 10k–100k band; user add/remove (≤30 on Pro) | Pooled (union of all users' watchlists, batched `from:` queries) | @levelsio |

**Semantic gate (the quality bar for custom watches):** keyword queries are recall-only; every candidate is embedded and scored against the watch's centroid. "AI writing pain points" must surface *complaints and questions*, not tool promos — a candidate classified as vendor self-promo is dropped. This is what makes a custom watch feel like magic instead of a saved search.

### 3.2 Pipeline (per `REPLY_RADAR_SCOPE.md` §4, unchanged economics)

Sweep (cron, `since_id` cursors, per-unit daily budgets, 2M/mo cap accounting) → shared `candidate_posts` pool (TTL ~7d, metric snapshots for velocity) → per-user scoring → `user_target_queue` upsert → queue + alerts. Pooled reads make marginal user cost ≈ $0 in dense niches; a personal custom watch is hard-capped at ≤$7.50/mo COGS (50 reads/day budget).

### 3.3 Ranking — Opportunity Score 2.0 (one implementation, legible)

Single server-side formula (kills the drifted extension duplicate — BACKLOG EXT-8/9): **topic fit** (embedding vs watch centroid) · **author band** (10k–100k proven band; Phase-3: learned per user from Results) · **freshness + velocity** ("14 min old and accelerating") · **competition** (reply count vs views) · **traction** (canonical `weightedEngagement`, `engagement.ts`) · **repliability** (`reply_allowed` fail-closed + already-replied dedup). Every factor emits a reason string; the card shows "why this, why now" in plain words. Extension pill consumes the same shared constant + parity test.

### 3.4 Queue & alerts

- **Daily queue:** bounded 10–15 cards ("your 20-minute session, pre-hunted"). States: new / snoozed / replied / skipped (skip reasons feed ranking). The bound is the product promise (anti-vigil) — never an infinite feed.
- **Real-time alerts:** per-watch toggle; fires only on high-urgency (fresh + accelerating + low competition, or watched account just posted). Channels: extension badge + browser push; email digest daily.
- **Card anatomy:** post preview · why-reasons · angle hint (from the user's patterns: "your contrarian-take replies outperform") · one primary action: **Write reply**.

### 3.5 Requirements

- R1.1 A niche-analyzed user gets ≥10 repliable on-niche cards/day with zero hand-written queries.
- R1.2 Custom watch creation: phrase → test sweep preview (~N/24h + 3 samples) in <30s; firehose phrases warned and budget-capped at save.
- R1.3 Alert→card→composer open in ≤2 clicks from the extension badge.
- R1.4 A post already replied to (by handoff record or timeline sync) never resurfaces. 
- R1.5 Sweep spend visible internally per unit/day; platform alert at $25/day (existing `usage-rollup`).

## 4. Pillar ② — Assisted Composer

### 4.1 One composer, everywhere

The dashboard editor and the extension's on-X composer assist are **one product**: same assembled voice context (`prompt-assembler.ts`), same check engine, same check bar component (shared constant + parity test, same pattern as the engagement-bait lists). The standalone Create page is folded in; generation survives only as a **"starting point"** button inside the composer (credits), never as a front door.

### 4.2 The check bar — three lights, one interaction

One bar, three segments; each flag = anchored span + plain-words reason + one-click fix/dismiss. Maps onto the existing 3-tier engine (`GRAMMARLY_PIVOT_PLAN.md` §6) — no new architecture:

| Segment | What it checks | Tier / cost | Source of truth |
|---|---|---|---|
| **Algorithm** | link penalty, reply-hook, engagement-bait, dwell/length, media nudges; for replies: the LLM-judge/spam-screen realities | Tier 0 deterministic, free, every keystroke | `computeAlgorithmFlags()` + `x-algorithm.ts` (open-source receipts, weekly algo-watch diff) |
| **Voice** | deviation from *your* fingerprint; matched/missing proven patterns | Tier 2 merged "Live Read" (one LLM call: voice + resemblance + patterns), cached by draft hash | `runVoiceCheck` core + assembler context |
| **AI-sound** | banned-phrase list, "it's not X it's Y" reversals, rule-of-three, uniform sentence rhythm, em-dash density, cliché openers — **seeded from the user's own corpus** (phrases *they* never use get flagged harder) | Tier 0 deterministic lint free; Tier 1 cheap-model judgment on pause | New lint module + personal rubric derived from voice examples. Users already DIY this exact check (live signal, 2026-07-07) |
| Headline | one 0–100 **Ship Score** = blend (voice · resemblance · algorithmFit), same thresholds as today (80+ green) | computed | pivot plan §7 |

Reply mode: composer always carries parent-post context; voice type `reply` (fixes G6 in the extension).

### 4.3 Simplified voice construction (directive: simpler than today)

**Principle: the voice is *derived*, not configured.** Today's construction surface (4 sliders + 7 modes + guardrails + special notes + examples CRUD + inspiration + pattern toggles) collapses to three user-visible things:

1. **Connect X.** Sync pulls top posts/replies; auto-selects examples by engagement (existing example selection), extracts patterns, analyzes niche. Tuneup re-runs on cadence/freshness triggers automatically (`getContextFreshness` → auto `run_tuneup`, no button to remember).
2. **A card deck of derived traits, not sliders.** The tuneup renders what it learned as 5–8 plain-English trait cards ("You write short, punchy, no emojis", "You take sides", "You never use hashtags") — each with **keep / not me** toggles. Internally these set the existing `UserVoiceSettings` dials; the user never sees a 0–100 slider or a "stance_neutral_opinionated" control again.
3. **One free-text box:** "Anything the coach should know / never do" → maps to guardrails + special notes.

Everything else — examples CRUD, pattern toggles, inspiration weighting, prompt preview — moves backstage (Settings → Advanced, unchanged APIs, no redesign). **Cold start without X history:** 3-example paste-in OR a 60-second "write two sample replies" exercise, then derive. The Voice Report remains the demonstration artifact (first-session activation), now framed as "here's the voice we learned" with the trait cards inline.

### 4.4 The handoff (replies cannot use the API — by design, not workaround)

`Post on X` degrades through three tiers, always ending with the user posting from their own session:

1. **Intent prefill (default):** open `x.com/intent/post?in_reply_to=<target_id>&text=<reply>` — X's composer opens on the post, prefilled; user hits Post. Verified in the official Web Intents docs; zero API surface.
2. **Extension assist (best):** extension intercepts the handoff, navigates to the post, mounts the check bar in X's native reply composer for final tweaks.
3. **Copy fallback:** copy + open post (covers the known mobile-app intent bug).

On handoff we persist a **handoff record** `{user, target_post_id, composed_text, watch_id, ts}` — the attribution key for Pillar ③. Non-reply posts may still publish via API where the Feb-2026 mention/quote rules permit (audit required); replies never do.

### 4.5 Requirements

- R2.1 Tier-0 checks render <10ms/keystroke; Tier-2 Live Read ≤3s on pause, cached by hash (unchanged text = free).
- R2.2 Check bar is one shared component (dashboard + extension) with a parity test.
- R2.3 Voice onboarding: connect → derived trait cards + Voice Report in first session, ≤2 minutes, zero required configuration.
- R2.4 AI-sound lint ships with a public-pattern base list + per-user rubric; every flag names its pattern ("rule-of-three") — no black-box "seems AI" verdicts.
- R2.5 Handoff tier-1 success ≥95% on desktop; card→posted reply <3 min in dogfooding; **zero** reply-publish API calls in telemetry.
- R2.6 Checks are never a gate: Post is always one click; checking is the default-visible but optional path (existing publish-gate stance).

## 5. Pillar ③ — Analytics (per-post + general)

### 5.1 Per-reply outcomes (the loop's currency)

Attribution: newest own posts (existing analytics sync) matched against handoff records (`in_reply_to` id + fuzzy text). Per matched reply, within 24h:

| Metric | Status | Source |
|---|---|---|
| Impressions | ✅ | own-post `non_public_metrics` |
| **Profile clicks** | ✅ | `user_profile_clicks` (per-post API field) |
| **Author engage-back** (replied / liked) | ✅ | conversation lookup + liking_users, small-N cached |
| Author followed you | ✅ (watched targets) | relationship lookup |
| Follows gained | ⚠️ labeled estimate | follower-delta windows around reply sessions — directional, never causal |

### 5.2 General analytics

Account-level: weighted engagement trend (canonical `engagement.ts`), best-times (kept, but consumed as a Radar timing factor + a Results insight, not a standalone tab), reply-vs-post mix, watch-level performance ("your 'AI writing pain points' watch produced 4 engage-backs this month").

### 5.3 The feedback loops (what makes this a moat)

1. **→ Radar:** per-user factor re-weighting from outcomes (which bands/topics/windows convert *for them*); surfaced legibly ("replies to 10–50k accounts converted 3× better — retuning your queue").
2. **→ Voice:** top-performing replies auto-refresh voice examples and pattern extraction (existing tuneup inputs) — the voice tracks what *works*, not just what user wrote long ago.

### 5.4 Requirements

- R3.1 Reply outcomes visible ≤24h after posting; each Results row: target, your reply, 3 numbers, engage-back badge.
- R3.2 Follower metrics always carry the "estimate" label; no causal claims in UI copy.
- R3.3 Watch re-ranking measurably shifts queue composition within 30 days (visible in a "what changed" note).
- R3.4 All reads on user tokens; own-post re-reads ride the 24h dedup window (COGS ≈ existing analytics sync).

## 6. Data model (delta only)

New: `sweep_units` · `candidate_posts` · `user_target_queue` · `watches` (type, phrase, compiled queries, centroid, budget, alert toggle) · `handoff_records` · `reply_outcomes`. Existing (unchanged, backstage): voice settings/examples, patterns, niche, inspiration, captured posts, drafts, analytics snapshots.

## 7. Packaging

| | Free | Pro $29 | Credits |
|---|---|---|---|
| Radar | 2–3 cards/day (pooled topic watches) | Full queue + ≤30 account watches + **2–3 custom watches** + real-time alerts | extra watches / raised budgets |
| Composer | Tier-0 checks + AI-sound lint + first-session Voice Report | Full check bar (Live Read) unlimited | starting points, deep checks |
| Results | last 7 days | full history + loops | — |

Activation north star: **first coached reply through the handoff in session 1.** Radar is the subscription driver (daily-felt anti-vigil); custom watches are the demo-able wow.

## 8. Peripheral features — explicit disposition

| Feature | Disposition |
|---|---|
| Capture/save-to-library, inspiration | Keep, backstage — feeds voice/patterns; no new UI investment |
| Pattern extraction/controls | Keep, backstage — powers angle hints + trait cards |
| Voice sliders/modes/examples CRUD/prompt preview | Keep APIs; demote UI to Settings→Advanced (§4.3) |
| Scheduling/queue, threads, post drafts | Keep as utility; never marketed; mention-rule audit applies |
| MCP/API surface | Keep (distribution); reply tools reshaped to handoff model; audit |
| Create page | Fold into composer ("starting point" button); retire route |
| Voice memo/transcript → drafts | **Delete** (UI now, code in cleanup PR) |
| Best-times tab | Merge into Radar factor + Results insight |
| Agency tier | Gated on 5 interviews; nothing built |
| Multi-platform | Refused; X-only depth is the moat |
| Auto-posting/auto-reply of any kind | Never (policy-dead, wedge-defining) |

## 9. UX skeleton

- **Nav: Radar · Composer · Results** (+ Settings). Nothing else top-level.
- **Onboarding (session 1):** connect X → auto niche analysis + voice derivation (progress screen doubles as "what we're learning" reveal) → Radar pre-seeded (topic + account watches) → first card → composer with check bar → handoff → "come back tomorrow, your queue refills at 9am." Zero blank states, zero required configuration, first felt value ≤5 minutes.
- **Extension:** badge = queue count + urgent alerts; on X: native-composer check bar, save/capture, card handoffs land here when installed.

## 10. Metrics

**North star:** % of new users with ≥1 handoff-posted, voice-checked reply in session 1 (target >50%, BRIEF §8).
**Retention driver:** weekly queue act-rate (replied+skipped / delivered ≥60%; skip-with-reason counts as signal, not failure).
**Moat proof:** Radar-sourced engage-back rate vs user baseline (≥2× within 60 days).
**Quality:** check-flag act-rate ≥30%; false-positive dismissals on AI-sound lint <20%.
**COGS guardrails:** reads/day per unit vs budget; 2M cap headroom; $/delivered card.

## 11. Rollout (maps to `PRODUCT_FOCUS_2026-07.md` §8)

**Wk 1–2:** handoff v1 (tiers 1+3) · score unification · reply-voice in extension (G6) · AI-sound lint Tier-0 · voice trait-card derivation (reads existing settings; no schema change).
**Wk 3–6:** sweep pipeline + topic/account watches + queue + budgets · niche seeding (G2) · coach-first extension reply UX · handoff tier 2.
**Wk 7–10:** custom watches (phrase → compile → test sweep → semantic gate) + real-time alerts · Live Read consolidation (one merged Tier-2 call) · nav collapse to three surfaces.
**Wk 11–13:** Results attribution + loops · watch re-ranking · launch content (algorithm receipts).

## 12. Risks & open questions

| Risk | Mitigation |
|---|---|
| Web intent deprecation/changes | It's X's own embed surface; tiers 2+3 already cover failure; monitor via algo-watch cron |
| Intent prefill strips text on some clients (known mobile-app bug) | Desktop-first ICP; extension tier-2 preferred; copy fallback |
| Semantic gate precision on custom watches (promo vs pain) | Test-sweep preview sets expectations; skip-reasons retrain the gate; start conservative (drop borderline) |
| Pooled-read ToS posture (scope §4.5) | Compliance read before Phase-1 freeze — **still the #1 open item** |
| Voice trait derivation feels wrong → distrust | "Not me" toggle per card + free-text box; report shows *evidence* per trait (the posts it came from) |
| Queue quality in cold/thin niches | Watchlist-heavy cold start (user-curated accounts) until niche model warms |

**Open questions:** (1) does the Tier-2 Live Read merge (voice+resemblance in one call) hold quality at Haiku-class cost? benchmark in wk 3; (2) alert channel priority (badge vs push vs email) — dogfood then commit; (3) exact free-tier card count (2 vs 3) — set after COGS observation.
