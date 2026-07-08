#!/usr/bin/env node
/**
 * Reddit signal puller for the market scan.
 *
 * Pulls public Reddit JSON (no auth) for a battery of demand/competitor queries
 * and writes raw results to reddit-signal/raw-<date>.jsonl for analysis.
 *
 * Run from repo root (or anywhere):  node research/market-scan/reddit-pull.mjs
 * Requires: Node >= 18 (global fetch). No dependencies.
 *
 * Network: needs egress to old.reddit.com (and optionally api.pullpush.io as a
 * fallback archive). In a Claude Code remote session this requires the
 * environment's network policy to allow those hosts; locally it just works.
 *
 * Etiquette: ~1 request / 1.2s, descriptive UA, search endpoints only.
 */

import { writeFileSync, mkdirSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const UA = "afx-market-research:v1.0 (one-off competitive/demand scan)";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "reddit-signal");
const SLEEP_MS = Number(
  ((process.argv.find((a) => a.startsWith("--sleep=")) ?? "").split("=")[1] || 1200),
);
const usePullpushFallback = process.argv.includes("--pullpush");
// --only=substr1,substr2 re-runs just the queries whose text matches (for
// resuming after rate-limit failures); merges into today's existing output.
const only = ((process.argv.find((a) => a.startsWith("--only=")) ?? "").split("=")[1] || "");
// --battery=pmf selects the 2026-07-08 PMF-validation battery (see
// 2026-07-pmf-validation-plan.md §3); default is the original 07-07 battery.
const battery =
  (process.argv.find((a) => a.startsWith("--battery=")) ?? "--battery=v1").split("=")[1];
// Score-sorted pullpush pulls are windowed to 2023+ so "top" doesn't mean 2015.
const AFTER_EPOCH = Math.floor(Date.parse("2023-01-01T00:00:00Z") / 1000);

/** The query battery. sub=null → sitewide search. t=year keeps it recent. */
const QUERIES = [
  // ---- demand: growth pain / algorithm opacity ----
  { q: '"grow on twitter" OR "grow on X"', sub: null },
  { q: '"X algorithm" views', sub: null },
  { q: "tweets get no views", sub: null },
  { q: '"posting into the void" twitter', sub: null },
  { q: '"build in public" twitter nobody', sub: "indiehackers" },
  { q: "what to post twitter founder", sub: "SaaS" },
  // ---- demand: AI-voice anxiety ----
  { q: '"sounds like AI" post', sub: null },
  { q: '"AI slop" twitter OR X', sub: null },
  { q: "AI writing sounds generic social media", sub: null },
  { q: "tweet sound like me AI", sub: null },
  // ---- demand: pre-publish feedback (our exact form) ----
  { q: "check tweet before posting", sub: null },
  { q: "tweet feedback tool score", sub: null },
  { q: '"grammarly for" twitter OR tweets OR X', sub: null },
  // ---- competitor discourse ----
  { q: "typefully", sub: null },
  { q: "hypefury", sub: null },
  { q: '"tweet hunter"', sub: null },
  { q: "postwise OR postowl", sub: null },
  { q: "superx twitter tool", sub: null },
  { q: "twitter growth tool recommendation", sub: null },
  // ---- account safety ----
  { q: "suspended AI replies", sub: "Twitter" },
  { q: '"reply guy" strategy', sub: null },
  { q: "twitter automation banned suspended", sub: null },
  // ---- ghostwriter / agency ----
  { q: "ghostwriting twitter clients voice", sub: null },
  { q: "ghostwriter client doesn't sound like", sub: null },
];

/**
 * Battery v2 — the 2026-07-08 PMF validation session. Zero overlap with the
 * v1 battery above; targets the writing-assistant thesis (A*), the Reply
 * Radar expansion (B*), and the general PMF sweep incl. the ghostwriter
 * gate + competitor re-checks (C*).
 */
const PMF_QUERIES = [
  // ---- H1: writing-assistant thesis ----
  { q: "grammarly tone", sub: null },
  { q: "grammarly voice", sub: null },
  { q: "grammarly worth it", sub: null },
  { q: '"writing assistant"', sub: null },
  { q: "AI edit my writing", sub: null },
  { q: "why did my tweet flop", sub: null },
  { q: "roast my tweet", sub: null },
  { q: "hemingway editor", sub: null },
  { q: "typefully editor", sub: null },
  { q: "AI detector false positive", sub: null },
  { q: "improve my tweets", sub: null },
  { q: "AI helps me write", sub: null },
  // ---- H2: Reply Radar expansion ----
  { q: "twitter alerts broken", sub: null },
  { q: "keyword alerts twitter", sub: null },
  { q: "tweetdeck alternative", sub: null },
  { q: "social listening tool affordable", sub: null },
  { q: "found customers twitter replies", sub: null },
  { q: "first customers twitter", sub: "SaaS" },
  { q: "reply early twitter", sub: null },
  { q: "twitter lists engagement", sub: null },
  { q: "auto reply bot twitter", sub: null },
  { q: "track mentions twitter", sub: null },
  { q: "twitter engagement time consuming", sub: null },
  // ---- H3: ghostwriter/agency gate ----
  { q: "client voice", sub: "freelanceWriters" },
  { q: "twitter ghostwriting", sub: "copywriting" },
  { q: "client voice", sub: "Ghostwriters" },
  { q: "client voice tone", sub: "socialmediamanagers" },
  // ---- H3: competitor re-checks + untracked ----
  { q: "postwise", sub: null },
  { q: "postowl", sub: null },
  { q: "postiz", sub: null },
  { q: "publora", sub: null },
  { q: "metricool twitter", sub: null },
  { q: "taplio", sub: null },
  // ---- H3: churn, commodity floor, WTP, migration ----
  { q: "cancelled social media tool", sub: null },
  { q: "schedule tweets free", sub: null },
  { q: "social media tools cost", sub: "agency" },
  { q: "moved to bluesky", sub: null },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function redditSearch({ q, sub }) {
  const base = sub
    ? `https://old.reddit.com/r/${sub}/search.json?restrict_sr=1&`
    : `https://old.reddit.com/search.json?`;
  const url = `${base}q=${encodeURIComponent(q)}&sort=relevance&t=year&limit=25`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`reddit ${res.status}`);
  const json = await res.json();
  return (json?.data?.children ?? []).map(({ data: d }) => ({
    source: "reddit-search",
    query: q,
    sub: d.subreddit,
    title: d.title,
    created: new Date(d.created_utc * 1000).toISOString().slice(0, 10),
    score: d.score,
    comments: d.num_comments,
    text: (d.selftext || "").slice(0, 1500),
    url: `https://reddit.com${d.permalink}`,
  }));
}

/** fetch with 429 backoff — pullpush rate-limits in bursts. */
async function fetchJson(url) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 && attempt < 4) {
      const wait = 20000 * attempt;
      console.log(`   429 — backing off ${wait / 1000}s`);
      await sleep(wait);
      continue;
    }
    if (!res.ok) throw new Error(`pullpush ${res.status}`);
    return res.json();
  }
}

async function pullpushSearch({ q, sub }, { sortType = "created_utc", after } = {}) {
  const params = new URLSearchParams({ q, size: "25", sort: "desc", sort_type: sortType });
  if (sub) params.set("subreddit", sub);
  if (after) params.set("after", String(after));
  const url = `https://api.pullpush.io/reddit/search/submission/?${params}`;
  const json = await fetchJson(url);
  return (json?.data ?? []).map((d) => ({
    source: "pullpush",
    query: q,
    sub: d.subreddit,
    title: d.title,
    created: new Date(d.created_utc * 1000).toISOString().slice(0, 10),
    score: d.score,
    comments: d.num_comments,
    text: (d.selftext || "").slice(0, 1500),
    // Every row must carry a clickable permalink; pullpush rows occasionally
    // lack `permalink`, so fall back to the canonical /comments/<id> URL.
    url: d.permalink
      ? `https://reddit.com${d.permalink}`
      : `https://reddit.com/comments/${d.id}`,
  }));
}

/** Pull top comments for a post permalink — the venting lives in comments. */
async function topComments(permalinkUrl, limit = 8) {
  const url = `${permalinkUrl.replace("https://reddit.com", "https://old.reddit.com")}.json?sort=top&limit=${limit}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.[1]?.data?.children ?? [])
    .filter((c) => c.kind === "t1")
    .map(({ data: c }) => ({ score: c.score, body: (c.body || "").slice(0, 1200) }));
}

/** Comment fallback when old.reddit.com is blocked: pullpush comment search. */
async function pullpushComments(permalinkUrl, limit = 8) {
  const m = permalinkUrl.match(/comments\/([a-z0-9]+)(?:\/|$)/);
  if (!m) return [];
  const url = `https://api.pullpush.io/reddit/search/comment/?link_id=${m[1]}&size=${limit}&sort=desc&sort_type=score`;
  const json = await fetchJson(url).catch(() => null);
  return (json?.data ?? []).map((c) => ({ score: c.score, body: (c.body || "").slice(0, 1200) }));
}

const DATE = new Date().toISOString().slice(0, 10);
const OUT_NAME = `raw-${DATE}${battery === "pmf" ? "-pmf" : ""}.jsonl`;

// Cross-run dedup: a post already captured in a previous raw-*.jsonl is
// skipped, so each battery expands the signal store instead of duplicating it.
// (Today's own output file is excluded so re-runs overwrite cleanly.)
const seen = new Set();
let dupSkipped = 0;
if (existsSync(OUT_DIR)) {
  for (const f of readdirSync(OUT_DIR).filter((f) => f.endsWith(".jsonl"))) {
    if (f === OUT_NAME) continue;
    for (const line of readFileSync(join(OUT_DIR, f), "utf8").split("\n")) {
      try {
        const r = JSON.parse(line);
        if (r.url) seen.add(r.url);
      } catch {
        /* skip malformed lines */
      }
    }
  }
  console.log(`dedup baseline: ${seen.size} urls from prior pulls\n`);
}

let activeQueries = battery === "pmf" ? PMF_QUERIES : QUERIES;
if (only) {
  const needles = only.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  activeQueries = activeQueries.filter(({ q }) =>
    needles.some((n) => q.toLowerCase().includes(n)),
  );
  console.log(`--only filter: ${activeQueries.length} queries selected\n`);
}

// Resume mode: merge into today's existing output instead of overwriting it.
const rows = [];
const outPath = join(OUT_DIR, OUT_NAME);
if (existsSync(outPath)) {
  for (const line of readFileSync(outPath, "utf8").split("\n")) {
    try {
      const r = JSON.parse(line);
      rows.push(r);
      seen.add(r.url);
    } catch {
      /* skip malformed lines */
    }
  }
  console.log(`resuming: ${rows.length} rows already in ${OUT_NAME}\n`);
}
for (const query of activeQueries) {
  try {
    let hits;
    if (usePullpushFallback) {
      // Two passes per query: top-scored since 2023 (signal-dense) + newest
      // (recency). pullpush can't sort by relevance; this is the workaround.
      const scored = await pullpushSearch(query, { sortType: "score", after: AFTER_EPOCH });
      await sleep(SLEEP_MS);
      const recent = await pullpushSearch(query, {});
      hits = [...scored, ...recent];
    } else {
      hits = await redditSearch(query);
    }
    let added = 0;
    for (const h of hits) {
      if (seen.has(h.url)) {
        dupSkipped++;
        continue;
      }
      seen.add(h.url);
      rows.push(h);
      added++;
    }
    console.log(`ok  ${query.sub ?? "all"} :: ${query.q} → ${hits.length} hits, ${added} new`);
  } catch (e) {
    console.error(`ERR ${query.sub ?? "all"} :: ${query.q} → ${e.message}`);
  }
  await sleep(SLEEP_MS);
}

// Enrich the most-discussed posts with their top comments (the gold layer).
// Skips rows already enriched on a previous (partial) run.
rows.sort((a, b) => b.comments - a.comments);
const toEnrich = rows.filter((r) => !r.top_comments?.length && r.comments > 0).slice(0, 60);
console.log(`\nenriching ${toEnrich.length} threads with top comments…`);
for (const row of toEnrich) {
  try {
    row.top_comments = await (usePullpushFallback ? pullpushComments(row.url) : topComments(row.url));
  } catch {
    /* best-effort */
  }
  await sleep(SLEEP_MS);
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(outPath, rows.map((r) => JSON.stringify(r)).join("\n"));
console.log(`\nwrote ${rows.length} unique posts → ${outPath}`);
console.log(`duplicates skipped (already in prior pulls): ${dupSkipped}`);
console.log("Commit the file and hand it back to the analysis session.");
