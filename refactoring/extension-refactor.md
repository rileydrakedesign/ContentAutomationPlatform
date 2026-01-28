
## Purpose
Add an "arbitrage opportunity" layer to the existing X reply engine Chrome extension by:
- Reading the **Views** number (and other visible engagement counts) from the DOM
- Scoring posts locally (no API, no LLM)
- Highlighting high-opportunity posts in-feed
- Keeping the existing **human in the loop** flow for generating and posting replies

This addition must be lightweight, explainable, and avoid UI spam.

---

## Core UX

### In-feed highlighting
For each visible post card:
- Add a small pill near the action row: `Opp 82`
- Add a subtle left border color:
  - Green: strong opportunity
  - Yellow: medium
  - No styling if below threshold

### Interaction
- Clicking the pill opens the extension reply panel for that post (existing behavior)
- The panel shows:
  - Post context
  - `Generate 3 replies` (single LLM call)
  - Insert buttons for each reply option

### Optional (no LLM) explanation
Instead of an LLM-based "why", show deterministic reasons derived from score components:
- "High views per hour"
- "Low replies vs views"
- "Fresh post"

This is optional and should be a toggle in extension settings.

---

## Data inputs (DOM only)

### Required fields per post
- tweet_id
- post age (minutes since posted)
- views
- replies
- likes
- reposts
- quotes (if shown)

### DOM strategy (robustness)
X DOM changes frequently. Use multiple strategies and fallbacks:

1) Identify tweet containers:
- Primary: `article[data-testid="tweet"]`
- Fallback: `div[data-testid="cellInnerDiv"] article`

2) Extract tweet_id:
- Prefer parsing from the tweet URL in anchor tags:
  - Find a link containing `/status/`
  - Parse numeric id after `/status/`

3) Extract timestamp / age:
- Find `time` element inside the tweet
- Use its `dateTime` attribute when available
- If only relative time exists, parse and convert to minutes

4) Extract counts (views, replies, likes, reposts, quotes):
- Prefer aria-label text on the action buttons
- Fallback: visible numeric text near icons
- Handle locale and abbreviations (K, M)

### Number parsing
Implement a single `parseCount(text)` utility:
- Accepts: `1`, `12`, `1.2K`, `3K`, `4.7M`
- Removes commas
- Converts to integer
- Returns null if not present

Important:
- Views can be hidden for some users or contexts.
- If views are missing, either:
  - Skip scoring that tweet, or
  - Use a proxy score based on other counts (configurable).

MVP recommendation: skip highlight if views are missing, but still allow manual reply generation via existing UI.

---

## Opportunity scoring (local, no LLM)

### Goals
- Prioritize posts with:
  - High attention now (views velocity)
  - Low reply competition (views per reply)
  - Still early (freshness window)

### Derived metrics
Let:
- `age_hours = max(0.1, age_minutes / 60)`
- `velocity = views / age_hours`
- `competition = replies + 1`
- `vpr = views / competition`
- `eng = likes + (2 * reposts) + (2 * quotes)`

### Score formula (MVP default)
Use log scaling to prevent outliers dominating:
- `score_raw = 0.50 * log1p(velocity)`
- `+ 0.35 * log1p(vpr)`
- `+ 0.15 * log1p( (eng + 1) / competition )`

Freshness multiplier:
- If age_minutes < 10: multiplier = 0.8 (too early, little signal)
- 10 to 360 minutes (6h): multiplier = 1.0
- 360 to 720 minutes (12h): multiplier = 0.7
- > 720 minutes: multiplier = 0.4

Final:
- `score = score_raw * multiplier`

Normalize to 0 to 100 for UI:
- Maintain rolling min/max across current session (or percentile)
- Map to integer 0 to 100

### Thresholds
Config defaults:
- Green if score >= 75
- Yellow if score >= 60
- Hide if score < 60

Also add hard filters:
- Exclude if replies are extremely high (thread saturation):
  - Example: `replies > 200` (configurable)
- Exclude if post is older than N hours:
  - Example: `age_hours > 24` (configurable)

---

## Performance constraints

### Do not scan the entire DOM repeatedly
- Use a `MutationObserver` to detect new tweet nodes
- Use an `IntersectionObserver` to score only tweets currently in viewport
- Throttle scoring updates (ex: every 500ms max)

### Cache results
- Cache tweet metrics + score by tweet_id in memory
- Optional: persist last N scored tweet_ids in chrome storage for session continuity

### UI injection safety
- Inject minimal DOM elements
- Avoid breaking native click handlers
- Use unique classnames and data attributes:
  - `data-xgo-opp-pill`
  - `.xgo-opp-border`

---

## LLM call policy (unchanged, but enforce)
- Only call the LLM when the user clicks `Generate 3 replies`
- One call returns 3 outputs in strict JSON

### Reply generation JSON schema
```json
{
  "variant": "reply_pack_v1",
  "tweet_id": "string",
  "replies": [
    { "type": "value_add", "text": "string" },
    { "type": "nuance", "text": "string" },
    { "type": "short", "text": "string" }
  ]
}
