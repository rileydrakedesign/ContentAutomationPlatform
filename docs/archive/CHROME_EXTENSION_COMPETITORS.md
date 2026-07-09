# Agents For X — Competitor Research Dossier

> Companion to `CHROME_EXTENSION_MARKETING.md`. This file is the raw competitive intelligence — install counts, ratings, pricing, positioning language, keyword maps, and review-mined gaps.
> Last researched: 2026-04-29. Re-audit quarterly.

---

## 1. Method

Sources used, with provenance clearly tagged in each section below:

- **`[CWS]`** — Direct fetch of the actual Chrome Web Store listing page. Highest-quality data: exact title, tagline, install count, rating, review count, features, permissions, last update.
- **`[CWS-mirror]`** — Indirect fetch via Extpose or similar CWS mirror, used when the live CWS page failed to render. Same data fields but slightly stale.
- **`[LP]`** — Marketing landing page only. Use with caution: vendor self-positioning often differs from how they actually present on CWS.
- **`[Review]`** — Mined from CWS 1–3 star reviews to surface user-reported pain points.
- **`[Article]`** — Third-party comparison articles (bisonary.com, folk.app) for cross-validation only.

**Update vs. previous draft (2026-04-29 second pass):** Several entries have been re-verified against the actual CWS listings. Two material findings emerged: (1) **Hypefury delisted their Chrome extension in November 2025** (confirmed via Extpose mirror), and (2) **BlackMagic.so — owned by the same developer (rohit@hypefury.com) — has the highest-quality CWS metrics in the category** (5K installs, 4.9★, 158 reviews). This means Hypefury appears to have abandoned the standalone extension and consolidated effort into BlackMagic.

**Limits:** install counts on CWS are bucketed (1K, 5K, 10K, 30K) — the exact numbers below are as displayed. Review counts are exact. Reply Pulse and Reply Boy CWS pages failed to render on three retry passes; their data below is `[LP]` only and should be treated as unverified until manually inspected.

---

## 2. Hard data — CWS listings (verified)

Sorted by CWS install count. All rows below are `[CWS]` direct fetch unless otherwise tagged.

### 2.1 Direct competitors (X creator tooling, AI replies, sidebars)

| Extension | CWS users | Rating | Reviews | Tagline (verbatim from CWS) | Pricing | Source |
|---|---|---|---|---|---|---|
| **Tweet Hunter X** *(formerly Twemex)* | 30,000 | 3.2 ★ | 93 | "Stop doomscrolling and start exploring. A browser extension that enhances X and guides you to the best content." | Free core; $23/mo ext; $49–99/mo platform | `[CWS]` |
| **SuperX (Twitter Analytics)** | 8,000 | 4.1 ★ | 56 | "Super insights for your X (Twitter) activities and engagements" | $39 Pro / $49 Advanced / $199 Ultra | `[CWS]` |
| **BlackMagic.so Extension** | 5,000 | **4.9 ★** | **158** | "Magic Sidebar by BlackMagic.so" | Free + $7.99/mo | `[CWS]` |
| **TweetAI.com - Smart AI Tweet & Reply Generator** | 1,000 | 3.0 ★ | 4 | "Smart AI Tweet & Reply Generator - get inspired in a click" | In-app purchases | `[CWS]` |
| **Tweet X-Ray for Twitter** | 476 | 5.0 ★ | 1 | "Get quick access to Twitter stats…" | In-app purchases | `[CWS]` |
| **X-Reply \| AI to reply** | 213 | 1.0 ★ | 3 | "AI to reply on all platform" | Unstated | `[CWS]` |
| **AI Tweet Reply Assistant for X** | 126 | 5.0 ★ | 6 | "AI-powered tweet replies with Grok API + Influence scores & rankings on X profiles" | Free (sketchy auto-reply) | `[CWS]` |
| **XposterAI: Engage with X effortlessly** | 28 | 5.0 ★ | 1 | "Engage with X effortlessly and grow your influence" | Free 30 credits / $6.99/mo / $49.99/yr | `[CWS]` |
| **Rrreply.com** | 13 | 5.0 ★ | 1 | "Harness the power of AI to craft personalized replies, boost engagement, and grow your Twitter audience." | Unstated | `[CWS]` |
| **Reply Pulse** | unverified | unverified | unverified | "Supercharge your X/Twitter Replies" | $9/$19/mo, $29 lifetime BYOK | `[LP]` only — CWS failed to render |
| **Reply Boy** | unverified | unverified | unverified | "1000𝕏 Your Twitter & LinkedIn Views" | unverified | `[LP]` only — CWS failed to render |

### 2.2 Adjacent / lower-relevance CWS extensions

Captured for completeness — different category but show up in the same searches:

| Extension | CWS users | Rating | Reviews | Tagline | Notes |
|---|---|---|---|---|---|
| **Superpowers for X** | 10,000 | 4.2 ★ | 509 | "Mass follow, mass unfollow, mass like, mass unlike, mass retweet…" | Mass-action / gray-hat. High volume but different category. |
| **Hypefury** | 231 | 4.43 ★ | 7 | "Your personal assistant to grow & monetize your Twitter audience" | **DELISTED Nov 2025.** `[CWS-mirror]` Extpose |
| **Twitter AI Bot - Auto Like, Comment & Grow** | 44 | 1.0 ★ | 4 | "AI-powered Twitter tool: auto like, comment, follow, retweet & favorite to boost engagement…" | Auto-engagement spam. Low-quality cluster. |
| **ReplyX - AI Auto Reply for X** | 49 | 0 (no ratings) | 0 | "Free AI-powered auto reply for X (Twitter). Grow your audience with smart, contextual responses." | Claude-API based; new entrant |
| **Twitter Growth Copilot** | 10 | 3.7 ★ | 3 | "Unlock your Twitter potential…the ultimate Chrome extension for savvy social media marketers and influencers!" | Gamified badges; thin |
| **X Auto Reply AI** | 13 | 2.3 ★ | 3 | "Automate your engagement on X (Twitter) with personalized AI-powered responses." | Spintax + scheduling — low quality |
| **XBoost AI - Twitter Growth System** | 3 | 0 (no ratings) | 0 | "AI-powered Twitter growth with gamification, analytics, and smart reply generation." | New, no traction |

### 2.3 Confirmed absent from CWS

These competitors heavily marketed as "Chrome extensions" but I could not find live CWS listings for them after multiple search passes. They may be in private beta, sideloaded, or pulled from CWS:

- **Bisonary** — landing page advertises a Chrome extension; no CWS listing surfaces in search.
- **Postwise** — no Chrome extension listing on CWS; marketed as a web dashboard.
- **Tribescaler** — no Chrome extension listing on CWS.

---

## 3. What the verified CWS data actually tells us

This is materially different from what landing pages claim, in three ways:

### 3.1 BlackMagic.so is the real category leader by quality

`[CWS]` data shows BlackMagic at **5,000 installs, 4.9★, 158 reviews** — the highest rating density of any extension in the category. Tweet Hunter X has 6× the installs but a 3.2★ rating with 93 reviews. **Quality of installs > quantity.**

The BlackMagic listing is also notably *minimal* — short tagline ("Magic Sidebar by BlackMagic.so"), no feature dump in the description, just a link to the website. That minimalism may be part of why the rating is so high: the listing under-promises and the product over-delivers.

### 3.2 Hypefury (a major dashboard player) abandoned the extension surface

The Hypefury Chrome extension was delisted in November 2025 with only 231 installs and a 4.43★ rating after years of operation. The same developer (`rohit@hypefury.com`) now runs the BlackMagic.so extension. **Strategic implication:** the dashboard-led players (Hypefury, Postwise, Tribescaler) have largely given up on the standalone extension. The CWS category is being abandoned by mid-market players and split between (a) extension-native specialists like BlackMagic, SuperX, Tweet Hunter X, and (b) low-quality auto-reply spammers. We sit in the (a) bucket and the bar is reachable.

### 3.3 The auto-reply spam cluster has ZERO traction

Verified install counts on the auto-reply / mass-engagement tools:

- ReplyX — 49
- Twitter AI Bot — 44
- X Auto Reply AI — 13
- AI Tweet Reply Assistant (Grok API) — 126
- X-Reply — 213
- XBoost AI — 3
- Twitter Growth Copilot — 10
- Rrreply — 13

**Total combined:** ~470 installs across 8 extensions. Average rating: ~2.5★. Multiple have 0 ratings. This entire sub-category has failed in market. Our positioning ("voice-fidelity, in-timeline, narrow-permission, legitimate") is the antithesis of these tools and is well-aligned with where the actual users are.

### 3.4 Listing-rating math: what's actually achievable

Across the verified competitors at our category intersection:

| Tier | Range | Examples |
|---|---|---|
| **Top of category (rating)** | 4.6–4.9★ | BlackMagic.so (4.9), Tweet X-Ray (5.0/1) |
| **Strong** | 4.0–4.5★ | SuperX (4.1), Hypefury at delisting (4.43) |
| **Mediocre** | 3.0–3.9★ | Tweet Hunter X (3.2), TweetAI (3.0), Twitter Growth Copilot (3.7) |
| **Failed** | < 3.0★ | X-Reply (1.0), X Auto Reply AI (2.3), Twitter AI Bot (1.0) |

**Realistic 12-month target:** 5,000 installs at 4.6+ stars. That is achievable — BlackMagic did it. Tweet Hunter X's 30K is achievable but at the cost of rating quality; the BlackMagic profile is healthier and we should mimic it.

---

## 4. Per-competitor deep dive

### 4.1 Tweet Hunter X / Twemex — the volume leader

- **Owned by:** lempire (Paris-based, also runs lemlist).
- **Strategy:** Enhanced sidebar for X — search, highlights, conversation history, recent hits. Was originally a beloved free tool (Twemex), got acquired and converted to freemium.
- **What works:** Sidebar UX is high-frequency; users open it daily for research before replying.
- **What's broken (mined from reviews):**
  - "Doesn't work at all. There is no sidebar (extension is not working with sidebar feature)"
  - "Suddenly unusable"
  - "It's not free as it says on their website"
  - "They shouldn't have acquired the sidebar app. MFs ruined it"
- **Lesson for us:** They lost the trust of their original audience by removing free features. Resentment is durable. Our free tier must remain genuinely free for the unmetered features (Save Inspiration, Opportunity Score), forever.

### 4.2 SuperX — the closest "all-in-one" competitor

- **`[CWS]` tagline:** "Super insights for your X (Twitter) activities and engagements"
- **`[LP]` taglines:** "Grow and monetize your audience, smarter faster" / "Your Growth Dashboard, Built Into 𝕏" / "Engage Smarter. Grow Faster."
- **Note the gap:** the CWS tagline is *much* weaker than their landing page copy. They're under-investing in their CWS listing relative to their funnel. We can outflank them on listing quality even at smaller install volume.
- **Feature stack:** AI post generation, smart scheduling, viral discovery, Chrome extension overlay, auto-retweet/auto-DM/auto-delete, mentions hub, multi-account (up to 10), Bluesky cross-posting.
- **Target users:** "Indie hackers, web creators, traders and analysts, founders, influencers."
- **Pricing:** $39 Pro / $49 Advanced / $199 Ultra — with frequent "limited-time" discounts that suggest soft demand at full price.
- **`[Review]` complaints:**
  - "Basically a scam, no option to cancel even though they offer a free trial"
  - "Make pricing clear before asking me to login"
  - "The X/twitter UI behaves erratically and sometimes just doesn't load"
  - "Breaks everything when you install the extension"
- **Lesson for us:** SuperX's bundling is its weakness. Their auto-DM and auto-retweet features attract users who churn fast and trash the rating. Stay narrow.

### 4.3 BlackMagic.so — the quality leader (NEW high-priority entry)

This is the most important competitor I missed in the first pass. Reaching this listing directly via CWS revealed it has the strongest signals in the category.

- **`[CWS]` exact name:** "BlackMagic.so Extension"
- **`[CWS]` tagline:** "Magic Sidebar by BlackMagic.so"
- **`[CWS]` description:** "BlackMagic.so extension brings a completely new experience to Twitter. The new sidebar provides useful information for your everyday Twitter activities. See more details at: https://blackmagic.so/" *(That's the entire description. ~30 words.)*
- **`[CWS]` user count:** 5,000
- **`[CWS]` rating:** **4.9 ★ / 158 reviews** — the highest rating density in the category by a wide margin.
- **`[CWS]` last update:** May 20, 2024 — *not* updated in nearly two years.
- **Pricing:** Free + $7.99/mo upgrade.
- **Owner:** Rohit (rohit@hypefury.com) — same developer as Hypefury. Hypefury delisted their own extension in Nov 2025; BlackMagic.so is the survivor.
- **Feature set per landing page:** sidebar with private user notes, follow-up reminders, complete past-interaction history (likes, retweets, replies), engagement analytics under each tweet, color-coded follower notifications (pink = long-time, green = new).
- **Why this is the most important data point:** BlackMagic has the most minimal CWS listing in the entire competitive set, has not been updated in 2 years, and yet has the highest rating density. This contradicts the "title-stuffing wins CWS rank" advice from generic SEO articles. Possible explanations:
  1. **Word-of-mouth-driven installs.** Users come in already pre-sold; the listing doesn't need to convert. Our marketing implication: build the kind of product creators recommend to other creators (private group chats, "what tools do you use" threads).
  2. **High retention from a small but loyal base.** 158 reviews on 5K installs is ~3.2% — way above typical CWS rates (industry average is 0.5–1%). This suggests a fanatically engaged user base — exactly the kind of users who leave 5-star reviews and tell friends.
  3. **The minimalism is a feature, not a bug.** BlackMagic doesn't try to be "AI replies + analytics + scoring + scheduling" — it's just a smarter sidebar with notes and history. Narrow product, narrow listing.
- **Lesson for us:** Don't *only* optimize the listing for keyword stuffing. The BlackMagic profile suggests a path that's about quality + retention + word-of-mouth. We should pursue both — listing SEO for top-of-funnel discovery, plus deeply loved product features for word-of-mouth. The two approaches compound.

### 4.4 ReplyPulse — pricing twin (CWS unverified)

> ⚠️ `[LP]` only. CWS listing failed to render after three retry passes. Manually verify install count, rating, and review count before basing strategy on this entry.

- **`[LP]` tagline:** "Supercharge your Replies"
- **`[LP]` pricing:** $9 Starter (500 credits) / $19 Pro (5,000 credits) / $29 *lifetime* with BYO OpenAI key.
- **Differentiator:** BYO API key for the lifetime tier — cost-conscious power users.
- **Lesson for us:** The lifetime+BYO offer is a strategic dead end (no recurring revenue, no model upgrades). What we should borrow: the tone-picker UX is well-known; our existing dropdown matches.

### 4.5 XposterAI — undercutter on price (CWS verified)

- **`[CWS]` tagline:** "Engage with X effortlessly and grow your influence"
- **`[CWS]` install count:** 28 users (5.0★, 1 review). **Almost no traction.**
- **`[LP]` pricing:** Free (30 credits, no card) / $6.99 monthly / $49.99 annual.
- **`[CWS]` last update:** April 28, 2026 — actively maintained.
- **Reality check:** They market aggressively (HackerNews launch, Microlaunch listing, YouTube demos) but the install count is 28. Don't over-index on their marketing — the data shows they haven't found product-market fit yet.
- **Lesson for us:** Their right-click tone-switch UX is genuinely good design; we already have a similar dropdown. Their target list ("Startup founders, designers, writers, agencies, community managers, marketers, indie creators, solo operators, and growth-focused teams") is too broad — diluted positioning is part of why they're stuck at 28 installs.

### 4.6 Bisonary — closest *positioning* twin (no live CWS listing)

> Bisonary markets a Chrome extension on their landing page but no live CWS listing surfaces in search. They may be in private beta or sideloaded. Treat their positioning as a marketing-claim signal, not a market-traction signal.

- **`[LP]` taglines:** "Get more engagement with better replies" / "Writing Copilot for X" / "Turn hesitation into replies" / "Built for people who grow through replies"
- **Differentiator they emphasize:** voice replies (spoken input → cleaned English) + style memory.
- **Lesson for us:** Their copy register ("hesitation," "flow," "momentum") is emotional and sticky — worth borrowing. They do not have opportunity scoring. The cleanest "vs Bisonary" pitch: *"Bisonary makes the reply easier; we make sure you're replying to the right post in the first place."*

### 4.7 The auto-reply spam cluster — verified failure mode

`[CWS]` data shows this entire sub-category has failed:

| Extension | Installs | Rating | What they sell |
|---|---|---|---|
| AI Tweet Reply Assistant (Grok API) | 126 | 5.0★/6 | "Random delay timing to avoid detection" |
| Twitter AI Bot - Auto Like, Comment & Grow | 44 | 1.0★/4 | Auto-like + auto-comment |
| ReplyX - AI Auto Reply for X | 49 | 0/0 | Auto-reply with Claude |
| X Auto Reply AI | 13 | 2.3★/3 | Spintax + scheduling |
| X-Reply | 213 | 1.0★/3 | Mass follow/unfollow + replies |
| Rrreply.com | 13 | 5.0★/1 | "Personalized reply automation" |
| XBoost AI | 3 | 0/0 | Gamified growth |
| Twitter Growth Copilot | 10 | 3.7★/3 | Achievement badges |

**Combined: ~470 installs, average rating ~2.5★.** This is a category-wide failure. Our positioning must be visibly different from these — narrow permissions, voice fidelity, no auto-anything, transparent pricing.

### 4.8 Adjacent dashboard players — the wallet competitors

These don't compete for the same CWS install but compete for the same monthly wallet:

| Tool | Position | Price | CWS extension? |
|---|---|---|---|
| **Postwise** | Multi-platform AI ghostwriter | $37 / $97 | None found |
| **Hypefury** | Auto-retweet, evergreen, growth automation | $29+ | **Delisted Nov 2025** |
| **Typefully** | Writing/threading editor | $12.50–29 | None found |
| **Tweet Hunter platform** | $49–99 viral library + AI writer | $49+ | Yes (Tweet Hunter X, 30K) |

The dashboard cohort has largely abandoned the standalone-extension surface. That's a tailwind for us — the field of well-marketed extensions is genuinely thin.

---

## 5. Keyword landscape

### 5.1 Saturated keywords (everyone uses these)

Avoid leading with these — diminishing returns:

- "AI reply" / "AI replies"
- "Twitter / X growth"
- "Engagement"
- "Voice match" / "your voice"
- "Viral"
- "Scheduling"
- "Smart"

### 5.2 Mid-saturation (use, but pair with differentiator)

- "Inspiration" — Hypefury (delisted), SuperX both use it; we match this
- "Sidebar" — Tweet Hunter, BlackMagic, folk all own this term — risky for us to compete on
- "Analytics" — SuperX dominates this term
- "Tone" — XposterAI, Bisonary, ReplyPulse
- "Magic" — BlackMagic owns it; avoid

### 5.3 Underused keywords (genuine opportunities)

These appear rarely or not at all in competitor listings — pursue them:

- **"Opportunity"** / **"opportunity score"** — uniquely ours
- **"Reply targets"** / **"high-value posts"**
- **"Reply strategy"**
- **"Pattern extraction"** — only we do this
- **"Velocity"** (post velocity, view velocity)
- **"Reply fit"**
- **"Timeline copilot"**
- **"In-timeline"** (vs. "in-context" which Bisonary owns)

### 5.4 CWS title structure observed

Patterns from `[CWS]` data:

- **Brand + parenthetical category:** `SuperX (Twitter Analytics)` — 8K installs
- **Brand + colon + feature + platform:** `Tweet Hunter X: Sidebar for X` — 30K installs
- **Brand + colon + benefit:** `XposterAI: Engage with X effortlessly` — 28 installs
- **Feature-led:** `AI Tweet Reply Assistant for X (Twitter)` — 126 installs
- **Brand + descriptor:** `BlackMagic.so Extension` — 5K installs (notably minimal — possible the brand is strong enough to carry it)

**Observation:** the title pattern alone does not determine traction. BlackMagic's minimal title outperforms XposterAI's benefit-led title by 180×. Title matters for *first-time discovery*; the rest of the listing (rating, review density, screenshots) matters for *conversion*.

Our recommended title format from `CHROME_EXTENSION_MARKETING.md` follows the brand-led-with-features pattern. Title changes propagate to CWS rank in 1–2 weeks.

---

## 6. Pricing landscape

| Tier | Price/mo | Players | Implication |
|---|---|---|---|
| **Free / no card** | $0 | TweetX, XposterAI free tier | Volume play; usually limited to lead generation |
| **Budget** | $6.99–9 | XposterAI, ReplyPulse Starter, **BlackMagic.so ($7.99)** | BlackMagic shows quality is achievable here; XposterAI shows the floor doesn't guarantee installs |
| **Sweet spot** | $19 | ReplyPulse Pro, **us** | "Serious tool" perception without sticker shock |
| **Mid-market** | $29–39 | Postwise, SuperX Pro | Bundled feature stack; high churn |
| **Premium** | $49–99 | Tweet Hunter, SuperX Ultra | Agency / power-user; selective |

**Reading:** Our $19/mo Pro lands exactly at the "I'm willing to pay for a tool that compounds" threshold. Below that, users perceive low quality (XposterAI's 28 installs at $6.99 is evidence). Above $29, the comparison set widens to bundled platforms. **One nuance:** BlackMagic.so achieves 5K installs at $7.99 with 4.9★ — proof that a budget price can work *if* the rating density is exceptional. We are not BlackMagic and shouldn't try to be. Stay at $19.

If we ever need pricing power, add a $39 "Pro+" tier for X API analytics sync rather than raising the base.

---

## 7. Failure-mode patterns from competitor reviews

Across the 1–3 star reviews of Tweet Hunter X and SuperX, four patterns dominate:

1. **Hidden paywalls.** Users feel ambushed by "free trial → instant charge" flows. *Our defense:* the popup already shows the 5/day limit and the upgrade button before any AI generation. Keep that.
2. **Extension breaks the underlying X UI.** Multiple SuperX reviews say it "breaks everything." *Our defense:* the existing "extension was updated, please refresh" notice (`content.js` already implements this) is a good failure-mode handler. Make it more prominent.
3. **Lost free features after acquisition.** Tweet Hunter X (formerly Twemex) is the cautionary tale. *Our defense:* a public, durable promise that Save Inspiration and Opportunity Score are unmetered on free, forever. Put this in the listing.
4. **Cannot cancel / unclear billing.** *Our defense:* one-click cancel from the dashboard. Mention this in the long description ("cancel anytime, no friction").

---

## 8. Chrome Web Store SEO — confirmed mechanics

From the SEO references (ultrablock, extensionranker case studies):

| Field | Char limit | Ranking weight | Our use |
|---|---|---|---|
| **Name** | ~75 | **Highest** | Stuff Tier 1 keywords + brand |
| **Short description** | 132 | Medium | 3 benefits + "X timeline" anchor |
| **Detailed description** | 16,000 | Lower (long-tail only) | Format with bullets; long-tail keyword density |
| **Reviews + rating velocity** | n/a | Significant | New reviews per 100 installs > 1.5 |
| **Install count** | n/a | Significant (compounds) | Day-1 activation > 60% to drive retention-weighted ranking |
| **Update frequency** | n/a | Minor signal | Update every 4–6 weeks even if minor |

**Confirmed case studies:**
- DictationDaddy: title + description optimization moved them from rank #19 → #6 in one week for "speech to text."
- Sidepanel for GPT: layered keyword density + placement got them to #3 with minimal users.
- One developer: traffic doubled in 2 weeks after title adjustment alone.

**Practical implications for us:**
- Title is the highest-leverage thing we can change. The current `manifest.json` name — `Agents For X` — is a brand-only title and leaves significant ranking value on the table.
- Move toward `Agents For X — AI Replies, Opportunity Scoring & Inspiration for X` (matches the format from the marketing doc, lands in the 75-char window, hits Tier 1 keywords).
- Title changes propagate fast (1–2 weeks). Track ranking weekly using ExtensionRanker or similar after any title change.

---

## 9. Strategic gaps we can credibly own

Synthesized from `[CWS]` verified data (sections 2, 3, 4):

| Gap | Evidence | Our move |
|---|---|---|
| **No competitor has reply-target scoring as a primary feature** | Verified across all 16 `[CWS]` listings — none mention opportunity scoring | Lead with Opportunity Score in screenshot 1 and short description |
| **Voice fidelity claims are everywhere but mostly hand-wavey** | SuperX/ReplyPulse/Bisonary all say "voice match" `[LP]` but show no mechanism | Show the 4 voice dials + pinned examples + guardrails in screenshot 2 |
| **The category's volume leader has a 3.2★ rating** | Tweet Hunter X (30K, 3.2★) `[CWS]` | Shoot for ≥ 4.6★ — the BlackMagic profile is the model, not the Tweet Hunter profile |
| **Quality leader (BlackMagic) has gone stale** | Last update May 2024 `[CWS]`; no AI features; sidebar-only | Be the *active, AI-native* equivalent — sidebar quality + reply generation + opportunity scoring |
| **The dashboard cohort has abandoned the extension surface** | Hypefury delisted Nov 2025; Postwise/Typefully/Tribescaler no CWS listing | Less competition than the dashboard tier suggests on paper |
| **The auto-reply spam cluster has zero traction** | Verified: ~470 combined installs across 8 extensions, avg 2.5★ | Our positioning explicitly opposite of theirs (narrow perms, voice fidelity, no auto-anything) |
| **Free tiers are either trivial or bait-and-switch** | XposterAI 30 credits one-time, Tweet Hunter X paywall confusion `[Review]` | Position 5/day free as "real, durable, two of three features unmetered forever" |
| **None of the top 5 publishes a changelog** | Manual check across listings | Ship a public changelog; cheap maintenance signal |
| **None of the top 5 explains their permissions in plain language** | `[CWS]` review of all listings | Add a "What we access and why" section in long description |

---

## 10. Implications for the listing — concrete edits

Based on all the above, the highest-ROI changes to make to the CWS submission, in priority order:

1. **Change the listing title.** Current `Agents For X` → recommend `Agents For X — AI Replies, Opportunity Score & Inspiration for X`. Single biggest ranking lever.
2. **Rewrite the short description.** Keep it under 132 chars. Use Tier 1 keywords (AI replies, opportunity score, X timeline) without keyword stuffing.
3. **Reorder screenshots.** Slot 1 must show the Opportunity Score pill on a real X timeline — that's the one thing nobody else has. Brand + voice + setup go after.
4. **Add a permissions explainer to the long description.** Three bullets: "Only `storage` + `activeTab`. We never read non-X tabs. We never see DMs."
5. **Add a "Free forever" promise.** "Save Inspiration and Opportunity Score are unmetered on free, forever. Only AI generations are metered (5/day free, unlimited Pro)."
6. **Link a public changelog from the extension footer.** The popup footer already has Privacy and Terms — add `Changelog`. Cheap maintenance signal.
7. **Pre-empt the cancellation complaint.** Long description should include: "Cancel anytime from the dashboard. No friction."

---

## 11. Updated competitive matrix (for sales / website use)

A clean comparison table for landing page or comparison-content blog posts. CWS install/rating data shown for credibility.

| | **Agents For X** | BlackMagic.so | Tweet Hunter X | SuperX | XposterAI | ReplyPulse | Bisonary |
|---|---|---|---|---|---|---|---|
| **CWS installs** | (launch) | 5,000 | 30,000 | 8,000 | 28 | unverified | no listing |
| **CWS rating** | (launch) | 4.9★ | 3.2★ | 4.1★ | 5.0★ (1) | unverified | n/a |
| In-timeline AI replies | ✅ | ❌ | Subscribers only | ✅ | ✅ | ✅ | ✅ |
| Voice dials (4) + guardrails | ✅ | ❌ | ❌ | "Voice match" claim only | Tones only | Tones only | Style memory only |
| **Opportunity Score** | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| One-click inspiration save | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Pattern extraction from analytics | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Sidebar / smart timeline | Partial | ✅ (best in class) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Free tier with unmetered features | ✅ | ✅ (notes are free) | Bait-and-switch | ❌ (paid only) | ❌ (30 credits one-time) | ❌ (credit-based) | ❌ (trial only) |
| Pricing | $19/mo | $7.99/mo | $23–99/mo | $39–199/mo | $6.99/mo | $9–19/mo | Trial only |
| Last update on CWS | (launch) | May 2024 (stale) | Active | Active | April 2026 | unverified | n/a |

**Honest read of this table:**
- **vs. BlackMagic.so**: They have the brand and the rating; we have AI replies + opportunity scoring + active maintenance. Position as "the AI-native sidebar."
- **vs. Tweet Hunter X**: They have volume; we have rating quality and a transparent free tier.
- **vs. SuperX**: They have the all-in-one bundle; we have focus.
- **vs. XposterAI / ReplyPulse / Bisonary**: We have opportunity scoring and pattern extraction; nobody else does.

---

## 12. Re-audit checklist

Re-run this research every quarter. Specifically, re-fetch:

- [ ] **BlackMagic.so listing** — has it been updated past May 2024? They are the rating quality benchmark.
- [ ] **Tweet Hunter X listing** — install count, rating, any title change
- [ ] **SuperX listing** — pricing changes, feature additions
- [ ] **XposterAI** — has install count moved past 28? Their marketing is loud but traction is thin.
- [ ] **Hypefury extension** — has it been re-listed?
- [ ] **Reply Pulse + Reply Boy CWS listings** — manually inspect (they failed to render in this pass; data is `[LP]` only)
- [ ] **Bisonary** — has a CWS listing appeared yet? Currently no live listing.
- [ ] Any new entrants in CWS search for "twitter ai reply" and "x reply generator"
- [ ] CWS rank for our Tier 1 keywords using ExtensionRanker

If a new competitor breaks 5K installs in our category, treat it as a signal worth a deeper investigation.

---

## 13. Source URLs (captured 2026-04-29)

### `[CWS]` direct listing fetches

- [SuperX (Twitter Analytics)](https://chromewebstore.google.com/detail/superx-twitter-analytics/bjobgelaoehgbnklgcaaehdpckmhkplk) — 8K, 4.1★/56
- [Tweet Hunter X: Sidebar for X](https://chromewebstore.google.com/detail/tweet-hunter-x-sidebar-fo/amoldiondpmjdnllknhklocndiibkcoe) — 30K, 3.2★/93
- [BlackMagic.so Extension](https://chromewebstore.google.com/detail/blackmagicso-extension/efnjehgfpbogpclnkikafpbgbahaflfd) — 5K, 4.9★/158
- [TweetAI.com - Smart AI Tweet & Reply Generator](https://chromewebstore.google.com/detail/tweetaicom-smart-ai-tweet/ofdpiejbkcpagdcllkfmchfddhpambkm) — 1K, 3.0★/4
- [Tweet X-Ray for Twitter](https://chromewebstore.google.com/detail/tweet-x-ray-for-twitter-t/ojiobkcdacceabmpiemjadcbbaibhebf) — 476, 5.0★/1
- [X-Reply | AI to reply](https://chromewebstore.google.com/detail/x-reply-ai-to-reply/odnknafjefdafbeodiihbieahkbbofgk) — 213, 1.0★/3
- [AI Tweet Reply Assistant for X (Twitter)](https://chromewebstore.google.com/detail/ai-tweet-reply-assistant/kjkcncliehongiolgfmdmjblloghhkkb) — 126, 5.0★/6
- [XposterAI: Engage with X effortlessly](https://chromewebstore.google.com/detail/xposterai-engage-with-x-e/knkdhaknphhnfdlhhckmhgfceepjlphi) — 28, 5.0★/1
- [Rrreply.com](https://chromewebstore.google.com/detail/rrreplycom/bbnldngeobpjnlnnfiapghebkhenlcpc) — 13, 5.0★/1
- [Superpowers for X](https://chromewebstore.google.com/detail/superpowers-for-x/lfmanfkmmgfigbnjibfemdnnfjboficn) — 10K, 4.2★/509 (mass-action category)
- [Twitter AI Bot - Auto Like, Comment & Grow](https://chromewebstore.google.com/detail/twitter-ai-bot-auto-like/mnpifalgcldomgdnijcgojfcflbpbfjj) — 44, 1.0★/4
- [ReplyX - AI Auto Reply for X (Twitter)](https://chromewebstore.google.com/detail/replyx-ai-auto-reply-for/mkoilkggpdklojdfgneoebbnjblpfnfh) — 49, 0/0
- [Twitter-Growth-Copilot](https://chromewebstore.google.com/detail/twitter-growth-copilot/eiijfghjjafhjnodcgdkjgkpnlgmdgik) — 10, 3.7★/3
- [X Auto Reply AI](https://chromewebstore.google.com/detail/x-auto-reply-ai/jlcljpncmmekablnmjpdibkflmlhadpd) — 13, 2.3★/3
- [XBoost AI - Twitter Growth System](https://chromewebstore.google.com/detail/xboost-ai-twitter-growth/pohpmpfbaenppabefjbgjfdhncnkfpml) — 3, 0/0

### `[CWS-mirror]` indirect (CWS page failed to render direct)

- [Hypefury via Extpose](https://extpose.com/ext/295347) — **DELISTED Nov 2025** (was 231 installs, 4.43★/7)

### `[CWS]` listings that failed to render (must re-verify manually)

- [Reply Pulse - Supercharge your X/Twitter Replies](https://chromewebstore.google.com/detail/reply-pulse-supercharge-y/bjoeldmfpoffkjdknipkjnbbiocadffa) — render failed 3x
- [Reply Boy](https://chromewebstore.google.com/detail/reply-boy/agdiliklplmnemefmlglajpdaimembli) — render failed 3x

### `[LP]` landing pages

- [SuperX](https://superx.so/) | [Tweet Hunter X / Twemex](https://tweethunter.io/twemex) | [ReplyPulse](https://replypulse.com/) | [XposterAI](https://xposterai.com/) | [Bisonary](https://bisonary.com/) | [Postwise](https://postwise.ai/) | [TweetX](https://tweetx.ai/) | [BlackMagic.so](https://blackmagic.so/)

### `[Article]` third-party comparisons

- [Bisonary's "Best Chrome Extensions for Twitter (X) 2026"](https://www.bisonary.com/blog/best-chrome-extensions-for-twitter)
- [folk.app's "Top 7 Twitter Chrome Extensions"](https://www.folk.app/articles/twitter-chrome-extension)
- [Brandled's SuperX Alternatives](https://brandled.app/blog/superx-alternatives)

### CWS SEO references

- [UltraBlock CWS SEO tips](https://ultrablock.org/seo-tips-for-chrome-web-store/)
- [Extension Ranker (CWS ranking case studies)](https://extensionranker.com/)
