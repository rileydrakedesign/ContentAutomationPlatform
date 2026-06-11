# MCP Launch — Human-Required Tasks

Everything else in `MCP_PROD_READINESS_PLAN.md` (W1–W8) is implemented, tested,
and committed. These are the items that need a human (account access, money,
or a business decision). Work top to bottom; 1–3 are launch-blocking.

## 1. X Developer Console (launch-blocking)

- [ ] Confirm the in-house X app is on **pay-per-use billing** and load initial
      credits (suggest $200 to start).
- [ ] Set a **monthly spend cap** and enable auto-recharge alerts in the
      developer console.
- [ ] Confirm whether reads of users' own timelines via OAuth user context bill
      at the **$0.001 owned-read** rate or **$0.005 standard**. The credit
      pricing is profitable either way, but if it's standard-rate, consider
      dropping the cron `analytics-sync` frequency (currently daily at 06:00)
      to weekly — see `vercel.json`.

## 2. npm publish (launch-blocking for the stdio package)

- [ ] Create/claim the **@agentsforx** npm org.
- [ ] Generate an npm automation token and add it as the `NPM_TOKEN` GitHub
      Actions secret.
- [ ] Push the tag to publish: `git tag mcp-v1.0.0 && git push origin mcp-v1.0.0`
      — `.github/workflows/mcp-publish.yml` builds, tests, verifies the tag
      matches `mcp/package.json`, and publishes with provenance.
- [ ] Note: the **hosted** MCP endpoint (`/api/v1/mcp`) ships with the next app
      deploy and works without the npm package.

## 3. Stripe live mode (launch-blocking for credit packs)

Test mode is already set up (prices created, IDs in `.env.local`):

| Lookup key | Test price ID |
|---|---|
| `credits_500` ($6) | `price_1TgyBAIsSyfAjCkWMXbsaEM6` |
| `credits_2000` ($20) | `price_1TgyBBIsSyfAjCkWBCbv5FJb` |
| `credits_10000` ($80) | `price_1TgyBBIsSyfAjCkWTL7JG48L` |
| `plan_agent` ($79/mo) | `price_1TgyBCIsSyfAjCkW5Go0sLkl` |

- [ ] **Sign off on retail pricing** (plan §B: plans/allowances/pack prices,
      30-credit URL-post surcharge).
- [ ] Run the same script against live mode:
      `STRIPE_SECRET_KEY=sk_live_... node scripts/stripe-setup-credits.mjs --live`
- [ ] Put the printed live price IDs into Vercel env (production):
      `STRIPE_PRICE_CREDITS_500`, `STRIPE_PRICE_CREDITS_2000`,
      `STRIPE_PRICE_CREDITS_10000`.
- [ ] Verify the live webhook endpoint subscribes to
      `checkout.session.completed` (it already must for subscriptions — packs
      reuse the same event; no new events needed).

## 4. Decision: ship the $79 Agent tier at launch?

The tier is fully implemented but **hidden until
`NEXT_PUBLIC_STRIPE_AGENT_PRICE_ID` is set** in Vercel env. To ship it, set the
env var (live price from step 3) and redeploy; to hold, do nothing.

## 5. Decision: claude.ai connector directory

The hosted endpoint works today with API-key headers (Claude Code, API
clients). A claude.ai **connector directory** listing additionally requires
OAuth 2.1 + dynamic client registration — a separate project. Decide whether to
pursue it; until then the README documents the `--header` flow.

## 6. Legal / ToS

- [ ] Update Terms + pricing page copy for: credits, overage packs,
      **the URL-post surcharge disclosure** (30 credits vs 3), and the refund
      semantics (failed publishes auto-refund; cancelled scheduled posts
      refund).

## 7. Production env check before promoting

- [ ] `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` (rate limiting is
      fail-closed in prod without them).
- [ ] New Stripe price ID vars from step 3.
- [ ] `CRON_SECRET` set; confirm new crons appear after deploy
      (`credits-reset` 00:30 UTC, `usage-rollup` 00:15 UTC).
- [ ] Optional: `CONTENT_API_SELF_URL` if the MCP route should self-call a
      different host than `NEXT_PUBLIC_APP_URL`.
- [ ] Pre-existing security advisory surfaced during this work:
      `waitlist_signups` has **RLS disabled**. Remediation (decide policies
      first — blanket enable would break the public signup insert):
      `ALTER TABLE public.waitlist_signups ENABLE ROW LEVEL SECURITY;` plus an
      insert policy for anon.

## Monitoring once live

- `usage_daily` table: daily est. COGS rollup; Sentry alerts fire at
  >$25/day total or >$5/day per user.
- Watch the X developer console spend dashboard against `usage_daily`
  estimates for the first week — if they diverge, the owned-read question in
  step 1 is the likely cause.
