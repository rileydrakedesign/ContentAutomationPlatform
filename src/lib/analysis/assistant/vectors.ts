/**
 * L2 voice/performance vectors — the cheap, unmetered scoring engine that replaces
 * the per-pause LLM call (GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md §6).
 *
 * SERVER-ONLY (imports supabase + the embeddings provider). It lives in the
 * assistant/ dir for cohesion but is intentionally NOT re-exported from index.ts,
 * so the pure client engine — and the extension bundle built from it — never pulls
 * it in. Keep it out of any module the engine barrel exports.
 *
 *   refreshVoiceVectors  — (re)build the per-user voice + winners centroids.
 *   scoreDraft           — embed one draft, cosine vs centroids → 0-100 scores.
 *   recordCalibrationSample — fold an (cosine, LLM-score) pair into the per-user
 *                          cosine→score fit so the cheap number tracks the LLM.
 *
 * The pure math (cosine/normalize/centroid/calibration map) is exported for unit
 * tests and is dependency-free.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { embedText, EMBED_MODEL } from "@/lib/ai/embeddings";
import { getAnalyzablePosts } from "@/lib/analysis/posts-pool";

// ── Pure vector math (unit-tested) ──────────────────────────────────────────

/** Cosine similarity of two equal-length vectors. 0 for degenerate inputs. */
export function cosine(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/** L2-normalize a vector (unit length). Returns a copy; zero vector unchanged. */
export function normalize(v: number[]): number[] {
  let norm = 0;
  for (const x of v) norm += x * x;
  norm = Math.sqrt(norm);
  if (norm === 0) return v.slice();
  return v.map((x) => x / norm);
}

/** Average a list of equal-length vectors, then L2-normalize. [] for empty input. */
export function centroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dims = vectors[0].length;
  const sum = new Array(dims).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dims; i++) sum[i] += v[i];
  }
  for (let i = 0; i < dims; i++) sum[i] /= vectors.length;
  return normalize(sum);
}

// ── Calibration: cosine → 0-100, per user ───────────────────────────────────

/** Online least-squares accumulators for the cosine→LLM-score fit. */
export interface Calibration {
  n: number;
  sx: number; // Σ cosine
  sy: number; // Σ llm_score
  sxx: number; // Σ cosine²
  sxy: number; // Σ cosine·llm_score
}

// Default affine map when a user has too few calibration pairs: a typical
// on-voice cosine sits ~0.55–0.85, mapped to ~40–95.
const DEF_LO_COS = 0.55;
const DEF_HI_COS = 0.85;
const DEF_LO_SCORE = 40;
const DEF_HI_SCORE = 95;
const MIN_CALIBRATION_PAIRS = 8;

function clamp01to100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Map a raw cosine to a 0-100 score. Uses the per-user linear fit once there are
 * enough (cosine, LLM-score) pairs; otherwise the default affine map.
 */
export function mapCosineToScore(cos: number, calib?: Calibration | null): number {
  if (calib && calib.n >= MIN_CALIBRATION_PAIRS) {
    const denom = calib.n * calib.sxx - calib.sx * calib.sx;
    if (Math.abs(denom) > 1e-9) {
      const slope = (calib.n * calib.sxy - calib.sx * calib.sy) / denom;
      const intercept = (calib.sy - slope * calib.sx) / calib.n;
      return clamp01to100(slope * cos + intercept);
    }
  }
  const t = (cos - DEF_LO_COS) / (DEF_HI_COS - DEF_LO_COS);
  return clamp01to100(DEF_LO_SCORE + t * (DEF_HI_SCORE - DEF_LO_SCORE));
}

/** Fold one (cosine, llm_score) pair into the accumulators, with light forgetting. */
export function accumulateCalibration(
  prev: Calibration | null | undefined,
  cos: number,
  llmScore: number
): Calibration {
  let c: Calibration = prev
    ? { ...prev }
    : { n: 0, sx: 0, sy: 0, sxx: 0, sxy: 0 };
  // Exponential forgetting so a slowly-drifting voice isn't anchored forever.
  if (c.n >= 200) {
    c = { n: c.n * 0.5, sx: c.sx * 0.5, sy: c.sy * 0.5, sxx: c.sxx * 0.5, sxy: c.sxy * 0.5 };
  }
  return {
    n: c.n + 1,
    sx: c.sx + cos,
    sy: c.sy + llmScore,
    sxx: c.sxx + cos * cos,
    sxy: c.sxy + cos * llmScore,
  };
}

// ── DB shape ────────────────────────────────────────────────────────────────

interface VectorRow {
  voice_centroid: number[];
  winners_centroid: number[];
  dims: number;
  model: string | null;
  sample_count: number;
  winners_count: number;
  calibration: Calibration | null;
}

async function loadVectorRow(
  supabase: SupabaseClient,
  userId: string
): Promise<VectorRow | null> {
  const { data } = await supabase
    .from("user_assistant_vectors")
    .select("voice_centroid, winners_centroid, dims, model, sample_count, winners_count, calibration")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  const voice = Array.isArray(data.voice_centroid) ? (data.voice_centroid as number[]) : [];
  const winners = Array.isArray(data.winners_centroid) ? (data.winners_centroid as number[]) : [];
  return {
    voice_centroid: voice,
    winners_centroid: winners,
    dims: Number(data.dims) || voice.length,
    model: (data.model as string | null) ?? null,
    sample_count: Number(data.sample_count) || 0,
    winners_count: Number(data.winners_count) || 0,
    calibration: (data.calibration as Calibration | null) ?? null,
  };
}

// ── Refresh: (re)build centroids ────────────────────────────────────────────

const MAX_VOICE_CORPUS = 40;
const MAX_WINNERS = 20;
const MIN_TEXT_LEN = 12;

export interface RefreshResult {
  sample_count: number;
  winners_count: number;
}

/**
 * Rebuild the user's voice + winners centroids from their corpus and embed them.
 * Voice corpus = their voice examples ∪ their analyzable posts; winners = the
 * top-N analyzable posts by weighted engagement. Preserves any existing
 * calibration. Best-effort: returns zero counts if there's nothing to embed.
 */
export async function refreshVoiceVectors(
  supabase: SupabaseClient,
  userId: string
): Promise<RefreshResult> {
  const [pool, examplesRes, existing] = await Promise.all([
    getAnalyzablePosts(supabase, userId).catch(() => []),
    supabase
      .from("user_voice_examples")
      .select("content_text")
      .eq("user_id", userId)
      .eq("content_type", "post")
      .eq("is_excluded", false)
      .limit(50),
    loadVectorRow(supabase, userId),
  ]);

  const exampleTexts = (examplesRes.data || [])
    .map((e) => String((e as { content_text?: string }).content_text || "").trim())
    .filter((t) => t.length >= MIN_TEXT_LEN);

  // Voice corpus: examples first (curated), then top posts, deduped.
  const seen = new Set<string>();
  const voiceTexts: string[] = [];
  for (const t of [...exampleTexts, ...pool.map((p) => p.text)]) {
    const key = t.trim();
    if (key.length < MIN_TEXT_LEN || seen.has(key)) continue;
    seen.add(key);
    voiceTexts.push(key);
    if (voiceTexts.length >= MAX_VOICE_CORPUS) break;
  }

  const winnerTexts = pool
    .slice(0, MAX_WINNERS)
    .map((p) => p.text.trim())
    .filter((t) => t.length >= MIN_TEXT_LEN);

  if (voiceTexts.length === 0) {
    return { sample_count: 0, winners_count: 0 };
  }

  const voiceVecs = await embedText(voiceTexts);
  // Winners reuse the voice embeddings where they overlap; embed the rest.
  const winnerVecs = winnerTexts.length ? await embedText(winnerTexts) : voiceVecs;

  const voice_centroid = centroid(voiceVecs);
  const winners_centroid = winnerVecs.length ? centroid(winnerVecs) : voice_centroid;
  const dims = voice_centroid.length;

  const { error } = await supabase.from("user_assistant_vectors").upsert(
    {
      user_id: userId,
      voice_centroid,
      winners_centroid,
      dims,
      model: EMBED_MODEL,
      sample_count: voiceTexts.length,
      winners_count: winnerTexts.length,
      // Preserve calibration across refreshes (centroids move slowly).
      calibration: existing?.calibration ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  if (error) console.error("refreshVoiceVectors upsert:", error.message);

  return { sample_count: voiceTexts.length, winners_count: winnerTexts.length };
}

// ── Score: the per-pause call ───────────────────────────────────────────────

export interface ScoreResult {
  voice_score: number;
  resemblance_score: number;
  /** No usable centroid yet — scores are neutral placeholders; trigger a refresh. */
  cold_start: boolean;
}

const NEUTRAL_VOICE = 70;
const NEUTRAL_RESEMBLANCE = 50;

/**
 * Embed one draft and score it against the cached centroids. Cheap and unmetered.
 * On cold start (no centroid yet) returns neutral scores and flags it so the
 * caller can kick a background refresh.
 */
export async function scoreDraft(
  supabase: SupabaseClient,
  userId: string,
  text: string
): Promise<ScoreResult> {
  const row = await loadVectorRow(supabase, userId);
  if (!row || row.voice_centroid.length === 0) {
    return { voice_score: NEUTRAL_VOICE, resemblance_score: NEUTRAL_RESEMBLANCE, cold_start: true };
  }

  const [vec] = await embedText([text]);
  const draftVec = normalize(vec);

  const voiceCos = cosine(draftVec, row.voice_centroid);
  const winnersCos = row.winners_centroid.length
    ? cosine(draftVec, row.winners_centroid)
    : voiceCos;

  return {
    voice_score: mapCosineToScore(voiceCos, row.calibration),
    resemblance_score: mapCosineToScore(winnersCos, row.calibration),
    cold_start: false,
  };
}

/**
 * Fold an (draft, LLM voice score) pair into the per-user calibration so the
 * cheap L2 number tracks the (rarer) L3 judgment. Best-effort: embeds the draft,
 * computes its cosine to the voice centroid now, and updates the accumulators.
 * No-op if there's no centroid to anchor against.
 */
export async function recordCalibrationSample(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  llmVoiceScore: number
): Promise<void> {
  try {
    const row = await loadVectorRow(supabase, userId);
    if (!row || row.voice_centroid.length === 0) return;
    const [vec] = await embedText([text]);
    const cos = cosine(normalize(vec), row.voice_centroid);
    const next = accumulateCalibration(row.calibration, cos, llmVoiceScore);
    const { error } = await supabase
      .from("user_assistant_vectors")
      .update({ calibration: next, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) console.error("recordCalibrationSample update:", error.message);
  } catch (e) {
    console.error("recordCalibrationSample failed:", e);
  }
}
