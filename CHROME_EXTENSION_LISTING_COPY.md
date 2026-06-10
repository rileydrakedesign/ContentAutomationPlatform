# Agents For X — Chrome Web Store Listing Copy Proposal

> Companion to `CHROME_EXTENSION_MARKETING.md` (positioning) and `CHROME_EXTENSION_COMPETITORS.md` (research).
> This doc proposes exact strings for `manifest.json` and every CWS dashboard field.
> Last updated: 2026-04-29.

---

## 1. Constraints we're optimizing under

These are non-negotiable CWS mechanics — every proposal below must respect them.

| Field | Where it lives | Limit | Ranking weight | Notes |
|---|---|---|---|---|
| **Listing title** | `manifest.json` → `name` | 75 chars (truncates ~45 in some UIs) | **Highest** | The single biggest ranking lever |
| **Short description** | `manifest.json` → `description` | 132 chars | Medium | Shown directly under title in CWS search |
| **Browser display name** | `manifest.json` → `short_name` | 12 chars | None (UI only) | What users see in `chrome://extensions` |
| **Detailed description** | CWS dashboard | 16,000 chars | Lower (long-tail) | Optimal length 1,500–2,500 chars |
| **Category** | CWS dashboard | one selection | Significant | Productivity > Social Networking for our category |
| **Screenshots** | CWS dashboard | up to 5 × 1280×800 PNG | Conversion | Slot 1 = search-result thumbnail |
| **Promo images** | CWS dashboard | small (440×280), marquee (1400×560) | Featured-eligibility signal | Optional but recommended |
| **Single purpose statement** | CWS dashboard | ~140 chars | Required | Must match listed permissions |
| **Permission justifications** | CWS dashboard | ~1,000 chars each | Required | One per permission requested |

**Rejection triggers to avoid** (per Chrome Web Store policy):
- Keyword stuffing in title (e.g., `AI Twitter X Reply Generator AI Reply Tweet AI Tool`)
- Repeating the same phrase across multiple fields
- Mismatch between description and actual permissions
- Claims of features the extension doesn't deliver
- Generic phrases like "best" or "top-rated" in title

---

## 2. Keyword allocation map

The right division of labor across fields is the difference between a listing that ranks and one that doesn't. Two principles:

**Principle 1 — Title and short description must use search keywords, not product names.** Internal feature names like "Opportunity Score" or jargon like "voice-trained" are defensible but not searchable. Nobody types those into CWS search. The title and short description are pure ranking real estate, so they get user-language keywords that match real search queries.

**Principle 2 — Defensible and product-specific terms live in the long description.** Once a user clicks through, the body copy can introduce our internal feature names (Opportunity Score, voice dials, pattern extraction) and explain why they matter. By that point, ranking has done its job and positioning takes over.

### Tiered keyword inventory

| Keyword | Search volume | Used by | Rankability |
|---|---|---|---|
| AI replies / AI reply | High | 8+ competitors | High — must appear in title |
| Reply generator | High | TweetAI, ReplyPulse, X-Reply | High — long-tail in body |
| Twitter / X | High | All | High — platform anchor everywhere |
| Tweet replies | Medium | Several | Medium — body |
| Personalized | Medium | None directly | Medium — short description |
| Reply targeting | Medium long-tail | None | Medium — gap; goes in title |
| Find tweets to reply to | Medium long-tail | None | Medium — paraphrase in short desc |
| Save tweets / save posts | Medium | None directly | Medium — short description |
| Voice / voice match | Low–medium, ambiguous | SuperX, Bisonary, ReplyPulse | Low — body only, with care |
| Opportunity Score | Zero (invented term) | Only us | Not rankable; product-name only |
| In-timeline | Low (invented term) | Only us | Not rankable; positioning only |

### Where each keyword goes

| Keyword | Title | Short desc | Long desc | Why |
|---|---|---|---|---|
| AI replies | Yes (1×) | No (already in title) | Yes (2× max) | Top search query, must own |
| Reply targeting | Yes (1×) | No | Yes (1×) | Searchable version of "Opportunity Score" |
| X / for X | Yes | Yes | Throughout | Platform anchor |
| Twitter | No | No | Yes (1×) | Legacy search; one mention suffices |
| Personalized | No | Yes | Yes (1×) | Plain-English replacement for "voice-trained" |
| AI drafts | No | Yes | No | Variant phrasing, captures variant searches |
| See which posts are worth your reply | No | Yes (paraphrase) | Yes (variant) | User-language version of opportunity scoring |
| Save tweets / save posts | No | Yes | Yes (1×) | Plain version of "inspiration saving" |
| Tweet replies / reply to tweets | No | No | Yes (1× each) | Long-tail capture in body |
| Engagement | No | No | Yes (1×) | Contextual only |
| Growth | No | No | Yes (1×) | Contextual only |
| Opportunity Score (capitalized) | No | No | Yes (1× as feature name) | Internal product name; explained as a defined term |
| Voice | No | No | Yes (1× max) | Use carefully; pair with explanation |
| Pattern extraction | No | No | Yes (1×) | Adjacent feature mention |
| Sidebar / Magic | Never | Never | Never | BlackMagic owns these; don't compete |
| Best / top / #1 | Never | Never | Never | CWS rejection trigger |
| Generator | No | No | Yes (1×) | Generic, one mention captures variant search |

**The discipline:** every keyword appears in exactly the fields marked, no more. The internal product names ("Opportunity Score," "voice dials") are introduced once each in the body, where the surrounding sentence defines what they mean. That gets us defensible positioning without sacrificing rankability.

---

## 3. Proposed `manifest.json` changes

### 3.1 Diff from current

```diff
 {
   "manifest_version": 3,
-  "name": "Agents For X",
+  "name": "Agents For X: AI Replies and Reply Targeting for X",
+  "short_name": "Agents For X",
   "version": "2.0.1",
-  "description": "AI-powered reply generation, opportunity scoring, and post saving for X (Twitter)",
+  "description": "Reply faster on X with personalized AI drafts, see which posts are worth your reply, and save tweets you love.",
   "permissions": [
     "storage",
     "activeTab"
   ],
   ...
 }
```

### 3.2 Field-by-field rationale

#### `name` → `Agents For X: AI Replies and Reply Targeting for X`

- **Length:** 50 characters. Well under the 75-char hard limit and well under the ~45-char truncation point that some Chrome UIs apply.
- **First 30 chars** (what shows in cramped displays): `Agents For X: AI Replies and R`. Brand and lead keyword both visible.
- **Brand-first** because brand recall is the most durable ranking signal. Users who later type "agents for x" must hit us.
- **Colon separator** (not em-dash). Cleaner across UIs and matches the pattern of the highest-volume competitor (Tweet Hunter X: Sidebar for X, 30K installs).
- **Two features named, both rankable:**
  1. `AI Replies` — top search query in this category, must appear in title.
  2. `Reply Targeting` — searchable user-language version of our Opportunity Score feature. Maps to long-tail searches like "find tweets to reply to" and "best tweets to reply to." Nobody else owns this phrase, so we can claim it.
- **What we deliberately did NOT include:**
  - "Opportunity Score" — internal product name. Zero search volume. Lives in the body where context defines the term.
  - "Voice" / "voice-trained" — ambiguous (microphone confusion) and lower search volume than initially modeled. Lives in the body where we can explain it.
  - "Inspiration" — Tier 2 keyword, but the title is stronger with two well-supported features than three thin ones. Inspiration saving is described in the short description and body.
  - "Best," "top," "free," "AI" used as a duplicate adjective. Each word appears once.

#### `short_name` → `Agents For X`

- **New field** — not currently in the manifest.
- **12 characters** at Chrome's recommended limit. Used in `chrome://extensions`, the toolbar tooltip, and other cramped UI surfaces.
- **Why it matters:** the longer SEO-optimized `name` would look ugly in the browser's extension menu. `short_name` separates the search-visible string from the install-visible string.

#### `description` → `Reply faster on X with personalized AI drafts, see which posts are worth your reply, and save tweets you love.`

- **Length:** 110 characters. Comfortably under the 132 limit.
- **Plain English throughout.** Zero invented or jargon terms. Every phrase maps to a real search query.
- **Three keyword captures, none duplicating the title:**
  - `personalized AI drafts` — variant of the "AI replies" search cluster, brings in users searching for "personalized" tools. Replaces the previous "voice-trained" which was ambiguous.
  - `see which posts are worth your reply` — paraphrase of "find tweets to reply to" (a real long-tail query). Describes the Opportunity Score feature in user language without using the internal term.
  - `save tweets you love` — captures "save tweets" search variants. Plain replacement for the previous "in-timeline inspiration saving" which mixed an invented term with jargon.
- **Benefit-led opening** (`Reply faster on X`). The first three words have to earn the click in CWS search results, where this string sits directly under the title.

### 3.3 `version` bump

Bump to `2.0.1` (or whatever's next) when this change ships. CWS notes the update date on the listing — **listings updated within the last 90 days rank higher** than stale ones (BlackMagic.so's 2-year-old listing is the cautionary counter-example).

### 3.4 `permissions` — keep as-is

```json
"permissions": ["storage", "activeTab"],
"host_permissions": ["https://x.com/*", "https://twitter.com/*", "https://app.agentsforx.com/*"]
```

No changes. The narrow permission set is a **positioning advantage** (per `CHROME_EXTENSION_MARKETING.md` P6). Don't expand without serious reason.

---

## 4. CWS Dashboard fields

These fields don't live in `manifest.json` — they're set in the Chrome Web Store developer dashboard.

### 4.1 Detailed description (long copy)

**Length target:** ~1,800 characters (sweet spot per CWS SEO guidance).
**Structure:** the proven CWS conversion structure — hook → features → how it works → audience → privacy → pricing → support.

```
Reply smarter on X. Without leaving the timeline.

Agents For X is the AI reply copilot for serious X creators. Three features, all directly inside x.com:

🤖 Personalized AI replies
Click the reply icon on any post to generate three context-aware reply drafts that sound like you. Four tunable dials (authenticity, tone, energy, stance) let you teach the AI how you actually write. Set guardrails, pin examples, and watch every reply come back in your style instead of the generic AI register.

📊 Reply targeting with Opportunity Score
Colored pills appear on the action bar of every tweet, scoring it 0–100 for reply-worthiness. The Opportunity Score factors in view velocity, replies-to-views ratio, post freshness, and competition. Stop wasting replies on dead posts. Start finding high-value tweets to reply to the moment they go up.

💡 One-click tweet saving
A lightbulb icon next to the bookmark saves any post (text, metrics, timestamp) to your private library. Pattern extraction analyzes your saved posts and your own analytics to find the hooks, formats, and timing that actually work for your audience.

How it works
1. Install the extension and sign in.
2. Browse X like normal. Three new buttons appear on every post.
3. Click 🤖 to generate replies, 💡 to save tweets, or tap the Opportunity Score pill to jump straight into a reply.
4. Manage your library, voice settings, and analytics from the Agents For X dashboard.

Built for
- Indie founders building in public on X
- Solo creators and consultants growing past 5K followers
- SaaS marketers and dev-rel running their own accounts
- Anyone who replies to grow

Privacy you can verify
- Only storage and activeTab permissions. We never read non-X tabs.
- Host permissions limited to x.com, twitter.com, and app.agentsforx.com.
- We never see your DMs, your other browser tabs, or anything outside X.

Pricing
Free forever for tweet saving and reply targeting. AI replies are 5 per day on free, unlimited on Pro ($19/mo). Cancel anytime, one click from the dashboard.

Support
- Dashboard: https://app.agentsforx.com
- Privacy: https://agentsforx.com/privacy
- Terms: https://agentsforx.com/terms
```

**Keyword density audit:**
- "AI replies" / "AI reply" — 2 occurrences in body (1 in title + 2 in body = 3 total, safe)
- "X" — frequent (platform anchor, no limit applies)
- "Twitter" — 0 occurrences in body (the platform name is "X" throughout). One mention only in the single-purpose statement (§4.3) for legacy search.
- "Reply targeting" — 1 occurrence in body (1 in title + 1 in body = 2 total, safe)
- "Opportunity Score" — 2 occurrences in body, capitalized as a defined feature name. Zero in title or short description.
- "Voice" — 1 occurrence ("voice settings"). Used carefully and contextually.
- "Personalized" — 1 occurrence. Reinforces the short description.
- "High-value tweets to reply to" — 1 occurrence (long-tail search capture).
- "Pattern extraction" — 1 occurrence (adjacent feature mention).
- "Best" / "top" / "#1" — 0 occurrences (rejection-trigger words).

**Em-dash count:** 0 in user-facing copy. All separators are periods, commas, parentheses, or colons.

### 4.2 Category

**Primary:** `Productivity`
**Avoid:** `Social Networking`

Per `CHROME_EXTENSION_COMPETITORS.md` §3.4 — the Social Networking category is dominated by dead Twitter clients and themes with poor conversion. Productivity is where serious creator tools sit.

### 4.3 Single-purpose statement (CWS-required)

```
Agents For X helps creators reply faster on X (Twitter) by adding AI reply drafts, reply targeting, and tweet saving directly to the timeline.
```

**Length:** 142 chars. Matches the three permissions/host requests and the listed features. Uses the same user-language terms as the title and short description so reviewers see consistent positioning across fields. Reviewers cross-check this against actual extension behavior.

This is also the one place "Twitter" appears in the listing copy (the title says "X"). That single mention captures legacy search traffic without diluting the platform anchor in the title.

### 4.4 Permission justifications (CWS-required, per-permission)

#### `storage`
```
We use `chrome.storage.local` to store the user's authentication tokens, saved-inspiration post IDs (so we can show "already saved" indicators), and opportunity-scoring preferences (thresholds, enabled/disabled). No content of posts is stored locally — only IDs. Required for a usable logged-in experience.
```

#### `activeTab`
```
We need access to the active tab only when the user is on x.com or twitter.com, so we can inject the AI-reply, inspiration-save, and opportunity-score buttons into the X interface. We do not request access to any other tab. The extension does nothing on non-X pages.
```

#### Host permissions: `https://x.com/*`, `https://twitter.com/*`
```
The extension's entire functionality is adding UI elements to posts on X. We need to read post text, author, and engagement metrics from the page DOM to generate context-aware replies and calculate opportunity scores. We do not read DMs or any non-public content.
```

#### Host permission: `https://app.agentsforx.com/*`
```
Required to communicate with the Agents For X API for AI reply generation, inspiration storage, and authentication. All requests are user-initiated (clicking 🤖 or 💡) — we do not silently send data.
```

### 4.5 Screenshots (5 slots, 1280×800 PNG)

Order is critical. Slot 1 is the search-result thumbnail. Each slot needs a clear annotation overlay (white text on subtle dark band, large enough to read at thumbnail size).

| Slot | Subject | Annotation overlay | Why this order |
|---|---|---|---|
| **1** | Real X timeline scroll showing 2 or 3 colored "Opp 78 / Opp 84" pills, with the AI reply dropdown open on one post | "AI replies and reply targeting, directly in your timeline" | Slot 1 must showcase the unique differentiator. Reply targeting (Opportunity Score) is the one feature nobody else has. Conversion-driving frame. |
| **2** | Side-by-side: same post replied to in two different style profiles (e.g., "Casual" vs. "Punchy") | "Replies that sound like you, not a bot" | Counter-positions vs. competitors who claim style matching but show no mechanism. |
| **3** | Multiple Opportunity Score pills visible on a scrolled timeline, with high-score posts highlighted by a green border | "Find high-value tweets to reply to at a glance" | Captures the long-tail search "find tweets to reply to" visually. |
| **4** | The lightbulb icon being clicked, then a flyover to the Agents For X library showing saved posts with metrics | "One-click tweet saving and pattern analysis" | Captures the third feature and links to the dashboard story. |
| **5** | Extension popup showing the usage tracker (5 of 5 left), setup checklist, and feature cards | "Free forever for tweet saving and reply targeting. Pro unlocks unlimited AI." | Pre-empts the "is it really free?" objection that tanks competitor ratings. |

**Annotations should NOT include:**
- The price ("$19/mo") — moves to long description; a price on the screenshot reads like an ad
- Star ratings or review counts — Google has explicit policy against fabricated/featured social proof on screenshots
- "Best" / "top-rated" — same policy concern

### 4.6 Promo images

| Image | Size | Content | When |
|---|---|---|---|
| **Small promo tile** | 440×280 PNG | Logo + "AI replies & opportunity scoring for X" tagline on dark background with a single high-contrast Opp pill | Required for any "Featured" eligibility |
| **Marquee promo** | 1400×560 PNG | Wide hero showing X timeline with extension UI overlaid; same tagline | Optional but boosts featured-section eligibility |

Both should reuse the existing brand colors (indigo + orange) from `manifest.json`'s icon set.

### 4.7 Privacy practices declaration

The CWS dashboard asks "Does your extension collect or use user data?" Answer transparently:

| Data type | Collected? | Used for | Sold? |
|---|---|---|---|
| Authentication info | Yes (email, hashed password) | Login | No |
| User content (post text, replies) | Yes — only what the user explicitly generates a reply to or saves as inspiration | Generating AI replies; storing in user's library | No |
| Web history | No | n/a | n/a |
| Personal communications (DMs) | No | n/a | n/a |
| Location | No | n/a | n/a |
| Web activity outside X | No | n/a | n/a |

**Why this matters:** Chrome reviewers manually check that declared data practices match actual extension behavior. Misdeclaration is a fast-track to suspension. The above is accurate to what the code actually does.

---

## 5. What NOT to do — rejection triggers

Per Chrome Web Store policy, the following will get a listing pulled or rejected:

1. **Title keyword stuffing.** Example to avoid: `Agents For X: AI Reply Generator Tweet AI Twitter X Reply Bot Auto Reply`. Our proposed title has each word once. ✓
2. **Repeating the title verbatim in the short description.** Our short description has zero overlap with the title's content words. ✓
3. **"Best" / "top-rated" / "#1" claims** in the title. We avoid all of these. ✓
4. **Functionality not matching the description.** We describe three features (AI replies, opportunity score, inspiration saving) and the extension does exactly those three. ✓
5. **Permission scope mismatch.** Our permissions are narrow; description matches. ✓
6. **Fake social proof in screenshots** (made-up reviews, testimonials, fabricated user counts). All screenshots will use real UI from real X posts (with handles blurred or replaced for privacy). ✓
7. **Auto-reply / mass-action language** that suggests bot-like behavior. Our copy explicitly emphasizes user-initiated, voice-fidelity replies. ✓

---

## 6. Rollout plan

The order of operations matters — you can change manifest fields independently of dashboard fields, and they propagate at different speeds.

### Step 1 (Day 0) — Manifest update + version bump

1. Update `chrome-extension/manifest.json`:
   - `name` → new SEO title
   - `short_name` → "Agents For X" (new field)
   - `description` → new short description
   - `version` → bump
2. Run `npm run build` in `chrome-extension/`.
3. Test the extension locally — confirm `chrome://extensions` shows `short_name`.

### Step 2 (Day 0) — CWS dashboard updates

In the developer dashboard:
1. Replace detailed description with the copy in §4.1.
2. Confirm category is `Productivity`.
3. Replace single-purpose statement (§4.3).
4. Update permission justifications (§4.4).
5. Replace screenshots in the order from §4.5. (Allocate ~2h to design these properly — they are the highest-impact conversion lever.)
6. Upload the new promo images (§4.6).
7. Update privacy practices declaration (§4.7).

### Step 3 (Day 0) — Submit for review

CWS review typically completes in 1–3 days for non-trivial changes. New permissions or scope changes can extend this to 1–2 weeks; we are NOT changing permissions, so expect the fast lane.

### Step 4 (Days 7–14) — Measure

- Use ExtensionRanker (or similar) to track CWS rank for our Tier 1 keywords:
  - "ai reply twitter"
  - "x reply generator"
  - "twitter ai chrome extension"
  - "x growth"
  - "tweet ai"
- Compare install velocity (week before vs. week after).
- Watch the rating — new screenshots can change install→activation conversion, which feeds back into rating quality.

### Step 5 (Day 30) — Iterate

The case studies in our research show 1-week rank movement is normal. After 30 days:
- If rank improved on ≥3 Tier 1 keywords, hold steady and revisit in 90 days.
- If rank stagnated, A/B test the title (only the title — keep everything else constant). Title is the single highest-leverage field.
- If rank dropped (rare with these changes — they're best-practices-aligned), revert to the prior title and investigate.

---

## 7. Summary, exact strings to use

Copy-paste-ready:

| Field | Exact string | Length |
|---|---|---|
| `manifest.json` `name` | `Agents For X: AI Replies and Reply Targeting for X` | 50 / 75 |
| `manifest.json` `short_name` | `Agents For X` | 12 / 12 |
| `manifest.json` `description` | `Reply faster on X with personalized AI drafts, see which posts are worth your reply, and save tweets you love.` | 110 / 132 |
| CWS category | `Productivity` | n/a |
| Single-purpose statement | `Agents For X helps creators reply faster on X (Twitter) by adding AI reply drafts, reply targeting, and tweet saving directly to the timeline.` | 142 / ~150 |
| Detailed description | See §4.1 above | ~1,800 chars |
| Permission justifications | See §4.4 above | per permission |
