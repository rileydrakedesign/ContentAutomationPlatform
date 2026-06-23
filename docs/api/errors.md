# Errors, status codes & rate limits

## Error shape

All errors return a consistent JSON body:

```json
{
  "error": "Human-readable message",
  "code": "machine_readable_code"
}
```

Some errors add fields — e.g. `402` includes `balance`, `required`, `topup_url`;
daily caps include `used`, `limit`; a partial-thread `502` includes `postedIds`,
`failedAtIndex`, `remainingTweets`. Every response (success or error) also
carries an `X-Request-Id`.

## Status codes

| Status | `code` | Meaning & what to do |
| --- | --- | --- |
| 400 | `validation_error`, `invalid_body`, `x_not_connected` | Bad/missing fields or no X connection. Fix the request / reconnect X. |
| 401 | `unauthorized` | Missing or invalid API key. |
| 402 | `INSUFFICIENT_CREDITS` | Out of credits — top up or wait for reset. See [credits.md](credits.md). |
| 403 | `forbidden` | Key lacks required scope(s). The message lists which. |
| 403 | `plan_limit` | Feature needs a higher plan (search, scheduling, timeline sync are **Pro**). |
| 404 | `not_found` | Resource doesn't exist (or isn't yours). |
| 409 | — | Conflict: e.g. duplicate inspiration URL, or cancelling a post no longer in `scheduled` state. |
| 429 | `rate_limited` | Per-minute rate limit hit. Back off; see headers below. |
| 429 | `daily_cap` | Daily publish/generate cap hit (abuse backstop). |
| 500 | `internal_error`, `*_failed` | Server error. Safe to retry idempotent GETs. |
| 502 | `x_api_error`, `x_partial_thread`, `generation_failed` | An upstream call (X / AI) failed. Credits for failed work are refunded. |

## Rate limits

Per-key sliding window, sized by plan (Free 20, Pro 60, Agent 120 req/min). Read
these headers and pause until the reset when `remaining` hits 0:

| Header | Meaning |
| --- | --- |
| `X-RateLimit-Limit` | Max per window |
| `X-RateLimit-Remaining` | Left in the window |
| `X-RateLimit-Reset` | Unix seconds until reset |

## Daily action caps

On top of credits, publishing and generation have per-plan **daily** caps
(abuse backstop): publish/day = Free 5 / Pro 200 / Agent 600; generate/day =
Free 20 / Pro 1,000 / Agent 3,000. Hitting one returns `429 daily_cap` with
`used` and `limit`.

## Retry guidance

- **429 `rate_limited`:** exponential backoff; respect `X-RateLimit-Reset`.
- **429 `daily_cap`:** stop for the day — retrying won't help until UTC rollover.
- **502 on a single post / generation / search:** retry is safe; credits were
  refunded.
- **502 `x_partial_thread`:** **do not** retry the whole thread — the response's
  `remainingTweets` is the exact resume payload; re-publish only those (otherwise
  you double-post the prefix).
- **402:** don't retry until the balance changes.
