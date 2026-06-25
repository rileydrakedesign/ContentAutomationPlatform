# Agents For X — ICP & User Story Brief

> **⚠️ PIVOT UPDATE (2026-06-25):** This brief (dated 2026-06-19) predates the **Grammarly-style pivot**. The **strategy below still holds** — ICP, the wedge (closed own-analytics voice loop), market, anti-ICP, pricing, and account-safety urgency are all unchanged. What changed is the **product form**: from an AI that writes *for* you (generation-primary) to a **real-time writing assistant** where *you* write and it keeps the post on-voice and on-algorithm (assistant-primary). This *strengthens* the wedge (now demonstrated live, not claimed) and resolves the riskiest step here — **activation / "sounds like me"** — at the root. Read the reconciliation and all marketing/brand work in **`../marketing-positioning/`** (start with `00-positioning-and-pivot.md`). Where this brief says "generate in your voice," read "keep your writing in your voice as you type."

> **The consolidated, standalone deliverable.** Detail and sourcing live in `00`–`06`. Purpose: GTM/marketing, product prioritization, onboarding. Pre-launch, so conclusions are evidence-backed hypotheses with post-launch tests.
> **⚠️ One open validation:** Reddit was hard-blocked during research; persona emotional/workflow detail leans on Indie Hackers, HN, and Substack. The behavioral *shape* is solid; an authenticated Reddit pass is the #1 follow-up to confirm intensity and a few specifics. Setup is staged (see README).
> **Date:** 2026-06-19

---

## 1. The ICP, in one sentence
> **A solo founder or operator who lives on X to grow their product and personal brand, is anxious about sounding like generic AI, and will pay for a tool that makes everything they post and reply sound like *them* — and like what actually works for their account — with them in the loop.**

## 2. The strategic verdict (resolving the central question)
The product straddled two audiences — human creator vs. agent-builder. **It's creator-primary.** The differentiated product is a **voice/identity layer**; the agent/MCP surface is a **distribution channel and near-future bet**, not the buyer. Sold as "an MCP server" it anchors to **$0**; sold as "tweet in your voice / grow on X" it anchors to **$19–$199** with proven revenue (Typefully ~$1.4M ARR / 130K customers). Good news from code reconciliation: the earlier "two products" risk has **closed** — web, extension, API, and MCP now share one voice context, one currency, one reply engine.

## 3. The wedge (what we are that rivals structurally aren't)
**The closed loop: engagement-weighted pattern extraction from the user's OWN analytics → drafting in their proven voice → account-safe reply targeting → publish → re-tune.** No competitor closes it. The universal #1 complaint about every AI-writing tool — *"it sounds generic / not like me"* — is validated from both the complaint side (Phase 2) and the desire side (Phase 4). **But buyers can't tell us from $9.99 style-mimicry (PostOwl) on a feature list — so the depth must be DEMONSTRATED, not claimed.**
- NOT the wedge: MCP (Typefully ships it free), separate post/reply voices (PostOwl has them), posting/scheduling (free OSS MCP servers), AI replies (commoditized + now an account risk).

## 4. The audience structure
| Tier | Who | Role | Build need |
|---|---|---|---|
| **PRIMARY (launch)** | Build-in-Public Founder/Operator (solo, 500–50K followers; reply-growth at the small end, original posts at the larger end — *same person, different stage*) | Cheapest CAC (dogfoodable on X+IH), perfect feature fit, bridge to the agent future | None — features fit today |
| **SECONDARY (expansion)** | Scaling Ghostwriter / Small Agency (stuck at 2–5 client ceiling) | Highest WTP; their #1 pain (voice drift across clients) IS our wedge | **Multi-account/agency tier** (proof-gated) |
| **CHANNEL / FUTURE** | Creator-Who-Automates (technical subset wiring an agent via MCP) | Distribution wedge; near-future bet | None — sell creator outcome |

## 5. Anti-ICP (repel in copy)
Casual posters (<1×/wk) · mass-reply/autopost spammers · B2B brand/marketing teams (left X for LinkedIn; want brand not personal voice) · multi-platform seekers · pure MCP devs expecting free.

## 6. Market reality (directional)
- SAM ~50–150K serious growth-focused creators; but **SOM compresses to single-digit-thousands of paying seats** (~$0.7–3.5M ARR) — category leaders have only 1–6K paying customers despite "30–50K user" headlines. **Conversion in a crowded SAM, not market size, is the constraint.**
- **$29 Pro is validated** (dead-center of the $15–49 band); room for a **~$199 agency tier**.
- **Existential risk: the X API** (~1 hostile pricing/policy change/year; Black Magic was killed by one). The in-house API migration de-risks this. *(Correction: X Basic API is now $200/mo, doubled from $100; our 30-credit link-post premium correctly mirrors X's ~13× link surcharge.)*

## 7. Positioning rules
1. **Demonstrate voice depth, don't claim it** — the visible Voice Report ("these patterns came from *your* top posts ×N") is the eval + activation artifact.
2. **Lead with voice fidelity + account safety**, never "10× volume" (attracts churners; "AI mush" is the fear).
3. **For agencies: "stop voice drift across clients,"** never "we automate your voice" (= "we automate your value"); position against ChatGPT's weakness, not as "another X growth tool."
4. **Transparent pricing as trust** (course/tool-burned buyers; rivals have silent-renewal reputations).
5. **X-only is a feature.** "Built for X. Nothing else."

## 8. The journey & the one thing that matters most
Trigger (shipped → crickets) → Discovery (skeptical) → Evaluation (Voice Report) → Onboarding (cold-start) → **Activation: "yes, this sounds like me"** → Habit → Expansion → Advocacy.

**Riskiest step = Activation.** Everything before it is acquirable with copy + proof; everything after depends on the first generated/checked output *feeling* like the user's voice. If it's generic, the #1 fear is confirmed and they leave.

- **North-star metric:** *Time-to-first-"sounds-like-me"* — % of new users who produce ≥1 accepted, voice-checked post/reply in session 1 (target >50%).
- **The deep job:** "Remove the blank page" — bridge a half-idea to an on-voice tweet grounded in what works for *them*. (Users think they lack *ideas*; they lack the *bridge*.)

## 9. What to build next (priority order)
1. **Make voice depth visible** — Voice Report as eval/activation artifact *(Gap #1 — highest leverage; fixes both the riskiest journey step and the core GTM problem)*.
2. **Harden cold-start** — the bridge to activation for thin-history users.
3. **Surface account-safety** as a promise/feature *(Gap #3 — cheap; converts a fear into a reason-to-buy)*.
4. **Outcome attribution** ("your AFX posts vs. baseline") *(Gap #4 — retention/advocacy driver nobody has)*.
5. **Agency multi-account tier** *(Gap #2 — high-ACV expansion; proof-gated; build after the primary loop hums)*.
6. **Cut dead code** (voice-memo, `/api/capture`, BullMQ, niche-accounts) and **unify the duplicate Opportunity Score** (extension client-side vs. server `findReplyTargets`).

## 10. GTM reachability map
- **Primary:** Indie Hackers, HN, WIP.co, #buildinpublic on X (dogfood), Small Bets Discord, creator partnerships (5–50K "grow on X" accounts), Chrome Web Store SEO.
- **Agency:** guru economy — Premium Ghostwriting Academy (Cole/Bush), Ship30/Typeshare, Kieran Drew, Justin Welsh; the "invite your ghostwriter/client" seat loop.
- **Automator:** Claude/MCP registry, r/ClaudeAI, #buildinpublic (distribution wedge).

## 11. Post-launch tests (because we're pre-launch)
- Activation rate + voice-check acceptance by acquisition source (validates primary ICP).
- Reply-loop completion (`find_reply_posts` → published reply).
- Free→Pro conversion; "did this sound like you?" survey in session 1.
- Agency: gated beta demo→paid conversion at $199 after seeing per-client proof.
- Automator: # arms-length OAuth clients; credits via MCP vs. web.

## 12. Open items / honest gaps
- **Reddit validation pending** (#1) — confirm trigger intensity, reply-safety panic, scrolling-waste, "would you pay."
- PostOwl is one analytics-feature from copying the wedge — re-check it before launch; the moat is *depth + data position + demonstration*, durability MODERATE.
- Sizing is triangulated, not census-grade (Size axis weakest).
- "Creator who automates" demand is latent, not loud — the key uncertainty before over-investing in the agent channel.
