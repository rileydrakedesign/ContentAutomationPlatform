# MCP tools — a guided tour

This is the narrative tour of the 36 tools, grouped by what they're for. For the
exhaustive per-tool reference (every input, type, constraint, credit cost, and
REST mapping), see the generated **[tools.generated.md](tools.generated.md)** —
it is produced from the Zod schemas in [`mcp/src/tools.ts`](../../mcp/src/tools.ts)
and cannot drift.

Costs below are in credits (1 credit = $0.01); see [../api/credits.md](../api/credits.md).

## Identity & config (free)

- **`whoami`** — X connection health, scopes, plan, credits, and context
  freshness. Call it first.
- **`health`** — connectivity / key check.
- **`get_credits`** — plan + credit balances.
- **`get_voice_settings`** / **`update_voice_settings`** — read or partially
  update the voice dials, guardrails, and AI model for the `post` or `reply`
  voice. Confirm material voice changes with the user first.
- **`get_strategy`** / **`update_strategy`** — read or replace the weekly content
  strategy (posts/threads/replies per week + pillar targets).
- **`get_niche`** — the analyzed niche profile (summary, pillars, clusters,
  positioning).

## Writing & tuning

- **`get_writing_context`** *(free, preferred)* — returns your assembled voice
  system prompt, proven patterns, and platform rules so the **agent writes the
  content itself**. Cheapest and usually best.
- **`generate_post`** / **`generate_reply`** *(3 credits, fallback)* — server-side
  generation in your `post` / `reply` voice. Returns options; never publishes.
- **`check_draft`** *(3 credits)* — score a draft 0-100 against your tuned voice +
  patterns; returns matches, deviations, and a suggested edit. Run before saving
  or publishing and iterate.
- **`run_tuneup`** *(5 credits)* — the full Voice Tune-Up: refresh examples →
  extract patterns → re-analyze niche & positioning, returning the Voice Report.
  Suggested when `whoami`/`get_writing_context` report `retune_recommended`.
- **`send_feedback`** *(free)* — log like/dislike on a generation; feeds future
  prompt assembly.

See [workflows.md](workflows.md) for the write-yourself-vs-generate decision and
the check-loop.

## Drafts (free)

- **`list_drafts`**, **`get_draft`**, **`create_draft`**, **`update_draft`**,
  **`delete_draft`** — CRUD over saved drafts. Content is `{ text }` for a single
  post or `{ tweets: [...] }` for a thread.

## Publishing (consequential)

Publishing posts to X **immediately and irreversibly** — always confirm the exact
final text with the user first.

- **`publish_post`** *(3 / 30 with a URL)* — one post.
- **`publish_thread`** *(3 per tweet)* — a thread; on partial failure, resume with
  the remaining tweets only (don't retry the whole thread).
- **`publish_reply`** *(3 / 30 with a URL)* — a reply to `inReplyToId`.
- **`schedule_post`** *(Pro; debited now, refunded on cancel)* — schedule a post
  or thread for a future ISO-8601 time.

## Queue & history (free)

- **`list_queue`** — scheduled posts (each item includes its `draft_id`).
- **`cancel_scheduled`** — cancel a still-pending post; refunds the credits.
- **`list_published`** — scheduled-post history across all states.

## Analysis

- **`get_analytics`** *(1 credit)* — totals, or recent posts / CSV rows via
  `include`.
- **`get_best_times`** *(1 credit)* — day-of-week engagement breakdown.
- **`sync_analytics`** *(15 credits, Pro)* — delta-sync your timeline from X.
- **`get_tweet`** *(1 credit)* — fetch a tweet's text + metrics by ID or URL;
  the usual way to get reply context.
- **`search_tweets`** *(1/result, min 5, Pro)* — search recent public tweets;
  each result carries reply-eligibility fields.
- **`find_reply_posts`** *(1/post returned, min 5, Pro)* — search and return
  **only** repliable posts; `sort=traction` ranks by momentum. Use this when the
  goal is to find posts to reply to.

## Patterns & inspiration (free)

- **`list_patterns`** / **`toggle_pattern`** — view proven patterns (with
  engagement multipliers) and enable/disable them for generation.
- **`list_inspiration`** / **`add_inspiration`** *(add: 3 credits)* — your
  inspiration library; saved posts are auto-analyzed and influence generation.

---

For the full input schemas and exact REST endpoint behind each tool, jump to
**[tools.generated.md](tools.generated.md)**.
