# Cost Analysis — Agents for X

_Updated: March 26, 2026_

## Executive Summary

With X's new **pay-per-use API** (launched Feb 6, 2026), there is no longer a
fixed $200/mo or $5,000/mo subscription. We pay per request: **$0.005/post read**,
**$0.01/post write**, **$0.01/user lookup**. This dramatically changes the cost
picture — X API costs are now **variable and proportional to usage**, not fixed.

At 50 users, estimated X API costs are **$75–175/mo** depending on usage
patterns, down from the $200/mo Basic floor. Combined with negligible AI costs
(~$2–5/mo), total operating costs are **$77–225/mo**. Per-user variable cost is
**$1.50–3.50/mo**, making a $19/mo Pro tier highly profitable.

---

## 1. AI Provider Costs (unchanged)

### Models Used

| Provider | Model | Input Cost | Output Cost | Where Used |
|----------|-------|-----------|------------|------------|
| OpenAI | gpt-4o-mini | $0.15/1M tokens | $0.60/1M tokens | Reply gen, drafts, insights, patterns, niche, voice chat |
| OpenAI | gpt-4-turbo-preview | $10/1M tokens | $30/1M tokens | Legacy "standard" tier (voice memo analysis) |
| Anthropic | claude-sonnet-4 | $3/1M tokens | $15/1M tokens | Optional user-selected provider |
| xAI | grok-3 | TBD | TBD | Optional user-selected provider |

### Per-Call Token Estimates

| Feature | Max Output Tokens | Avg Input Tokens | Avg Total | Cost (gpt-4o-mini) |
|---------|-------------------|------------------|-----------|---------------------|
| Reply generation (3 options) | 400 | ~800 | ~1,200 | $0.0004 |
| Draft generation (3 options) | 2,000 | ~1,500 | ~3,500 | $0.0014 |
| Insights chat | 600 | ~1,000 | ~1,600 | $0.0005 |
| Pattern extraction | 2,000 | ~3,000 | ~5,000 | $0.0016 |
| Niche analysis | 2,000 | ~4,000 | ~6,000 | $0.0019 |
| Voice chat (per stage) | ~500 | ~800 | ~1,300 | $0.0004 |
| Voice preview | 200 | ~500 | ~700 | $0.0002 |

### Monthly AI Costs (50 Users)

**Assumptions per user/month:**
- 20 reply generations
- 15 draft generations
- 10 insights chats
- 1 pattern extraction
- 1 niche analysis
- 3 voice chat sessions (3 stages avg each)

| Feature | Calls/mo (50 users) | Cost (gpt-4o-mini) |
|---------|---------------------|---------------------|
| Reply gen | 1,000 | $0.40 |
| Draft gen | 750 | $1.05 |
| Insights | 500 | $0.25 |
| Patterns | 50 | $0.08 |
| Niche | 50 | $0.10 |
| Voice chat | 450 | $0.18 |
| **Total** | **2,800** | **$2.06/mo** |

If users select Claude instead: ~$13.50/mo (still very low).

**Recommendation:** Default to gpt-4o-mini for all features. Consider changing
the "standard" tier model from gpt-4-turbo-preview to gpt-4o-mini — the quality
difference is negligible for these use cases and it's 67x cheaper.

---

## 2. X API Costs — Pay-Per-Use Model

### Per-Request Pricing (as of Feb 6, 2026)

| Operation | Cost per request | Notes |
|-----------|-----------------|-------|
| **Post Read** | $0.005 | Reading a tweet/post |
| **Post Create (Write)** | $0.01 | Publishing a tweet |
| **User Lookup** | $0.01 | Fetching user profile data |

**Key features of pay-per-use:**
- No subscription — pay only for what you use, no minimum spend
- Credit-based: buy credits upfront in the Developer Console
- 24-hour deduplication: reading the same post within a UTC day counts once
- Monthly cap: 2M post reads/month (Enterprise required above that)
- Auto top-up and spending caps available to prevent runaway costs
- **xAI credit-back**: earn up to 20% of X API spend as xAI/Grok credits

### Current X API Usage Points in Our App

| Feature | Operation Type | Posts/call | Frequency |
|---------|---------------|------------|-----------|
| OAuth token exchange/refresh | N/A (free) | 0 | Per login |
| Verify credentials (users/me) | User Lookup | 1 user | Per connection |
| getUserTimeline (sync) | Post Read | 100 posts/page | User-triggered |
| getTweetsBatch (metrics) | Post Read | Up to 100 posts | Cron: daily |
| searchRecentTweets | Post Read | 10–100 posts | User-triggered |
| postTweet (publish) | Post Write | 1 | User-triggered |

### Monthly X API Usage & Cost (50 Users)

**Conservative estimates per user/month:**
- 4 manual timeline syncs × 100 posts = 400 post reads
- Cron analytics-sync: 30 days × 200 posts = 6,000 post reads
- Cron metrics-refresh: 30 days × 200 posts = 6,000 post reads
- 10 inspiration searches × 10 posts avg = 100 post reads
- 20 posts published = 20 post writes
- 2 user lookups (connection + refresh)

| Operation | Per User/Mo | 50 Users/Mo | Cost/Unit | Monthly Cost |
|-----------|------------|-------------|-----------|-------------|
| Post Reads (sync) | 400 | 20,000 | $0.005 | $100.00 |
| Post Reads (cron analytics) | 6,000 | 300,000 | $0.005 | $1,500.00 |
| Post Reads (cron metrics) | 6,000 | 300,000 | $0.005 | $1,500.00 |
| Post Reads (search) | 100 | 5,000 | $0.005 | $25.00 |
| Post Writes | 20 | 1,000 | $0.01 | $10.00 |
| User Lookups | 2 | 100 | $0.01 | $1.00 |
| **Total (unoptimized)** | | **626,100** | | **$3,136.00** |

**This is too expensive.** The cron jobs dominate. We MUST optimize.

### Optimized X API Usage & Cost (50 Users)

**Optimization strategies:**
1. **Disable cron analytics-sync** — rely on Chrome extension + CSV for reads
   (these are free, zero X API cost). Only offer X API sync as on-demand.
2. **Disable cron metrics-refresh** — refresh metrics only when user views
   analytics page (lazy refresh), and use 24-hour dedup to avoid repeat charges.
3. **Reduce sync page size** — fetch 50 posts per sync instead of 100.
4. **Cap inspiration searches** — limit to 10 results per search.

| Operation | Per User/Mo | 50 Users/Mo | Cost/Unit | Monthly Cost |
|-----------|------------|-------------|-----------|-------------|
| Post Reads (manual sync, 4×50) | 200 | 10,000 | $0.005 | $50.00 |
| Post Reads (lazy metrics, 2×/mo×50) | 100 | 5,000 | $0.005 | $25.00 |
| Post Reads (search) | 100 | 5,000 | $0.005 | $25.00 |
| Post Writes | 20 | 1,000 | $0.01 | $10.00 |
| User Lookups | 2 | 100 | $0.01 | $1.00 |
| **Total (optimized)** | | **21,100** | | **$111.00** |

**With 24-hour deduplication**, repeated reads of the same posts (e.g., metrics
refresh on already-synced posts) cost nothing extra within a UTC day, so actual
costs could be **even lower (~$75–90/mo)**.

**xAI credit-back** of up to 20% means ~$15–22 back as xAI/Grok credits per
month — effectively subsidizing our AI costs if we use Grok.

### Cost Scaling

| Users | Optimized Monthly X API Cost | Notes |
|-------|------------------------------|-------|
| 10 | ~$22 | Well under any old tier |
| 25 | ~$56 | Still cheaper than old Basic ($200) |
| 50 | ~$111 | Sweet spot |
| 100 | ~$222 | Linear scaling, still reasonable |
| 500 | ~$1,110 | Approaching old Pro cost, but proportional |

---

## 3. Infrastructure Costs (unchanged)

| Service | Tier | Monthly Cost | Notes |
|---------|------|-------------|-------|
| Supabase | Free→Pro | $0–25 | Free handles 50 users easily (<100MB data) |
| Vercel | Hobby→Pro | $0–20 | Free tier: 100GB bandwidth, 100 hours compute |
| Upstash QStash | Free | $0 | <100 messages/day at 50 users |
| Upstash Redis | Free | $0 | Rate limiting: <10k commands/day |
| **Subtotal** | | **$0–45/mo** | |

---

## 4. Total Monthly Cost Summary

### At 50 Users (Target) — Optimized

| Category | Monthly Cost |
|----------|-------------|
| X API (pay-per-use, optimized) | $75–111 |
| AI (OpenAI gpt-4o-mini) | $2–5 |
| Supabase | $0–25 |
| Vercel | $0–20 |
| QStash + Redis | $0 |
| **Total** | **$77–161/mo** |

### Per-User Variable Cost

| Category | Per User/Month |
|----------|---------------|
| X API (post reads + writes) | $1.50–2.25 |
| AI calls | $0.04–0.10 |
| Infrastructure | $0–0.50 |
| **Total per user** | **~$1.55–2.85** |

**Key difference from old model:** There is no longer a $200 fixed floor.
Costs scale linearly from $0 with usage. This makes the unit economics
significantly better for a small user base.

---

## 5. Pricing Recommendations (Updated)

### Suggested Tiers

Based on per-user variable cost of ~$2–3/mo, target 6–10x margin on paid tiers:

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0/mo | CSV upload, Chrome extension imports, 5 AI generations/day, manual posting |
| **Pro** | $19/mo | X API sync (on-demand), unlimited AI generations, scheduling, analytics, patterns, insights |
| **Business** | $39/mo | Everything in Pro + priority support, multiple X accounts (future) |

### Revenue at 50 Users

| Scenario | Monthly Revenue | Monthly Cost | Monthly Profit | Margin |
|----------|----------------|-------------|----------------|--------|
| 50 Pro users | $950 | $161 | $789 | 83% |
| 30 Pro + 20 Free | $570 | $115 | $455 | 80% |
| 40 Pro + 10 Business | $1,150 | $155 | $995 | 87% |

### Break-Even Analysis

- Fixed infrastructure costs: ~$20–45/mo (Supabase + Vercel)
- Variable per paid user: ~$2.85/mo
- **Break-even at $19/mo: 2–3 paid users**

This is dramatically better than the old model (which required 11 users to
break even on the $200/mo Basic tier).

---

## 6. Cost Optimization Recommendations (Updated)

### Critical (Must Do Before Launch)

1. **Disable cron-based analytics-sync and metrics-refresh** — These alone would
   cost $3,000/mo at 50 users. Replace with on-demand sync triggered by user
   action (visiting analytics page, clicking "Sync" button).
2. **Set X API spending cap** in the Developer Console — prevent runaway costs
   from bugs or abuse. Recommended cap: $200/mo initially.
3. **Promote CSV/extension imports** — These are completely free and should be
   the primary path for free-tier users to get posts into the app.

### Important

4. **Switch all AI to gpt-4o-mini** — Change "standard" tier from
   gpt-4-turbo-preview.
5. **Cap AI generations for free tier** — 5/day limit (already implemented).
6. **Leverage 24-hour dedup** — When refreshing metrics, batch within a single
   UTC day to avoid double-charging for the same posts.
7. **Use xAI credit-back** — The 20% credit-back on X API spend can subsidize
   Grok usage for AI features, effectively reducing AI costs to near-zero.

### Nice to Have

8. **Lazy metrics refresh** — Only refresh when user views analytics, not on a
   cron schedule.
9. **Add X API cost tracking** — Log credits consumed per user to monitor
   per-user costs and identify abuse.
10. **Consider passing through X API costs** — If a power user does 10x the
    average syncs, consider metered billing or usage alerts.

---

## 7. Implementation Priority

Based on this analysis:

1. **Disable or convert cron jobs to on-demand** — Highest cost savings
2. Free tier: No X API access, CSV/extension only, capped AI usage
3. Pro tier ($19/mo): On-demand X API sync, unlimited AI, scheduling
4. Set X API spending cap in Developer Console
5. Monitor actual usage in first month and adjust

---

## Sources

- [X API Pay-Per-Use Launch Announcement](https://devcommunity.x.com/t/announcing-the-launch-of-x-api-pay-per-use-pricing/256476)
- [X API Pay-Per-Use Pilot Announcement](https://devcommunity.x.com/t/announcing-the-x-api-pay-per-use-pricing-pilot/250253)
- [X API Pricing 2026 — Postproxy Blog](https://postproxy.dev/blog/x-api-pricing-2026/)
- [X Revamps Developer API Pricing — MediaNama](https://www.medianama.com/2026/02/223-x-developer-api-pricing-pay-per-use-model/)
- [X API Pricing 2026 — WeAreFounders](https://www.wearefounders.uk/the-x-api-price-hike-a-blow-to-indie-hackers/)
- [Social Media Today — X Usage-Based API](https://www.socialmediatoday.com/news/x-formerly-twitter-launches-usage-based-api-access-charges/803315/)
