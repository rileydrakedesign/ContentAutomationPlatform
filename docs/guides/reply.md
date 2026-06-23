# Guide: Replying

Replying to high-momentum posts in your voice is the second growth engine
(alongside original posts). The reply engine is the same on every surface — it
finds posts you can **actually** reply to, ranks them by traction, generates a
reply in your **reply-voice**, and voice-checks it before it ships.

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
replies to a *specific* conversation. X only rejects at publish time with a 403
("Reply to this conversation is not allowed…"). `isReplyForbiddenError`
([`search-mapping.ts`](../../src/lib/x-api/search-mapping.ts)) recognizes this, and:

- **Dashboard** (`/api/publish/now`, `X_REPLY`): returns a clean 403; the reply
  finder shows "X won't allow a reply here — the author limited who can reply" and
  **removes that post from the list** (not a raw error).
- **v1 / MCP** (`/api/v1/publish/now`): **refunds the charged credits**, then
  returns a `reply_forbidden` 403 with the same clear message.

## Generate a reply in your voice

Replies are generated through the assembled **reply-voice** (your reply examples,
controls, guardrails) — never a generic model. An optional tone is a one-off
angle subordinate to your voice.

- **Web app / extension:** `POST /generate-reply` (cookie or extension Bearer).
- **API / MCP:** `POST /api/v1/drafts/generate` (reply) / `generate_reply`.

## Publish — voice-check optional

Voice-check (`voice_type: "reply"`) is **offered, not required**:

- **Web app `/reply`:** two actions — **Post reply** (ships immediately via
  `POST /api/publish/now`, `X_REPLY`) and **Voice-check & reply** (runs the
  3-credit check, surfaces the score, then you post). The sent reply is logged to
  the reply pool so it feeds your reply-voice.
- **Extension:** the picker has an on-demand voice-check; "Use this reply" injects
  it into X's native composer.
- **API / MCP:** `check_draft` is a separate, optional tool — call it before
  `publish_reply` if you want a score, or publish directly.

## The full path

```
find_reply_posts  →  generate_reply  →  [check_draft]  →  publish_reply
(repliable+traction)  (reply-voice)    (optional score)   (X_REPLY)
```

This is identical on the dashboard, the extension, the API, and MCP — see the
[parity matrix](../architecture/loop.md#parity-matrix).
