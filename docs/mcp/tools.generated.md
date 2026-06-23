<!-- GENERATED FILE — do not edit by hand.
     Regenerate with `npm run gen-docs` in the mcp/ package.
     Source of truth: mcp/src/tools.ts (Zod schemas + descriptions). -->

# MCP Tool Reference

The Agents For X MCP server exposes **36 tools**. Both transports — the stdio package (`@agentsforx/mcp`) and the hosted OAuth gateway (`/api/v1/mcp`) — register this identical set via the shared `registerTools()`. Each tool maps to one v1 REST endpoint; credit costs and auth scopes are enforced server-side and are identical across transports.

For narrative usage (write-yourself vs. generate, the check_draft loop, freshness), see [tools.md](./tools.md). For the REST contract, see the [OpenAPI spec](../../src/lib/api/openapi-spec.ts) / the interactive reference at `/developers`.

## Tools

### `add_inspiration`

**Save an inspiration post**

Save a post the user wants to learn from. It is auto-analyzed (voice + format) in the background and then influences generation. Costs 3 credits.

- **REST endpoint:** `POST /api/v1/inspiration`
- **Cost:** Costs 3 credits.

| Input | Constraints | Description |
|---|---|---|
| `content` | string, required, min 1 | The post text. |
| `url` | string, optional | Source URL (deduplicated). |
| `authorHandle` | string, optional |  |

### `cancel_scheduled`

**Cancel a scheduled post**

Cancel a scheduled post by ID (only while still pending). The credits debited at schedule time are refunded.

- **REST endpoint:** `DELETE /api/v1/queue/:id`
- **Cost:** The credits debited at schedule time are refunded.

| Input | Constraints | Description |
|---|---|---|
| `id` | string, required, min 1 |  |

### `check_draft`

**Voice-check a draft (the tuner)**

Score a draft post or reply against the user's tuned voice — their assembled voice prompt, niche positioning, and proven patterns. Returns a 0-100 score, what the draft gets right, where it deviates, and a suggested edit. Use before create_draft or publishing to make sure the content sounds like the user and matches what performs for them. Costs 3 credits.

- **REST endpoint:** `POST /api/v1/voice/check`
- **Cost:** Costs 3 credits.

| Input | Constraints | Description |
|---|---|---|
| `text` | string, required, min 5 | The draft text to check. |
| `voiceType` | enum, optional, default "post", one of `post`, `reply` | Which voice to judge against: 'post' or 'reply'. |

### `create_draft`

**Create draft**

Save a draft for later. For a single post use content { text }. For a thread use content { tweets: [...] }. Free.

- **REST endpoint:** `POST /api/v1/drafts`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `type` | enum, optional, default "X_POST", one of `X_POST`, `X_THREAD` |  |
| `content` | object (one of several shapes), required |  |
| `topic` | string, optional |  |
| `metadata` | object (map), optional |  |

### `delete_draft`

**Delete draft**

Delete a draft by ID. Free.

- **REST endpoint:** `DELETE /api/v1/drafts/:id`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `id` | string, required, min 1 |  |

### `find_reply_posts`

**Find posts to reply to**

Search recent tweets and return ONLY posts the user's account is allowed to reply to (reply_allowed === true) — use this instead of search_tweets when the goal is to find posts to reply to. Same X search syntax as search_tweets. Requires a Pro plan. Credits: X bills per post it returns, so this costs 1 credit per post RETURNED BY X (minimum 5), not per repliable post handed back — restricted posts still count toward cost. Keep maxResults low. Set sort='traction' ONLY when the user asks to prioritize high-momentum posts; it ranks the repliable results by engagement decayed by post age (fresh + rising above old + saturated). Default 'relevance' keeps X's order. Response includes returned_count (what X returned) and repliable_count (what you can reply to). reply_allowed is best-effort — a reply can still 403, so publish_reply must handle that gracefully.

- **REST endpoint:** `GET /api/v1/search/reply-targets`
- **Cost:** Credits: X bills per post it returns, so this costs 1 credit per post RETURNED BY X (minimum 5), not per repliable post handed back — restricted posts still count toward cost.

| Input | Constraints | Description |
|---|---|---|
| `query` | string, required, min 1 | X search query. |
| `maxResults` | integer, optional, default 10, min 10, max 25 |  |
| `sort` | enum, optional, default "relevance", one of `relevance`, `traction` | 'relevance' keeps X's order; 'traction' ranks repliable posts by momentum. Only use 'traction' when the user asks to prioritize high-engagement posts. |

### `generate_post`

**Generate post drafts (server-side)**

Server-side generation: the platform's configured AI model writes post or thread options in the user's POST voice. Prefer get_writing_context and writing the content yourself — it is free and usually better. Use this only when you cannot write the content directly. Returns options; does NOT save or publish. Costs 3 credits.

- **REST endpoint:** `POST /api/v1/drafts/generate`
- **Cost:** Prefer get_writing_context and writing the content yourself — it is free and usually better. Costs 3 credits.

| Input | Constraints | Description |
|---|---|---|
| `topic` | string, required, min 3 | What the post should be about. |
| `draftType` | enum, optional, default "X_POST", one of `X_POST`, `X_THREAD` | Single post or a multi-tweet thread. |
| `generateCount` | integer, optional, default 3, min 1, max 5 | How many options to generate (1-5). |
| `patternIds` | string[], optional | Specific extracted_pattern IDs to apply (defaults to the user's top enabled patterns). |
| `inspiration` | object, optional | An inspiration post to adapt the style from (not copy). |

### `generate_reply`

**Generate reply drafts (server-side)**

Server-side generation: the platform's configured AI model writes reply options in the user's REPLY voice. Prefer get_writing_context (voiceType: 'reply') and writing the reply yourself — free and usually better. Pass the target tweet's text (use get_tweet first if you only have a URL/ID). Returns options — does NOT publish. Costs 3 credits.

- **REST endpoint:** `POST /api/v1/drafts/generate`
- **Cost:** Prefer get_writing_context (voiceType: 'reply') and writing the reply yourself — free and usually better. Costs 3 credits.

| Input | Constraints | Description |
|---|---|---|
| `replyToText` | string, required, min 1 | The full text of the tweet being replied to. |
| `replyToTweetId` | string, optional | The ID of the tweet being replied to (carried into draft metadata). |
| `replyToAuthor` | string, optional | The @handle of the tweet's author (without the @). |
| `angle` | string, optional | Optional angle or point you want the reply to make. |
| `generateCount` | integer, optional, default 3, min 1, max 5 |  |

### `get_analytics`

**Get analytics**

Read the user's post analytics. include='summary' for totals, 'posts' to include recent captured posts, 'all' to also include uploaded CSV post rows. Costs 1 credit.

- **REST endpoint:** `GET /api/v1/analytics`
- **Cost:** Costs 1 credit.

| Input | Constraints | Description |
|---|---|---|
| `include` | enum, optional, default "summary", one of `summary`, `posts`, `all` |  |

### `get_best_times`

**Get best posting days**

Day-of-week engagement breakdown from the user's analytics — which days their posts perform best. Costs 1 credit.

- **REST endpoint:** `GET /api/v1/analytics/best-times`
- **Cost:** Costs 1 credit.

_No inputs._

### `get_credits`

**Get credit balance**

Return the user's plan and credit balances: total spendable, monthly allowance remaining (resets monthly), purchased pack balance (never expires while subscribed), and the reset date. Free.

- **REST endpoint:** `GET /api/v1/me`
- **Cost:** Return the user's plan and credit balances: total spendable, monthly allowance remaining (resets monthly), purchased pack balance (never expires while subscribed), and the reset date. Free.

_No inputs._

### `get_draft`

**Get draft**

Fetch a single draft by ID. Free.

- **REST endpoint:** `GET /api/v1/drafts/:id`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `id` | string, required, min 1 | Draft ID. |

### `get_niche`

**Get niche profile**

Read the user's analyzed niche profile: summary, content pillars, topic clusters, and positioning (target audience, unique angle, positioning statement). Returns null if not yet analyzed. Free.

- **REST endpoint:** `GET /api/v1/niche`
- **Cost:** Free.

_No inputs._

### `get_strategy`

**Get content strategy**

Read the user's weekly content strategy (posts/threads/replies per week and pillar targets). Free.

- **REST endpoint:** `GET /api/v1/strategy`
- **Cost:** Free.

_No inputs._

### `get_tweet`

**Get a tweet**

Fetch a tweet's text and metrics by ID or full x.com URL. Use this to pull the post you want to reply to, then pass its text to generate_reply. Costs 1 credit.

- **REST endpoint:** `GET /api/v1/tweets/:idOrUrl`
- **Cost:** Costs 1 credit.

| Input | Constraints | Description |
|---|---|---|
| `idOrUrl` | string, required, min 1 | Tweet ID or full x.com/twitter.com status URL. |

### `get_voice_settings`

**Get voice settings**

Read the user's voice configuration (tone/energy/stance dials, guardrails, AI model) and their voice examples for the given voice type. Use to understand how generation will sound before generating. Free.

- **REST endpoint:** `GET /api/v1/voice`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `voiceType` | enum, optional, default "post", one of `post`, `reply` | Which voice to read: 'post' or 'reply'. |

### `get_writing_context`

**Get writing context (write it yourself)**

PREFERRED way to create content: fetch the user's full writing context — their assembled voice system prompt (tone dials, guardrails, real examples of their writing, inspiration) plus their highest-performing proven patterns and the platform rules — then WRITE THE POST OR REPLY YOURSELF following it. You are a more capable writer than the server-side generator. Free. After writing, show the user, then create_draft / publish / schedule.

- **REST endpoint:** `GET /api/v1/voice/context`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `voiceType` | enum, optional, default "post", one of `post`, `reply` | 'post' for original posts/threads, 'reply' for replies. |

### `health`

**Health check**

Ping the API. Confirms connectivity and (if the key is valid) returns key metadata. Free.

- **REST endpoint:** `GET /api/v1/health`
- **Cost:** Free.

_No inputs._

### `list_drafts`

**List drafts**

List saved drafts. Filter by status. Free.

- **REST endpoint:** `GET /api/v1/drafts`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `status` | enum, optional, default "DRAFT", one of `DRAFT`, `SCHEDULED`, `POSTED`, `REJECTED` |  |
| `limit` | integer, optional, default 50, min 1, max 100 |  |
| `offset` | integer, optional, default 0, min 0 |  |

### `list_inspiration`

**List inspiration posts**

List the user's saved inspiration posts with their voice/format analysis. Free.

- **REST endpoint:** `GET /api/v1/inspiration`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `limit` | integer, optional, default 100, min 1, max 500 |  |

### `list_patterns`

**List proven patterns**

List patterns extracted from the user's top posts (hooks, formats, topics, engagement triggers) with engagement multipliers. Pass their IDs to generate_post to steer generation. Free.

- **REST endpoint:** `GET /api/v1/patterns`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `enabledOnly` | boolean, optional, default false |  |
| `type` | string, optional | Filter by pattern_type. |
| `limit` | integer, optional, default 200, min 1, max 500 |  |

### `list_published`

**List published & scheduled history**

List the user's scheduled-post history across all states (posted, failed, cancelled, pending). Free.

- **REST endpoint:** `GET /api/v1/publish`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `status` | enum, optional, one of `scheduled`, `publishing`, `posted`, `failed`, `cancelled` |  |
| `limit` | integer, optional, default 50, min 1, max 100 |  |
| `offset` | integer, optional, default 0, min 0 |  |

### `list_queue`

**List scheduled posts**

List queued/scheduled posts. Filter by status. Free.

- **REST endpoint:** `GET /api/v1/queue`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `status` | enum, optional, one of `scheduled`, `publishing`, `posted`, `failed`, `cancelled` |  |
| `limit` | integer, optional, default 50, min 1, max 100 |  |
| `offset` | integer, optional, default 0, min 0 |  |

### `publish_post`

**Publish a post now**

Publish a single post to X immediately. This is irreversible and public — confirm the exact text with the user before calling. Optionally pass draftId to mark a draft as POSTED. Costs 3 credits — 30 if the text contains a URL (X bills link posts at ~13x).

- **REST endpoint:** `POST /api/v1/publish/now`
- **Cost:** Costs 3 credits — 30 if the text contains a URL (X bills link posts at ~13x).

| Input | Constraints | Description |
|---|---|---|
| `text` | string, required, min 1, max 280 |  |
| `draftId` | string, optional |  |

### `publish_reply`

**Publish a reply now**

Publish a reply to a specific tweet immediately. Irreversible and public — confirm with the user first. inReplyToId is the ID of the tweet you are replying to. Costs 3 credits — 30 if the text contains a URL.

- **REST endpoint:** `POST /api/v1/publish/now`
- **Cost:** Costs 3 credits — 30 if the text contains a URL.

| Input | Constraints | Description |
|---|---|---|
| `text` | string, required, min 1, max 280 |  |
| `inReplyToId` | string, required, min 1 | ID of the tweet being replied to. |
| `draftId` | string, optional |  |

### `publish_thread`

**Publish a thread now**

Publish a thread (each item becomes one connected tweet) to X immediately. Irreversible and public — confirm with the user first. Costs 3 credits per tweet — 30 for any tweet containing a URL. On partial failure, un-posted tweets are refunded; do NOT retry the full thread, resume with the remaining tweets only.

- **REST endpoint:** `POST /api/v1/publish/now`
- **Cost:** Costs 3 credits per tweet — 30 for any tweet containing a URL.

| Input | Constraints | Description |
|---|---|---|
| `tweets` | string[], required |  |
| `draftId` | string, optional |  |

### `run_tuneup`

**Run a Voice Tune-Up**

Run the full analyze half of the loop: refresh voice examples → extract proven patterns → analyze niche & positioning, all over the user's complete post history, then return the Voice Report (niche, positioning, top patterns, top posts, cadence vs strategy, recurring voice-check deviations with settings suggestions, feedback themes, inspiration alignment, freshness). Use when whoami or get_writing_context reports retune_recommended, or when the user asks to re-analyze. Costs 5 credits (multiple model calls).

- **REST endpoint:** `POST /api/v1/insights/tuneup`
- **Cost:** Costs 5 credits (multiple model calls).

_No inputs._

### `schedule_post`

**Schedule a post or thread**

Schedule a post (pass text) or thread (pass tweets) for a future time. scheduledFor must be an ISO 8601 timestamp in the future. Requires a Pro plan. Credits are debited at schedule time (3 per tweet, 30 per URL tweet) and refunded if cancelled.

- **REST endpoint:** `POST /api/v1/publish/schedule`
- **Cost:** Credits are debited at schedule time (3 per tweet, 30 per URL tweet) and refunded if cancelled.

| Input | Constraints | Description |
|---|---|---|
| `text` | string, optional, min 1, max 280 | For a single post. |
| `tweets` | string[], optional | For a thread (2+ tweets). |
| `scheduledFor` | string, required, min 1 | ISO 8601 timestamp in the future, e.g. 2026-06-10T15:00:00Z. |
| `draftId` | string, optional |  |

### `search_tweets`

**Search recent tweets**

Search public tweets from the last 7 days (X search syntax, e.g. 'from:user', '"exact phrase"', 'topic -is:retweet'). Requires a Pro plan. Costs 1 credit per result returned (minimum 5) — keep maxResults low. Each result carries reply-eligibility fields so you can filter to repliable posts with no extra API calls: reply_allowed (boolean), reply_eligibility (open | open_mentioned | restricted | unknown), is_auth_mentioned (boolean), and the raw reply_settings from X. reply_allowed=true is best-effort, NOT a guarantee — a reply can still fail with HTTP 403 ('Reply to this conversation is not allowed') if the author blocked us or spam heuristics trip, so publish_reply must still handle that gracefully. Prefer reply_allowed but consult raw reply_settings for edge cases.

- **REST endpoint:** `GET /api/v1/search`
- **Cost:** Costs 1 credit per result returned (minimum 5) — keep maxResults low.

| Input | Constraints | Description |
|---|---|---|
| `query` | string, required, min 1 | X search query. |
| `maxResults` | integer, optional, default 10, min 10, max 25 |  |

### `send_feedback`

**Send generation feedback**

Log like/dislike feedback on a generated post or reply. Feeds the user's prompt assembly so future generations improve. Use after the user reacts to an option. Free.

- **REST endpoint:** `POST /api/v1/feedback`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `feedbackType` | enum, required, one of `like`, `dislike` |  |
| `generationType` | enum, required, one of `post`, `reply` |  |
| `contentText` | string, required, min 1 | The generated text being rated. |
| `contextPrompt` | string, optional | The topic/angle that produced it. |

### `sync_analytics`

**Sync timeline from X**

Pull the user's latest posts from X into their analytics (delta sync — only new posts are fetched). Use when captured posts look stale. Requires a Pro plan. Costs 15 credits.

- **REST endpoint:** `POST /api/v1/analytics/sync`
- **Cost:** Costs 15 credits.

_No inputs._

### `toggle_pattern`

**Enable/disable a pattern**

Enable or disable an extracted pattern (disabled patterns are not applied during generation). Free.

- **REST endpoint:** `PATCH /api/v1/patterns/:id`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `id` | string, required, min 1 |  |
| `isEnabled` | boolean, required |  |

### `update_draft`

**Update draft**

Update a draft's content, status, or metadata. Free.

- **REST endpoint:** `PATCH /api/v1/drafts/:id`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `id` | string, required, min 1 |  |
| `content` | object (one of several shapes), optional |  |
| `status` | enum, optional, one of `DRAFT`, `SCHEDULED`, `POSTED`, `REJECTED` |  |
| `metadata` | object (map), optional |  |

### `update_strategy`

**Update content strategy**

Set the user's weekly content strategy. This replaces the stored strategy — pass every field you want kept. Free.

- **REST endpoint:** `PUT /api/v1/strategy`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `posts_per_week` | integer, required, min 0 |  |
| `threads_per_week` | integer, required, min 0 |  |
| `replies_per_week` | integer, required, min 0 |  |
| `pillar_targets` | object[], optional, default [] | Per-pillar weekly post targets. |

### `update_voice_settings`

**Update voice settings**

Update the user's voice configuration for a voice type. Only the fields you pass are changed. Confirm material voice changes with the user first. Free.

- **REST endpoint:** `PATCH /api/v1/voice`
- **Cost:** Free.

| Input | Constraints | Description |
|---|---|---|
| `voiceType` | enum, optional, default "post", one of `post`, `reply` |  |
| `optimization_authenticity` | integer, optional, min 0, max 100 | 0 = fully authentic, 100 = fully optimized for engagement. |
| `tone_formal_casual` | integer, optional, min 0, max 100 | 0 = formal, 100 = casual. |
| `energy_calm_punchy` | integer, optional, min 0, max 100 | 0 = calm, 100 = punchy. |
| `stance_neutral_opinionated` | integer, optional, min 0, max 100 | 0 = neutral, 100 = opinionated. |
| `ai_model` | enum, optional, one of `openai`, `claude`, `grok` | Which AI provider generates content in this voice. |
| `special_notes` | string, optional |  |
| `guardrails` | object, optional |  |

### `whoami`

**Who am I**

Return the connected X handle, whether the X account is connected, the scopes granted to this API key, the user's plan, and their credit balance. Call this first to confirm the connection works.

- **REST endpoint:** `GET /api/v1/me`
- **Cost:** Return the connected X handle, whether the X account is connected, the scopes granted to this API key, the user's plan, and their credit balance.

_No inputs._
