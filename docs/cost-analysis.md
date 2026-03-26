# Cost Analysis — Agents for X

_Generated: March 25, 2026_

## Executive Summary

The dominant cost driver is the **X API tier**. At 50 users, Basic ($200/mo) is
borderline and Pro ($5,000/mo) is overkill. The AI costs are negligible
(<$5/mo at 50 users using gpt-4o-mini). The recommended approach is to start on
Basic tier, use the Chrome extension / CSV uploads to reduce X API read calls,
and scale to Pro only if needed.

---

## 1. AI Provider Costs

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

## 2. X/Twitter API Costs

### Tier Comparison

| Feature | Free ($0) | Basic ($200/mo) | Pro ($5,000/mo) |
|---------|-----------|-----------------|-----------------|
| Tweet read | 10k/mo | 10k/mo | 1M/mo |
| Tweet write | 0 | 1,667/mo | 300k/mo |
| Search recent | No | Yes (limited) | Full |
| organic_metrics | No | No | Yes |
| Users per app | 1 | 1 | Unlimited |

### Current X API Usage Points

| Feature | API Calls | Frequency |
|---------|-----------|-----------|
| OAuth token exchange/refresh | 1 per login/refresh | Low |
| Verify credentials | 1 per connection | Low |
| getUserTimeline (sync) | 1-2 per sync (100 tweets/page) | User-triggered |
| getTweetsBatch (metrics refresh) | 1 per 100 posts | Cron: daily |
| searchRecentTweets (inspiration) | 1 per search | User-triggered |
| postTweet (publish) | 1 per post | User-triggered |

### Monthly X API Usage (50 Users)

**Conservative estimates:**
- Timeline syncs: 50 users × 4 syncs/mo × 2 pages = **400 read calls**
- Cron analytics sync: 50 users × 30 days × 2 pages = **3,000 read calls**
- Metrics refresh: 50 users × 30 days × 2 batches = **3,000 read calls**
- Inspiration search: 50 users × 10 searches/mo = **500 read calls**
- Post publishing: 50 users × 20 posts/mo = **1,000 write calls**
- **Total reads: ~6,900/mo** | **Total writes: ~1,000/mo**

### Tier Viability at 50 Users

| Tier | Reads | Writes | Verdict |
|------|-------|--------|---------|
| Basic ($200/mo) | 10k limit vs 6.9k need | 1,667 limit vs 1k need | **Tight but works** |
| Pro ($5,000/mo) | 1M limit vs 6.9k need | 300k limit vs 1k need | Massive overkill |

### Critical Notes

1. **organic_metrics** (impressions, link clicks, profile clicks) requires Pro
   tier. The code gracefully falls back to `public_metrics` — impression_count is
   also available there for the user's own tweets with Basic tier.

2. **Cron jobs are the biggest read consumer** (6,000 of 6,900 reads). Options:
   - Reduce analytics-sync frequency (daily → every 3 days)
   - Reduce metrics-refresh batch size (200 → 50 posts)
   - Rely on Chrome extension + CSV uploads for analytics (no X API cost)

3. **CSV uploads and Chrome extension bypass X API entirely** — this is already
   the "free tier" strategy the user mentioned. Push users toward these to
   reduce API consumption.

**Recommendation:** Start on Basic ($200/mo). Reduce cron frequency. If 50
users overwhelm the 10k read limit, upgrade to Pro.

---

## 3. Infrastructure Costs

| Service | Tier | Monthly Cost | Notes |
|---------|------|-------------|-------|
| Supabase | Free→Pro | $0–25 | Free handles 50 users easily (<100MB data) |
| Vercel | Hobby→Pro | $0–20 | Free tier: 100GB bandwidth, 100 hours compute |
| Upstash QStash | Free | $0 | <100 messages/day at 50 users |
| Upstash Redis | Free | $0 | Rate limiting: <10k commands/day |
| **Subtotal** | | **$0–45/mo** | |

---

## 4. Total Monthly Cost Summary

### At 50 Users (Target)

| Category | Monthly Cost |
|----------|-------------|
| X API (Basic) | $200 |
| AI (OpenAI gpt-4o-mini) | $2–5 |
| Supabase | $0–25 |
| Vercel | $0–20 |
| QStash + Redis | $0 |
| **Total** | **$202–250/mo** |

### Per-User Cost Breakdown

| Category | Per User/Month |
|----------|---------------|
| X API | $4.00 (fixed amortized) |
| AI calls | $0.04–0.10 |
| Infrastructure | $0–0.90 |
| **Total per user** | **~$4.10–5.00** |

---

## 5. Pricing Recommendations

### Suggested Tiers

Based on per-user cost of ~$5/mo with healthy margin:

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | $0/mo | CSV upload, 5 AI generations/day, manual posting |
| **Pro** | $19/mo | X API sync, unlimited AI generations, scheduling, analytics, patterns |
| **Business** | $39/mo | Everything in Pro + priority support, multiple X accounts (future) |

### Revenue at 50 Users

| Scenario | Monthly Revenue | Monthly Cost | Monthly Profit |
|----------|----------------|-------------|----------------|
| 50 Pro users | $950 | $250 | $700 |
| 30 Pro + 20 Free | $570 | $220 | $350 |
| 40 Pro + 10 Business | $1,150 | $250 | $900 |

### Break-Even Analysis

- Fixed costs: ~$200/mo (X API Basic)
- Variable per user: ~$0.10/mo
- Break-even at $19/mo: **11 paid users**

---

## 6. Cost Optimization Recommendations

1. **Switch all AI to gpt-4o-mini** — Change "standard" tier from gpt-4-turbo-preview
2. **Reduce cron sync frequency** — Analytics sync every 3 days instead of daily
3. **Cap AI generations for free tier** — 5/day limit prevents abuse
4. **Promote CSV/extension** — These are zero X API cost for reads
5. **Lazy metrics refresh** — Only refresh metrics when user views analytics page
6. **Monitor X API usage** — Add logging to track actual call volume before scaling

---

## 7. Implementation Priority for Stripe

Based on this analysis, the pricing structure should be:

1. Free tier: No X API access, CSV/extension only, capped AI usage
2. Pro tier ($19/mo): Full X API sync, unlimited AI, scheduling
3. Stripe checkout with monthly billing
4. Subscription gating middleware on X API features
5. Usage tracking for AI calls (for future per-use billing if needed)
