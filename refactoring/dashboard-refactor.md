
## Purpose
Refactor the web dashboard so it is primarily a **visibility and control center** for:
- The user’s voice profile (top performing content + pinned examples)
- A small set of output knobs that change reply and post suggestions
- Weekly (or manual) refresh that updates the “top examples” used in prompts

Daily reply suggestions remain extension-driven.

---

## Core principles
- Dashboard is not a posting tool. It is a tuning tool.
- No manual metric entry. Use API only.
- Minimize API usage and fields to control fees.
- Top examples are updated weekly or on manual refresh.
- Everything the model uses should be visible to the user.

---

## Information architecture
Three primary pages:

1) Voice Profile
2) Controls
3) Inspiration

Plus one page for Prompt Preview and Debug (can be nested under Controls).

---

## 1) Voice Profile page

### A) Auto-selected top examples (weekly refresh)
Show two lists (5 to 10 each):
- Top Posts
- Top Replies

Each item card:
- Text preview
- Date
- Key metric used for ranking (impressions or engagement score)
- Buttons:
  - Pin
  - Exclude

Rules:
- Excluded items never appear in prompts
- Pinned items always appear in prompts (within token budget)

### B) Pinned examples
User-controlled set (small, usually 3 to 10):
- Displays full text
- Drag reorder (priority)
- Notes field (optional): “Why this is my voice”

### C) Excluded examples
A simple list with Undo.

---

## 2) Controls page

These controls should map directly to prompt parameters and remain intentionally limited.

### Recommended knobs (MVP)
- Length: Short / Medium
- Directness: Soft / Neutral / Blunt
- Humor: Off / Light
- Emoji: Off / On
- Question rate: Low / Medium
- Disagreement: Avoid / Allow nuance

### Scope
These knobs affect:
- Reply generation in extension
- Post suggestions (if you have them)

The UI should show:
- Current saved settings
- A live example preview (optional) that runs on demand (one LLM call, not continuous)

---

## 3) Prompt Preview page

Show exactly what will be sent to the model at generation time, assembled from:
- System prompt template
- User controls (as structured params)
- Voice examples:
  - Pinned examples (top N)
  - Auto top examples (top N)
- Optional inspiration examples (top N)

Must include:
- Token budget indicator
- Which examples were included or omitted due to budget

This page builds trust and reduces need for per-reply “why explanations”.

---

## 4) Inspiration page (weekly refresh)

### A) User keywords / niches
Users configure 1 to 5 keywords or niche topics.

### B) Weekly inspiration pulls
For each keyword:
- Pull a small set of top posts (example: 5 to 10)
- Rank locally by public engagement counts returned by API
- Show a simple feed of inspiration

Actions:
- Pin to Inspiration Set
- Exclude keyword results
- Add note: “use this structure, not the exact wording”

### C) Inspiration Set
Pinned inspiration used as optional style reference in prompts.

Keep this small.

---

## API usage strategy (minimal calls)

### Refresh cadence
- Weekly automatic refresh (server job)
- Manual refresh button on Voice Profile (user-triggered)

### Data you need for weekly refresh
- Recent user tweets (posts and replies)
- Analytics for those tweet IDs
- Top N ranking

### High-level approach
1) Get recent tweets for the user within a window (ex: last 30 days or last 200 tweets)
2) Use a batch analytics endpoint to fetch metrics for those tweet IDs
3) Rank and store top 5 to 10 posts and top 5 to 10 replies
4) Cache results and expose to dashboard and prompt assembly

Notes:
- Endpoint names and availability vary by plan. Implement behind a provider interface and confirm in your plan console.

### Keep fields minimal
Request only what you display or rank on:
- tweet_id
- text
- created_at
- impression_count (if available)
- like_count, reply_count, repost_count, quote_count

Avoid pulling user objects, media expansions, and large expansions unless required.

---

## Data model (suggested)

### Tables / collections

#### user_voice_settings
- user_id
- length_mode
- directness_mode
- humor_mode
- emoji_mode
- question_rate
- disagreement_mode
- updated_at

#### user_voice_examples
- user_id
- tweet_id
- type: post | reply
- text
- created_at
- source: auto | pinned
- is_excluded: boolean
- pinned_rank: integer nullable
- metrics_snapshot:
  - impression_count nullable
  - like_count
  - reply_count
  - repost_count
  - quote_count
- refreshed_at

#### user_inspiration
- user_id
- keyword
- tweet_id
- text
- author_handle
- created_at
- public_metrics snapshot
- is_pinned: boolean
- is_excluded: boolean
- refreshed_at

---

## Prompt assembly logic (shared by dashboard and extension)

### Inputs
- User controls (structured)
- Pinned examples (ordered)
- Auto top examples
- Optional inspiration set

### Selection rules
- Always include pinned examples first (until budget)
- Then include auto top replies (voice is strongest in replies)
- Then include auto top posts
- Then include inspiration set (optional, low priority)

### Example formatting (token-efficient)
Store and send:
- For each example:
  - One-line header: type, date
  - Text body

Avoid long metadata.

---

## UX behavior details

### Manual refresh button
- Shows last refresh time
- Runs refresh job and updates lists
- Shows “Top examples updated” toast

### Edit visibility
Users should always be able to:
- Pin
- Exclude
- Reorder pins
- See what the model will use (Prompt Preview)

---

## Acceptance criteria
- Dashboard is usable without ever opening analytics charts
- User can understand and modify what “voice” means in the product in under 2 minutes
- Weekly refresh updates top examples with 1 click, without large API usage
- Prompt Preview shows exactly what will be sent and what was omitted
- Extension reply generation reads the same controls and uses the same example selection rules

---

## Out of scope (MVP)
- Full analytics suite
- Daily automated pulling of large datasets
- Multi-account support
- Auto-posting
- Continuous A/B testing of prompt settings

---

## Implementation checklist
- [ ] Build Voice Profile UI: auto top, pinned, excluded
- [ ] Build Controls UI and persistence
- [ ] Build Prompt Preview assembler and token budgeting
- [ ] Implement weekly refresh job and manual refresh endpoint
- [ ] Implement inspiration weekly pull by keyword
- [ ] Cache and serve minimal fields
- [ ] Integrate extension to fetch settings and example packs

---

## Test plan
- Weekly refresh with:
  - High activity account
  - Low activity account
- Ensure ranking and reply detection works
- Ensure pinned and excluded behaviors persist across refreshes
- Ensure prompt assembly respects token budget
- Confirm API usage stays within expected request counts per refresh
