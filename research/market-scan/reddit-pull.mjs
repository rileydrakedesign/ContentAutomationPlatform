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

import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const UA = "afx-market-research:v1.0 (one-off competitive/demand scan)";
const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "reddit-signal");
const SLEEP_MS = 1200;
const usePullpushFallback = process.argv.includes("--pullpush");

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

async function pullpushSearch({ q }) {
  const url = `https://api.pullpush.io/reddit/search/submission/?q=${encodeURIComponent(q)}&size=25&sort=desc&sort_type=created_utc`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`pullpush ${res.status}`);
  const json = await res.json();
  return (json?.data ?? []).map((d) => ({
    source: "pullpush",
    query: q,
    sub: d.subreddit,
    title: d.title,
    created: new Date(d.created_utc * 1000).toISOString().slice(0, 10),
    score: d.score,
    comments: d.num_comments,
    text: (d.selftext || "").slice(0, 1500),
    url: `https://reddit.com${d.permalink ?? ""}`,
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
  const m = permalinkUrl.match(/comments\/([a-z0-9]+)\//);
  if (!m) return [];
  const url = `https://api.pullpush.io/reddit/search/comment/?link_id=${m[1]}&size=${limit}&sort=desc&sort_type=score`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const json = await res.json();
  return (json?.data ?? []).map((c) => ({ score: c.score, body: (c.body || "").slice(0, 1200) }));
}

const seen = new Set();
const rows = [];
for (const query of QUERIES) {
  try {
    const hits = await (usePullpushFallback ? pullpushSearch(query) : redditSearch(query));
    for (const h of hits) {
      if (seen.has(h.url)) continue;
      seen.add(h.url);
      rows.push(h);
    }
    console.log(`ok  ${query.sub ?? "all"} :: ${query.q} → ${hits.length}`);
  } catch (e) {
    console.error(`ERR ${query.sub ?? "all"} :: ${query.q} → ${e.message}`);
  }
  await sleep(SLEEP_MS);
}

// Enrich the most-discussed posts with their top comments (the gold layer).
rows.sort((a, b) => b.comments - a.comments);
for (const row of rows.slice(0, 40)) {
  try {
    row.top_comments = await (usePullpushFallback ? pullpushComments(row.url) : topComments(row.url));
  } catch {
    /* best-effort */
  }
  await sleep(SLEEP_MS);
}

mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, `raw-${new Date().toISOString().slice(0, 10)}.jsonl`);
writeFileSync(out, rows.map((r) => JSON.stringify(r)).join("\n"));
console.log(`\nwrote ${rows.length} unique posts → ${out}`);
console.log("Commit the file and hand it back to the analysis session.");
