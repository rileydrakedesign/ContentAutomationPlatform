/**
 * Text embeddings — the engine behind the writing assistant's L2 voice/performance
 * scores (GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md §6).
 *
 * "Does this sound like me / like my winners?" is a SIMILARITY question. Embeddings
 * answer it ~100–1000× cheaper and in ~10–50ms vs an LLM judgment, which is what
 * lets the always-on loop be unmetered. The LLM (L3) only explains and rewrites.
 *
 * Separate concern from chat generation: CLAUDE_ONLY (src/lib/ai/index.ts) governs
 * chat only — embeddings have their own provider (OpenAI) and must NOT be routed
 * through the Claude path.
 */

import { createHash } from "node:crypto";
import { getOpenAI } from "./providers/openai";
import { getRedisClient } from "@/lib/redis";

/** OpenAI text-embedding-3-small: 1536-d, ~$0.02/1M tokens, fast. */
export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIMS = 1536;

/** Assistant traffic is heavily repetitive (the L2 score and the L3 calibration
 *  sample embed the SAME draft moments apart; re-opened drafts re-score the same
 *  text) — cache single-draft vectors briefly so we embed each text once. */
const EMBED_CACHE_TTL_S = 6 * 60 * 60;

/**
 * Embed a batch of texts → one vector per input (order preserved). Vectors are
 * returned raw (not normalized); callers that compare with cosine should
 * normalize once (see vectors.ts). Empty/whitespace inputs are embedded as-is by
 * the API; callers should filter trivial text first.
 */
export async function embedText(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const res = await getOpenAI().embeddings.create({
    model: EMBED_MODEL,
    input: texts,
  });
  // The API guarantees data is returned in input order, but sort by index to be safe.
  return res.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding as number[]);
}

/**
 * Embed a single text through a short-TTL Redis cache keyed by content hash.
 * Best-effort on both sides: a Redis outage falls straight through to the API,
 * and a failed cache write never fails the call. Use for the per-draft hot path
 * (L2 score, L3 calibration); corpus rebuilds should keep using embedText.
 */
export async function embedOneCached(text: string): Promise<number[]> {
  const redis = getRedisClient();
  const key = `emb:${EMBED_MODEL}:${createHash("sha256").update(text).digest("hex")}`;
  if (redis) {
    try {
      const hit = await redis.get<number[]>(key);
      if (Array.isArray(hit) && hit.length === EMBED_DIMS) return hit;
    } catch {
      /* cache read is best-effort */
    }
  }
  const [vec] = await embedText([text]);
  if (redis && Array.isArray(vec) && vec.length === EMBED_DIMS) {
    try {
      await redis.set(key, vec, { ex: EMBED_CACHE_TTL_S });
    } catch {
      /* cache write is best-effort */
    }
  }
  return vec;
}
