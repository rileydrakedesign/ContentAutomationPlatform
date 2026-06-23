# Credits & billing

Actions that incur real X API or AI costs are metered in **credits**.

> **1 credit = $0.01.**

The same currency, prices, and balance apply across the web app, the REST API,
and both MCP transports. Source of truth: [`src/lib/billing/credits.ts`](../../src/lib/billing/credits.ts)
(`CREDIT_COSTS`).

## Per-action prices

| Action | Endpoint | Credits |
| --- | --- | --- |
| Generate draft/reply options | `POST /drafts/generate` | **3** |
| Voice-check a draft | `POST /voice/check` | **3** |
| Run a Voice Tune-Up | `POST /insights/tuneup` | **5** |
| Publish a tweet (no URL) | `POST /publish/now`, `POST /publish/schedule` | **3 / tweet** |
| Publish a tweet **containing a URL** | same | **30 / tweet** |
| Save inspiration | `POST /inspiration` | **3** |
| Read a tweet | `GET /tweets/{id}` | **1** |
| Search tweets | `GET /search`, `GET /search/reply-targets` | **1 / result, min 5** |
| Read analytics | `GET /analytics`, `GET /analytics/best-times` | **1** |
| Sync timeline from X | `POST /analytics/sync` | **15** |

Everything else is **free**: `/health`, `/me`, drafts CRUD, the publish queue
(`/queue`, `/publish`) and cancel, voice settings & writing context (`/voice`,
`/voice/context`), strategy, niche, patterns (list/toggle), inspiration list, and
feedback.

### Why URL posts cost 30

X bills a post containing a link at roughly **13×** a plain post under its
pay-per-use pricing. The link detector (`containsUrl`) recognizes `http(s)://`
and bare domains on common TLDs — `@mentions`, `$cashtags`, and emails do **not**
count. A thread is charged per tweet, so a 3-tweet thread with one link tweet
costs `3 + 3 + 30 = 36`.

### Search is charged on what X returns

`/search` and `/search/reply-targets` are billed per post **X returns**
(minimum 5), debited worst-case up front and refunded down to the actual count.
For `/search/reply-targets`, posts that get filtered out as non-repliable **still
count** toward cost — `returned_count` is what you paid for, `repliable_count` is
what you got back.

## Metered response headers

Metered calls include:

| Header | Meaning |
| --- | --- |
| `X-Credits-Charged` | Credits debited by this call |
| `X-Credits-Remaining` | Balance after the call |

Over MCP, the same numbers appear as a `credits: charged N, remaining M` trailer
on the tool result.

## Buckets: allowance vs. packs

`GET /me` returns a `credits` object:

- `allowance_remaining` — your monthly plan allowance; resets on your billing
  anniversary. Spent **first**.
- `pack_balance` — purchased top-up packs; consumed **after** the allowance and
  never expire while subscribed.
- `balance` — total spendable (`allowance_remaining + pack_balance`).

Plan allowances and pack sizes ([`src/types/subscription.ts`](../../src/types/subscription.ts)):

| Plan | Monthly credits | Rate (req/min) | Publish/day | Generate/day |
| --- | --- | --- | --- | --- |
| Free | 100 | 20 | 5 | 20 |
| Pro ($29) | 2,000 | 60 | 200 | 1,000 |
| Agent ($79) | 7,500 | 120 | 600 | 3,000 |

Top-up packs: **500 / $6**, **2,000 / $20**, **10,000 / $80**.

## Running out (402)

When a charge can't be covered you get **402 `INSUFFICIENT_CREDITS`**:

```json
{
  "error": "Insufficient credits",
  "code": "INSUFFICIENT_CREDITS",
  "balance": 2,
  "required": 30,
  "topup_url": "/settings?tab=billing"
}
```

Top up at the URL or wait for the monthly reset. Handle it by checking
`GET /me` (or `whoami` over MCP) before expensive batches.

## Refunds

Charges for **failed external calls are automatically refunded**: if X rejects a
post, generation/voice-check fails, or a search call errors, the credits return
to your allowance bucket. Scheduled posts are debited at schedule time and
**refunded on cancel**. For a partially-posted thread, only the **un-posted**
remainder is refunded (the posted prefix really did cost X writes).

For the underlying COGS and pricing rationale, see [../cost-analysis.md](../cost-analysis.md).
