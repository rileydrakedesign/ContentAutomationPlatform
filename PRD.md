# Content Automation Platform — Product Requirements Document

> **Last updated:** 2026-03-18
> **Platform:** X (Twitter) only
> **Stack:** Next.js 16 + Supabase + Vercel + Chrome Extension

---

## 1. Vision

A personal content engine for X creators. The platform learns how a user writes, extracts what works from their analytics, and generates on-brand drafts they can publish or schedule — all from a single dashboard.

---

## 2. Target User

Solo creators, consultants, and operators who post on X regularly and want to:
- Understand what content performs and why
- Generate drafts that sound like them, not a generic AI
- Maintain posting consistency without burning out
- Schedule content ahead of time

---

## 3. Core User Journey

```
Sign up → Connect X account → Upload analytics CSV → Configure voice →
Save inspiration → Extract patterns → Generate drafts → Edit & publish/schedule →
Review performance → Refine and repeat
```

### Step-by-step

1. **Sign up / Log in** (`/login`, `/signup`)
   - Email + password or Google OAuth via Supabase Auth.

2. **Dashboard onboarding** (`/`)
   - Setup checklist guides first-time users through: installing the Chrome extension, uploading an X analytics CSV, and connecting their X account.

3. **Connect X account** (`/settings`)
   - OAuth 2.0 PKCE flow. Grants `tweet.read`, `tweet.write`, `users.read`, `offline.access`.
   - Tokens stored in `x_connections` with proactive refresh (5-min expiry buffer).
   - Enables publishing and API-based analytics sync.

4. **Upload analytics CSV** (Dashboard drawer or `/voice`)
   - User exports their analytics CSV from X (requires X Premium).
   - App parses multiple date formats, deduplicates by `post_id`, and stores as JSONB in `user_analytics`.
   - This is the primary data source for insights, pattern extraction, and performance scoring.

5. **Configure voice** (`/voice` → Voice tab)
   - Four sliders: Authenticity, Tone (formal ↔ casual), Energy (calm ↔ punchy), Stance (neutral ↔ opinionated).
   - Guardrails: words to avoid, topics to avoid, custom rules.
   - Voice examples: pin posts that exemplify the user's writing style, ordered by importance.
   - Separate post and reply voice profiles.

6. **Save inspiration** (Chrome extension or `/library`)
   - Chrome extension adds a save button to posts on x.com.
   - Saved posts land in `inspiration_posts` and can be used as style references during draft generation.

7. **Extract patterns** (`/insights` → Patterns tab)
   - Requires ≥ 5 posts from CSV upload.
   - Top 50 posts by engagement are sent to an LLM for pattern extraction.
   - Patterns are categorized: hook styles, formats, timing, topics, engagement triggers.
   - Each pattern gets a confidence score and engagement multiplier.
   - Non-destructive: each extraction creates a new `extraction_batch`.
   - Patterns can be individually enabled/disabled.

8. **Generate drafts** (`/create`)
   - User enters a topic (required), selects a format (single post or thread up to 6 tweets), optionally selects an inspiration post and up to 3 patterns.
   - App generates 3 draft variations using the user's voice settings, selected patterns, and inspiration.
   - User can like/dislike each variation (feedback stored for model improvement).
   - "Select & Edit" opens the draft editor.

9. **Edit & refine** (`/drafts/[id]`)
   - Full editor with character count for posts, multi-tweet editor for threads.
   - Status lifecycle: `DRAFT` → `SCHEDULED` → `POSTED`.

10. **Publish or schedule** (`/drafts/[id]` or `/queue`)
    - **Post now:** Immediately publishes to X via API v2.
    - **Schedule:** Stores in `scheduled_posts` with a target timestamp. A Vercel cron job (`/api/cron/publish-scheduled`) runs every minute and publishes due posts.
    - Queue page shows all scheduled/published/failed posts with retry and cancel actions.

11. **Review performance** (`/insights`)
    - **Overview:** Growth trend chart (rolling average), best day indicator, engagement funnel (impressions → detail expands → likes → replies → reposts → follows), post length sweet spot, sortable performance tables for posts and replies.
    - **Patterns:** View and manage extracted patterns with confidence and multiplier scores.
    - **Actions:** AI-generated suggestions — boost opportunities, content focus areas, timing recommendations.
    - **Assistant:** Chat interface to ask questions about analytics.

12. **Iterate**
    - Upload fresh CSVs, re-extract patterns, adjust voice settings, and generate new drafts informed by what worked.

---

## 4. Feature Inventory

### 4.1 Dashboard (`/`)

| Feature | Description |
|---|---|
| Setup checklist | Tracks onboarding progress: extension install, CSV upload, X connection |
| Quick actions | Primary CTAs: "Create Draft" and "Upload CSV" |
| Boost opportunities | Surfaces top posts from the last 7 days worth amplifying |
| Insights hub | Compact analytics: avg impressions, best day, engagement rate, reply performance |
| Consistency tracker | GitHub-style heatmap of posting/reply activity over 12+ weeks |
| Content sidebar | Tabbed panel showing drafts, top posts, and saved inspiration |

### 4.2 Insights (`/insights`)

| Feature | Description |
|---|---|
| Growth trend chart | Rolling 7/14-day average of impressions and engagement over time |
| Best day indicator | Which day of the week performs best |
| Engagement funnel | Stage-by-stage conversion from impressions to follows |
| Post length sweet spot | Optimal character count analysis |
| Performance tables | Sortable post/reply tables with full metrics |
| Pattern management | View, enable/disable, and re-extract content patterns |
| AI suggestions | Actionable recommendations: topics, timing, patterns to apply |
| Insights assistant | Chat interface for ad-hoc analytics questions |

### 4.3 Create (`/create`)

| Feature | Description |
|---|---|
| Topic input | Free-text prompt describing what to write about |
| Format selection | Single post or thread (up to 6 tweets) |
| Inspiration picker | Select a saved post as a style reference |
| Pattern selector | Apply up to 3 patterns from extracted set |
| Draft generation | Produces 3 variations per request |
| Generation feedback | Like/dislike buttons on each variation |
| All drafts view | Filterable list of all drafts with status |

### 4.4 Draft Editor (`/drafts/[id]`)

| Feature | Description |
|---|---|
| Post editor | Text area with character counter (280 char awareness) |
| Thread editor | Multi-tweet editor with add/remove, max 6 tweets |
| Post now | Immediate publish to X via API v2 |
| Schedule | Pick a future datetime; cron publishes when due |
| Status tracking | Visual status badges: draft, scheduled, posted, failed |

### 4.5 Queue (`/queue`)

| Feature | Description |
|---|---|
| Scheduled posts list | All upcoming, in-progress, completed, and failed posts |
| Retry | Re-attempt failed publishes |
| Cancel | Cancel a scheduled post before it fires |
| Status badges | scheduled, publishing, posted, failed, cancelled |

### 4.6 Voice (`/voice`)

| Feature | Description |
|---|---|
| Voice sliders | 4 dials: authenticity, tone, energy, stance (0–100) |
| Guardrails | Words to avoid, topics to avoid, custom rules |
| Voice examples | Pin posts that exemplify the user's style, reorderable |
| Dual voices | Separate configurations for posts and replies |
| Pattern management | Enable/disable patterns, view confidence and multiplier |

### 4.7 Library (`/library`)

| Feature | Description |
|---|---|
| Inspiration posts | All saved external posts for style reference |
| Own posts | User's analytics posts viewable with metrics |
| Use as inspiration | One-click to inject into draft generation |

### 4.8 Settings (`/settings`)

| Feature | Description |
|---|---|
| X account connection | OAuth 2.0 PKCE connect/disconnect |
| Post sync | Pull user's posts from X API |
| Analytics sync | Pull analytics data from X API |
| Connection status | Shows username, avatar, last sync timestamps |

### 4.9 Chrome Extension

| Feature | Description |
|---|---|
| Save inspiration | One-click save of any post on x.com to inspiration library |
| Opportunity scoring | Visual pill indicators on posts with high engagement potential |
| Reply generation | In-page AI reply suggestions using user's voice settings |
| Consistency tracking | Logs replies sent from extension for activity heatmap |
| Post capture | Saves posts with metrics to `captured_posts` |

---

## 5. Data Model (Key Tables)

| Table | Purpose |
|---|---|
| `user_analytics` | CSV-uploaded analytics data (JSONB array of posts) |
| `captured_posts` | Posts captured via Chrome extension with metrics |
| `inspiration_posts` | Saved external posts for style reference |
| `extracted_patterns` | AI-extracted content patterns with confidence scores |
| `drafts` | Generated/edited content with status lifecycle |
| `scheduled_posts` | Publishing queue with cron-based execution |
| `x_connections` | OAuth 2.0 tokens and X account info |
| `user_voice_settings` | Voice configuration (dials, guardrails, model) |
| `user_voice_examples` | Pinned posts exemplifying user's voice |
| `extension_replies` | Replies sent via Chrome extension |
| `voice_editor_chat_history` | Multi-turn voice builder conversation |
| `waitlist_signups` | Landing page waitlist emails |

All tables use Supabase Row-Level Security — users can only access their own data.

---

## 6. Engagement Scoring

Canonical function: `weightedEngagement()` in `@/lib/utils/engagement.ts`

```
score = (replies × 5) + (retweets/reposts × 4) + (likes × 3) + (bookmarks × 3) + (impressions × 0.001)
```

Used everywhere: pattern extraction ranking, boost opportunities, performance tables, voice example selection.

---

## 7. Automated Jobs (Vercel Cron)

| Job | Schedule | Purpose |
|---|---|---|
| `publish-scheduled` | Every minute | Publish posts whose `scheduled_for` has passed |
| `metrics-refresh` | Daily 3am UTC | Update engagement metrics on existing posts |
| `voice-refresh` | Daily 4am UTC | Auto-refresh voice examples from latest data |
| `analytics-sync` | Weekly Mon 3am UTC | Sync analytics from X API |

---

## 8. Authentication & Authorization

- **App auth:** Supabase Auth (email/password + Google OAuth)
- **X auth:** OAuth 2.0 PKCE with scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
- **Token management:** Proactive refresh with 5-minute expiry buffer
- **Extension auth:** Bearer token (JWT) or cookie-based session

---

## 9. Non-Goals / Out of Scope

- **Instagram / Reels / other platforms** — legacy dead code exists but the app is X-only
- **Voice memo pipeline** — deprecated, not maintained
- **Multi-user / team features** — single-user only
- **Direct message automation** — not supported
- **Follower growth hacks / mass engagement** — the tool is about quality content, not spam

---

## 10. Landing Page & Waitlist

Separate Next.js app at `/landing`. Features:
- Marketing hero with animated elements
- Live waitlist counter
- Email signup → `waitlist_signups` table
- Privacy policy and terms of service pages
