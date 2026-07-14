# MCP workflows

Patterns for getting good, on-voice results cheaply and safely.

## Write it yourself vs. generate

There are two ways to produce content; prefer the first.

1. **Write it yourself (free, best).** Call `get_writing_context` with
   `voiceType: "post"` or `"reply"`. It returns the user's assembled voice system
   prompt (dials, guardrails, niche positioning, real examples, inspiration),
   their highest-performing **proven patterns**, and the platform rules. The
   calling model then writes the post/reply directly. The caller's model pays the
   inference, so this costs **no credits** and is usually higher quality.
2. **Server-side generation (3 credits, fallback).** `generate_post` /
   `generate_reply` run the platform's configured model with the same voice
   context. They **seed a draft the user will edit**, not a finished post. Use
   only when the agent can't write directly.

Posts use the `post` voice; replies use the `reply` voice — pass the matching
`voiceType`.

## The check_draft loop (optional)

`check_draft` is an **optional** quality step — it is never required to publish.
You can `publish_*` directly. When you do want a voice score first:

1. `check_draft` with the draft `text` and the right `voiceType` (3 credits).
2. Read `score` (0-100), `matches`, `deviations`, and `suggested_edit`.
3. Apply the edit (or your own) and re-check until the score is high and the
   deviations are gone.
4. Then `create_draft`, `schedule_post`, or publish.

This mirrors the dashboard, where every publish surface offers a direct **Post**
and a secondary **Voice-check first** — voice-check is offered, never mandatory.

## Replying to a post (handoff-only)

**Replies are never published through MCP or the API.** There is no reply-publish
tool, and `POST /api/v1/publish/now` with `contentType: "X_REPLY"` returns
`410 Gone`. The reply is handed to the human, who sends it from X's own composer.

1. If you only have a URL or ID, `get_tweet` (1 credit) to fetch the full text +
   metrics — that text is the reply context.
2. To *find* posts worth replying to, `find_reply_posts` (Pro) returns only posts
   the account can actually reply to; add `sort=traction` to prioritize momentum.
   Each target carries `post_url` (permalink) and `intent_url` (the handoff
   target).
3. Write the reply yourself from `get_writing_context(voiceType: "reply")`, or
   `generate_reply` as a fallback. `check_draft(voiceType: "reply")`.
4. **Hand off:** append `&text=<url-encoded reply>` to the target's `intent_url`
   and give the user the link. X's composer opens pre-filled and the user sends
   it. `reply_allowed` is best-effort, so a target can still turn out to be
   un-repliable (see [troubleshooting.md](troubleshooting.md)).

## Freshness & run_tuneup

`whoami` and `get_writing_context` include `context_freshness`. When
`retune_recommended` is `true`, the user's analytics are newer than their tuned
context — suggest **`run_tuneup`** (5 credits). It refreshes voice examples,
re-extracts proven patterns, re-analyzes niche & positioning, and returns the
full **Voice Report** (top patterns, top posts, cadence vs. strategy, recurring
voice-check deviations with settings suggestions, feedback themes, inspiration
alignment). See [../guides/voice-tuneup.md](../guides/voice-tuneup.md).

## Publishing safely

- Publishing is **irreversible and public.** Always show the exact final text and
  get explicit confirmation before any `publish_*` tool.
- **Threads:** on a mid-thread failure the response reports the posted prefix and
  the `remainingTweets`. **Do not** retry the whole thread — resume with only the
  remaining tweets, or the prefix double-posts.
- **Scheduling:** credits are debited at schedule time and **refunded on cancel**
  (`cancel_scheduled`). `deliveryConfirmed: false` means the queue sweep will
  deliver it rather than exact-time QStash.

## Spending wisely

- `whoami` / `get_credits` before expensive batches.
- Free tools (`get_writing_context`, drafts, queue, patterns, niche, voice
  settings, feedback) are unmetered — lean on them.
- URL posts cost **30** not 3; mention the surcharge if the user includes a link.
- Search is billed on results **returned** (min 5), so keep `maxResults` low.
