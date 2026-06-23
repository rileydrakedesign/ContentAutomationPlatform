# Examples

Copy-paste requests for the most common flows. Replace `sk_live_...` with your
key. Base URL: `https://app.agentsforx.com/api/v1`.

> **Tip:** the cheapest, highest-quality way to *write* content is to fetch your
> writing context (`GET /voice/context`, free) and write it yourself, then only
> spend credits on `POST /voice/check` and publishing. `POST /drafts/generate`
> (3 credits) is the server-side fallback. Both are shown below.

## Flow 1 — generate → check → publish

### a) Generate options (3 credits)

```bash
curl -X POST https://app.agentsforx.com/api/v1/drafts/generate \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{ "topic": "why testing pays off", "draftType": "X_POST", "voiceType": "post", "generateCount": 3 }'
```

Response (trimmed):

```json
{
  "options": [
    { "type": "X_POST", "content": { "text": "Most teams skip tests to ship faster..." },
      "applied_patterns": [], "metadata": { "voice_type": "post", "hook_type": "contrarian" } }
  ],
  "patterns_used": [],
  "topic": "why testing pays off",
  "voice_type": "post"
}
```

### b) Voice-check the option you like (3 credits)

```bash
curl -X POST https://app.agentsforx.com/api/v1/voice/check \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{ "text": "Most teams skip tests to ship faster...", "voice_type": "post" }'
```

```json
{ "voice_type": "post", "score": 82,
  "matches": ["direct opener", "concrete example"],
  "deviations": ["slightly long"],
  "suggested_edit": "Most teams skip tests to ship faster. They ship bugs faster too." }
```

Iterate until the score is high, then publish.

### c) Publish now (3 credits; 30 if the text has a URL)

```bash
curl -X POST https://app.agentsforx.com/api/v1/publish/now \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{ "contentType": "X_POST", "payload": { "text": "Most teams skip tests to ship faster. They ship bugs faster too." } }'
```

```json
{ "posted": true, "postedIds": ["1772333000000000000"] }
```

Publish a **thread** with `contentType: "X_THREAD"` and `payload: { "tweets": [...] }`,
or a **reply** with `contentType: "X_REPLY"` and `payload: { "text": "...", "inReplyToId": "<tweet id>" }`.

### JavaScript (fetch)

```js
const BASE = "https://app.agentsforx.com/api/v1";
const h = { "Authorization": `Bearer ${process.env.AFX_KEY}`, "Content-Type": "application/json" };

const gen = await (await fetch(`${BASE}/drafts/generate`, {
  method: "POST", headers: h,
  body: JSON.stringify({ topic: "why testing pays off", draftType: "X_POST", voiceType: "post", generateCount: 3 }),
})).json();

const text = gen.options[0].content.text;

const check = await (await fetch(`${BASE}/voice/check`, {
  method: "POST", headers: h, body: JSON.stringify({ text, voice_type: "post" }),
})).json();

if (check.score >= 75) {
  const pub = await (await fetch(`${BASE}/publish/now`, {
    method: "POST", headers: h,
    body: JSON.stringify({ contentType: "X_POST", payload: { text } }),
  })).json();
  console.log("posted", pub.postedIds);
}
```

### Python (requests)

```python
import os, requests
BASE = "https://app.agentsforx.com/api/v1"
H = {"Authorization": f"Bearer {os.environ['AFX_KEY']}", "Content-Type": "application/json"}

gen = requests.post(f"{BASE}/drafts/generate",
    json={"topic": "why testing pays off", "draftType": "X_POST", "voiceType": "post", "generateCount": 3},
    headers=H).json()

text = gen["options"][0]["content"]["text"]

check = requests.post(f"{BASE}/voice/check", json={"text": text, "voice_type": "post"}, headers=H).json()

if check["score"] >= 75:
    pub = requests.post(f"{BASE}/publish/now",
        json={"contentType": "X_POST", "payload": {"text": text}}, headers=H).json()
    print("posted", pub["postedIds"])
```

## Flow 2 — schedule a post (Pro)

`scheduledFor` must be a future ISO-8601 timestamp. Credits are debited now and
refunded if you cancel.

```bash
curl -X POST https://app.agentsforx.com/api/v1/publish/schedule \
  -H "Authorization: Bearer sk_live_..." \
  -H "Content-Type: application/json" \
  -d '{ "contentType": "X_POST", "payload": { "text": "Scheduled hello" }, "scheduledFor": "2026-07-01T15:00:00Z" }'
```

```json
{ "id": "8f0c...", "scheduledFor": "2026-07-01T15:00:00Z", "deliveryConfirmed": true }
```

List the queue with `GET /queue` and cancel with `DELETE /queue/{id}` (refunds the credits).

## Flow 3 — find posts to reply to (Pro)

```bash
curl "https://app.agentsforx.com/api/v1/search/reply-targets?query=ai%20agents%20-is%3Aretweet&max_results=10&sort=traction" \
  -H "Authorization: Bearer sk_live_..."
```

```json
{
  "tweets": [ { "id": "...", "text": "...", "author": { "username": "..." }, "reply_allowed": true } ],
  "query": "ai agents -is:retweet",
  "sort": "traction",
  "returned_count": 10,
  "repliable_count": 4
}
```

You're charged on `returned_count` (min 5). Read a single tweet's full text +
metrics with `GET /tweets/{id}` (1 credit) before drafting a reply.
