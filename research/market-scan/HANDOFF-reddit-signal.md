# Handoff — Run the Reddit signal pull & analyze it

You're picking up a market-research task for **Agents For X** (a real-time
writing assistant for X — see the product/positioning docs under `research/`).
Reddit was unreachable in earlier sessions, so the mining pass is scripted and
waiting to be run. Your job: run it, then turn the raw data into a synthesis.

## 1. Prerequisite — network access

The script hits `old.reddit.com` (+ `api.pullpush.io` fallback) via raw
`fetch()`. These are NOT on the default "Trusted" allowlist, so the environment's
network policy must be **Custom** (with `reddit.com`, `*.reddit.com`,
`api.pullpush.io` added — keep "include default package managers" checked) or
**Full**. If `fetch` returns `000`/`ECONNREFUSED`, the policy still isn't set —
stop and tell the user; don't burn turns retrying.

Note: `WebSearch` restricted to reddit.com stays blocked regardless (Reddit
blocks Anthropic's crawler). The raw-`fetch` script is the only path.

## 2. Run it

```bash
node research/market-scan/reddit-pull.mjs
# if Reddit's own endpoints rate-limit (429/403 at the app layer), use the archive:
node research/market-scan/reddit-pull.mjs --pullpush
```

Output lands at `research/market-scan/reddit-signal/raw-<date>.jsonl` — one JSON
post per line (subreddit, title, date, score, comments, selftext, url, and
`top_comments` for the 40 most-discussed threads). Commit the `.jsonl`.

## 3. What to look for (the analysis)

The query battery already targets our hypotheses. Read the raw file and mine for
**verbatim quotes with permalinks**, then score each theme by frequency +
intensity. Specifically validate/refute these open questions from the June ICP
research (`research/icp-user-story/BRIEF.md` §12) and the July competitor scan
(`research/market-scan/2026-07-direct-competitor-scan.md`):

1. **Trigger intensity** — "shipped → crickets," "posting into the void,"
   growth plateau. How raw/frequent is the pain?
2. **AI-voice anxiety** — "sounds like AI / generic / slop"; do people *fear*
   this enough to act on it? (This is our core wedge.)
3. **Pre-publish feedback demand** — anyone wishing for a "check before I post,"
   "grammarly for tweets," or a way to tell why a post will flop?
4. **Account-safety panic** — the May 2026 AI-reply suspension wave: are people
   scared, and does it change tool choice?
5. **Reply-growth workflow** — reply-guy strategy, finding the right post fast.
6. **Competitor sentiment** — real opinions on Typefully / Hypefury / Tweet
   Hunter / PostOwl / SuperX (love, churn, complaints, price gripes).
7. **Ghostwriter voice-drift** — clients rejecting work as "not my voice."
8. **Willingness to pay** — what do people actually pay for X tools, and what do
   they refuse to pay for?

## 4. Deliverable

Write `research/market-scan/2026-07-reddit-signal.md`:
- Per theme: verdict (validated / mixed / refuted), 2–4 verbatim quotes with
  permalinks + dates, and a frequency/intensity read.
- Call out anything that **contradicts** our ICP or positioning (most valuable).
- Flag thin/absent themes honestly (Reddit gaps are real, not proof of no pain).
- End with: what this changes (if anything) for ICP, positioning, or roadmap.

Keep it tight and evidence-first. Don't overload context — read the raw file in
chunks if large. Commit the doc and the raw `.jsonl` to the working branch.
