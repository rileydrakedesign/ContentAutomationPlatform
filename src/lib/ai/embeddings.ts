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

import { getOpenAI } from "./providers/openai";

/** OpenAI text-embedding-3-small: 1536-d, ~$0.02/1M tokens, fast. */
export const EMBED_MODEL = "text-embedding-3-small";
export const EMBED_DIMS = 1536;

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
