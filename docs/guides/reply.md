# Guide: Replying

Replying to high-momentum posts in your voice is the second growth engine
(alongside original posts). The reply engine is the same on every surface — it
finds posts you can **actually** reply to, ranks them by traction, writes a reply
in your **reply-voice**, and voice-checks it.

> **Replies are handoff-only. Nothing here posts a reply for you.** The finished
> reply is handed to X's own composer (pre-filled) and **you** send it. There is no
> `publish_reply` MCP tool, and `POST /api/v1/publish/now` with
> `contentType: "X_REPLY"` returns **`410 Gone`** (`code: "deprecated"`) before any
> credit is charged. This is a deliberate account-safety / ToS decision.

## Find repliable, high-traction posts

`GET /search/reply-targets?query=&sort=&max_results=` returns **only** posts the
account is allowed to reply to (`reply_allowed === true`) — never one you can't
reply to. Optional `sort=traction` ranks the repliable subset by momentum
(weighted engagement decayed by post age, so fresh + rising beats old +
saturated). The response includes `returned_count` (what X returned) and
`repliable_count` (what you can reply to).

- **Web app:** the **Reply** page (`/reply`) — search, toggle traction sort, and
  browse repliable posts with their metrics.
- **Chrome extension:** on x.com, the extension suppresses its reply affordance on
  posts X restricts, so you're never pointed at a non-repliable post.
- **API:** `GET /api/v1/search/reply-targets` (Pro, per-post credits).
- **MCP:** `find_reply_posts`.

Each target carries **`post_url`** (the permalink) and **`intent_url`**
(`https://x.com/intent/post?in_reply_to=<id>`) — the handoff target you use to
deliver the reply.

### Eligibility mapping (audited)

`deriveEligibility` in
[`src/lib/x-api/search-mapping.ts`](../../src/lib/x-api/search-mapping.ts) maps
X's `reply_settings` conservatively — a post is surfaced **only when reply is
provably open**:

| `reply_settings` | Result |
|---|---|
| `everyone` | repliable (`open`) |
| `mentionedUsers` **and** our handle is mentioned | repliable (`open_mentioned`) |
| `mentionedUsers` (not mentioned) | hidden (`restricted`) |
| `following` / `subscribers` / `verified` / any other gated value | hidden (`restricted`) |
| absent / empty | hidden (`unknown`) |

The value is normalized (trim + lowercase) so spelling/case variants don't slip
through, and anything not provably open is excluded. The search query requests
`reply_settings` + `entities`, and `find_reply_posts` returns only
`reply_allowed` posts — dashboard, `/api/search/reply-targets`, v1, and MCP all
share `findReplyTargets`, so the rule is fixed once.

### Graceful residual 403s

Some restrictions are **undetectable pre-flight** — an author can limit who
replies to a *specific* conversation. Because the reply is sent by you from X's own
composer, X simply rejects it there; nothing in the product needs to unwind a
charge. (`isReplyForbiddenError` in
[`search-mapping.ts`](../../src/lib/x-api/search-mapping.ts) still recognizes the
403 for any X-API path that can hit it.)

## Generate a reply in your voice

Replies are generated through the assembled **reply-voice** (your reply examples,
controls, guardrails) — never a generic model. An optional tone is a one-off
angle subordinate to your voice.

- **Web app / extension:** `POST /generate-reply` (cookie or extension Bearer).
- **API / MCP:** `POST /api/v1/drafts/generate` (reply) / `generate_reply`.

## Send — the handoff (voice-check optional)

Voice-check (`voice_type: "reply"`) is **offered, not required**. The send itself
always happens in X:

- **Web app `/reply`:** the reply is handed off — extension assist (X's reply
  composer, pre-filled) → X web intent in a new tab → copy + open post as the last
  fallback. You press send on X. Replies you send are logged to the reply pool so
  they feed your reply-voice.
- **Extension:** the picker has an on-demand voice-check; "Use this reply" injects
  it into X's native composer.
- **API / MCP:** `check_draft` is a separate, optional tool. To deliver the reply,
  append `&text=<url-encoded reply>` to the target's `intent_url` and give the user
  that link.

## The full path

```
find_reply_posts  →  generate_reply  →  [check_draft]  →  intent_url + &text=…
(repliable+traction)  (reply-voice)    (optional score)   (the human sends it on X)
```

This is identical on the dashboard, the extension, the API, and MCP — see the
[parity matrix](../architecture/loop.md#parity-matrix).
