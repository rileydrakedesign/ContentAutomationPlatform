# Phase 0 — ICP Hypothesis Canvas

> **Status:** Draft, internal-grounding only. Every claim here is a *bet to be tested* in Phases 1–4, not a conclusion.
> **Scope decisions (locked with founder):** Purpose = GTM + product prioritization + onboarding (not fundraising). Audience = let research decide (creator vs. agent-builder is the headline open question). Data = pre-launch / thin.
> **Date:** 2026-06-19

---

## 0.1 The headline finding: the product is two products wearing one name

Our internal docs describe **two materially different products**, and the engineering investment has been migrating from the first to the second:

| | **Product A — "Creator-in-timeline"** | **Product B — "Agent voice-tuner / API"** |
|---|---|---|
| Primary surface | Chrome extension injected into x.com | MCP server (36 tools) + hosted OAuth gateway + v1 REST API |
| Core loop | See post → Opportunity Score → 1-click AI reply / save inspiration | Agent calls `get_writing_context` (free) → writes → `check_draft` → `publish` |
| Defined in | `CHROME_EXTENSION_MARKETING.md`, `PRODUCT_FEATURES.md` (P0 = extension) | `docs/`, `MCP_*` plans, `credits.ts`, memory's active projects |
| Pricing in doc | $19/mo Pro (extension doc) | $29 Pro / $79 **Agent** tier (subscription.ts) |
| Monetization | Free 5 gens/day → Pro upgrade | Credits (1cr=$0.01), metered per action |
| Recent build effort | Frozen-ish (legacy framing in PRODUCT_FEATURES) | All recent work (W1-W8, voice tuner, cohesiveness, close-the-loop) |
| Founder's own recent usage | `extension_replies`=130 (older) | `search.per_post`=22, `publish.tweet`=9, v1 drafts (recent) |

**Pricing drift is a tell:** the extension marketing doc still says "$19/mo Pro"; the live subscription model says $29 Pro + $79 Agent. The docs were written for Product A; the product became Product B. This is the central thing the research must resolve: **is Agents For X a creator tool that happens to have an API, or an agent/developer platform that happens to have a creator UI?**

---

## 0.2 What the thin data actually tells us

The DB is effectively **N=1 (founder dogfooding) + 8 stale waitlist signups** — not a behavioral sample. Single-row tables: `subscriptions`, `user_credits`, `user_settings`, `x_connections`, `user_niche_profile`, `content_strategy`, `api_keys`. So we read it as *"what the builder believes the core loop is,"* not market evidence.

- **Reply-finding + publishing is the live loop.** Recent credit spend is dominated by `search.per_post` (find reply targets, 22), `publish.tweet` (9), and API draft generation. The reply-growth motion is what's actually being dogfooded.
- **The free-context path is barely used server-side** (`generate-reply`=8, `drafts.generate`=5 total). Consistent with the design intent that agents write directly via free context — but unconfirmed at scale.
- **Voice tuning is exercised but light** (`voice-check`=2, `voice-tuneup`=1). The "moat" feature has thin real-world reps.
- **OAuth/MCP has been exercised** (19 oauth_tokens, 1 oauth_client) — the agent surface works and has been connected (likely to claude.ai), but by the founder.
- **No external adoption signal exists yet.** 8 waitlist signups, last one 2026-03-18 (3 months stale). We have *zero* arms-length users. This hard-confirms the "pre-launch / proxy research" posture for Phase 4.

**Security note (surfaced, not acted on):** `waitlist_signups` has RLS disabled — it's readable/writable by anyone with the anon key. Worth fixing before any public launch. Remediation SQL is `ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;` plus appropriate insert policy.

---

## 0.3 Three candidate ICPs (falsifiable bets)

### Candidate 1 — "The Deliberate X Creator" (human, in-timeline)
- **Profile:** Solo creator/founder/operator, 500–50K followers, posts 5–20×/week, already pays for X Premium and likely one of Typefully/Hypefury/Tweet Hunter/Black Magic. Niche operators (AI, fitness, finance, real estate), devrel, SaaS marketers.
- **The bet:** They buy *voice fidelity + reply targeting* (Opportunity Score) as a daily in-timeline habit; conversion comes from the Chrome extension free tier.
- **Why it might be right:** It's the most-documented ICP; the extension's in-timeline UX is a genuine wedge; reply-growth is a real, widely-taught X strategy; founder dogfoods exactly this loop.
- **Why it might be wrong:** Crowded category; AI replies are commoditizing; the extension is *not* in the credits/MCP world the product is now built around; "voice tuner" value is hard to feel on day 1; 5/day free cap may not convert.
- **Falsify / confirm via:** competitor review mining (do users of Hypefury/TH actually complain about voice?), proxy interviews on reply workflow, WTP for an extension vs. dashboard.

### Candidate 2 — "The Reply-Growth Operator" (human, growth-hacking sub-segment)
- **Profile:** Narrower, more intense version of #1. Growth is their explicit goal; spends 30–90 min/day replying to bigger accounts; thinks in terms of "which post is worth my reply."
- **The bet:** Opportunity Score + `find_reply_posts` + voice-true replies is a category nobody else sells; this is the sharpest, most defensible wedge.
- **Why it might be right:** Unique mechanic (Opportunity Score); matches founder's actual heaviest loop (`search.per_post`); clear, painful, frequent job.
- **Why it might be wrong:** May be too narrow a population to sustain a business; overlaps heavily with #1 (could be a *use case* of #1, not a separate ICP); risk of attracting spam-reply seekers (an anti-persona).
- **Falsify / confirm via:** community signal (build-in-public, reply-guy discourse), sizing the sub-segment, testing whether "reply targeting" or "voice" is the stronger hook.

### Candidate 3 — "The Agent-Builder / Developer" (technical, API/MCP)
- **Profile:** Developer or automation-savvy operator wiring Agents For X into an AI agent (Claude, a custom assistant, an automation) via MCP/API. May be building for themselves or for clients. The $79 Agent tier, per-key scopes, hosted OAuth, and free `get_writing_context` were all built for them.
- **The bet:** The real differentiated product is "the voice/identity layer for agents that post to X" — the thing an agent calls so its output sounds like a specific person and is metered/safe.
- **Why it might be right:** It's where *all recent engineering went*; MCP/agent ecosystem is rising fast; "voice context as an API" is a genuinely novel, defensible position; credits model fits agent consumption; aligns with the brand name "Agents For X."
- **Why it might be wrong:** Tiny/nascent market today; developers may just call an LLM directly; unclear who pays (the dev? the creator behind the agent?); no evidence of arms-length demand; longer sales/integration cycle; harder onboarding.
- **Falsify / confirm via:** sizing the MCP/agent-tooling ecosystem trajectory (Phase 1, decisive), scanning for competing "social MCP" entrants (Phase 2), dev-community signal (Phase 4).

---

## 0.4 The creator-vs-agent decision, framed

These aren't mutually exclusive, but **GTM, onboarding, and the next quarter of roadmap can only optimize for one primary.** The plausible resolutions:

1. **Creator primary, agent surface as a power-user channel** — lead with the extension/dashboard; MCP is an advanced add-on. (Bet on #1/#2.)
2. **Agent-builder primary, creator UI as the reference consumer** — lead with "voice layer for X agents"; the web app is the showcase. (Bet on #3.)
3. **"Creator who runs an agent"** — a synthesis ICP: a creator technical enough to connect Claude/an agent to their X via MCP, getting hands-off voice-true posting. This is the bridge persona and may be the truest fit given the product as built.

**Working hypothesis to test (lowest-confidence, highest-leverage):** Resolution #3 — the buyer is a *creator*, but the differentiated, defensible product is the *agent voice-layer*, and the wedge user is the creator-who-automates. Phases 1–4 should be designed to confirm or kill this.

---

## 0.5 Anti-ICP (carried from internal docs, to validate)
- Casual posters (<1×/week) — install, churn, tank rating.
- Mass-reply / autopost spammers — voice-fidelity story is designed to repel them; do not court.
- Multi-platform users (LinkedIn/Threads/Bluesky) — X-only is positioning, not a gap.

---

## 0.6 Open questions feeding Phases 1–4
1. Is the agent/MCP-for-social market real and growing enough to be a *primary* (Phase 1), or a bet-on-the-future secondary?
2. In the creator category, is the unmet need *voice fidelity* or *reply targeting* — which is the stronger wedge? (Phase 2 reviews, Phase 4 signal)
3. Who pays in the agent scenario, and how much? (Phase 1 WTP, Phase 4 dev signal)
4. Which features are orphans (serve no clear ICP) and should be deprioritized? (Phase 3)
5. What is the day-1 activation moment for each candidate ICP? (Phase 6)

---

## 0.7 Hypotheses → tests map (post-launch validation hooks)
Since we're pre-launch, each ICP bet ships with an instrumented test to run once we have users:
- C1/C2: extension install → day-1 activation (≥1 reply or save) and free→Pro conversion by acquisition source.
- C2: % of `find_reply_posts` calls that lead to a published reply (the reply-growth loop completion rate).
- C3: # of distinct API keys / OAuth clients connected by arms-length users; credits consumed via MCP vs. web.
