/**
 * Pre-publish "engagement read" — the honest answer to "predict engagement
 * before I post."
 *
 * Deliberately NOT a trained per-user classifier (the research showed that
 * overfits on small, power-law tweet data and discards the most predictive
 * feature — audience size). Instead it gives an explainable read in three
 * layers, ordered by how much we trust them:
 *
 *   1. Algorithm-fit flags  — deterministic, grounded in X's documented ranker
 *      (see x-algorithm.ts): reply-driving? external link (demoted)? media /
 *      dwell-worthy? engagement-bait risk? This layer works with zero user data.
 *   2. Pattern read         — which of the user's *own* proven, content-shaping
 *      patterns the draft exhibits, and which high-lift ones it's missing.
 *   3. Resemblance score    — retrieval, not training: how close the draft is to
 *      the user's top performers vs their median, judged by one LLM call using
 *      real posts as in-context anchors.
 *
 * The output is *resemblance + algorithm fit*, never a fabricated "this will get
 * N likes." Multipliers inform the explanation ("associated with higher
 * engagement"), they don't compute a number.
 *
 * Shares the shape/role of runVoiceCheck (voice-check.ts) and is used by the
 * agentic pipeline (post-pipeline.ts) and POST /api/prepublish-read.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createChatCompletion, resolveProvider, type AIProvider } from "@/lib/ai";
import { getAnalyzablePosts } from "@/lib/analysis/posts-pool";
import { isGenerationApplicablePattern } from "@/lib/analysis/pattern-applicability";
import { containsUrl } from "@/lib/billing/credits";
import {
  buildAlgorithmNotes,
  claimNote,
  REPLY_DRIVING,
  ENGAGEMENT_BAIT,
  type AlgorithmNote,
  type AlgorithmSignal,
} from "@/lib/analysis/x-algorithm";

export interface AlgorithmFlag {
  signal: AlgorithmSignal;
  status: "good" | "caution" | "penalty";
  label: string;
  /** Why, grounded in the documented X mechanism. */
  note: string;
}

export interface MatchedPattern {
  pattern_id: string;
  pattern_name: string;
  pattern_type: string;
  multiplier: number;
  sample_count: number;
}

export interface MissingPattern {
  pattern_id: string;
  pattern_name: string;
  pattern_value: string;
  multiplier: number;
}

export interface PrepublishReadResult {
  /** 0-100: how much this resembles the user's OWN top performers. NOT a like forecast. */
  resemblance_score: number;
  confidence: "low" | "medium" | "high";
  matched_winning_patterns: MatchedPattern[];
  missing_high_lift_patterns: MissingPattern[];
  algorithm_flags: AlgorithmFlag[];
  algorithm_notes: AlgorithmNote[];
  summary: string;
}

export interface PrepublishReadOptions {
  draftType?: "X_POST" | "X_THREAD";
  hasMedia?: boolean;
  /** Reuse already-fetched patterns (e.g. from the pipeline) to skip a query. */
  patternsOverride?: ReadPattern[] | null;
}

export interface ReadPattern {
  id: string;
  pattern_type: string | null;
  pattern_name: string | null;
  pattern_value: string | null;
  multiplier: number | null;
  sample_count: number | null;
  applies_to_generation: boolean | null;
}

function matchesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * The deterministic layer: map a draft to algorithm-fit flags grounded in the
 * documented X ranker. Pure and dependency-free so it's unit-testable and works
 * with zero user data.
 */
export function computeAlgorithmFlags(
  draftText: string,
  opts: { hasMedia?: boolean; isThread?: boolean } = {}
): AlgorithmFlag[] {
  const text = draftText.toLowerCase();
  const flags: AlgorithmFlag[] = [];

  // Reply-driving — the single biggest lever (reply ≈ 27× a like).
  if (matchesAny(text, REPLY_DRIVING)) {
    flags.push({
      signal: "reply",
      status: "good",
      label: "Invites replies",
      note: claimNote("reply_over_like"),
    });
  } else {
    flags.push({
      signal: "reply",
      status: "caution",
      label: "No reply hook",
      note: "Nothing here invites a reply. A question or a clear stance is the strongest reach lever you have.",
    });
  }

  // External link — demoted, and the reason URL posts cost ~13× to publish.
  if (containsUrl(draftText)) {
    flags.push({
      signal: "external_link",
      status: "penalty",
      label: "External link in the post",
      note: claimNote("link_reach_gap"),
    });
  }

  // Native media — playback + dwell signal.
  if (opts.hasMedia) {
    flags.push({
      signal: "video_dwell",
      status: "good",
      label: "Has native media",
      note: claimNote("media_rewarded"),
    });
  }

  // Dwell-worthy length / thread — rewards the "2-min good click."
  if (opts.isThread || draftText.trim().length >= 180) {
    flags.push({
      signal: "video_dwell",
      status: "good",
      label: opts.isThread ? "Thread — built for dwell" : "Substantial read",
      note: claimNote("dwell_rewarded"),
    });
  }

  // Engagement-bait — risks negative feedback (−74 each).
  if (matchesAny(text, ENGAGEMENT_BAIT)) {
    flags.push({
      signal: "negative_feedback",
      status: "caution",
      label: "Reads as engagement-bait",
      note: claimNote("negative_feedback_costly"),
    });
  }

  return flags;
}

function pickConfidence(poolSize: number, patternCount: number): PrepublishReadResult["confidence"] {
  if (poolSize >= 50 && patternCount >= 3) return "high";
  if (poolSize >= 15) return "medium";
  return "low";
}

interface ReadJudgeResponse {
  resemblance_score?: number;
  matched_pattern_ids?: string[];
  missing_pattern_ids?: string[];
  summary?: string;
}

/**
 * Run the full pre-publish read. Best-effort persistence of the result feeds a
 * future "did green-flag drafts actually outperform baseline?" validation loop.
 */
export async function runPrepublishRead(
  supabase: SupabaseClient,
  userId: string,
  draftText: string,
  options: PrepublishReadOptions = {}
): Promise<PrepublishReadResult> {
  const isThread = options.draftType === "X_THREAD";

  // Layer 1 — deterministic algorithm-fit flags + transparency notes. These
  // need no user data, so they're always present.
  const algorithm_flags = computeAlgorithmFlags(draftText, { hasMedia: options.hasMedia, isThread });
  const algorithm_notes = buildAlgorithmNotes();

  // Gather the user's "model": their content-shaping patterns + post pool.
  const [patternsRaw, pool, voiceSettingsRes] = await Promise.all([
    options.patternsOverride
      ? Promise.resolve(options.patternsOverride)
      : fetchEnabledPatterns(supabase, userId),
    getAnalyzablePosts(supabase, userId).catch(() => []),
    supabase
      .from("user_voice_settings")
      .select("ai_model")
      .eq("user_id", userId)
      .eq("voice_type", "post")
      .maybeSingle(),
  ]);

  const patterns = (patternsRaw || []).filter(isGenerationApplicablePattern);
  const topPosts = pool.slice(0, 8);
  const confidence = pickConfidence(pool.length, patterns.length);

  // Cold-start: no posts to anchor resemblance against. Return the algorithm
  // layer only — still useful — with a neutral score and a nudge.
  if (topPosts.length === 0) {
    return {
      resemblance_score: 50,
      confidence: "low",
      matched_winning_patterns: [],
      missing_high_lift_patterns: [],
      algorithm_flags,
      algorithm_notes,
      summary:
        "No posting history yet to compare against — showing how the X algorithm treats this draft. Run a tune-up once you have analytics to unlock the resemblance read.",
    };
  }

  // Layers 2 + 3 — one LLM call: detect which proven patterns the draft hits /
  // misses, and judge resemblance to the user's winners vs their median.
  const aiProvider: AIProvider = resolveProvider(voiceSettingsRes.data?.ai_model as string | null);
  const medianPosts = pool.slice(Math.floor(pool.length / 2), Math.floor(pool.length / 2) + 4);

  const patternList = patterns
    .map((p) => `- [${p.id}] ${p.pattern_name}: ${p.pattern_value}`)
    .join("\n");

  const judgePrompt = `You are analyzing a draft X post against what already performs for THIS specific user. Use only the evidence below — do not invent engagement numbers.

=== THE USER'S TOP-PERFORMING POSTS (their proven winners) ===
${topPosts.map((p, i) => `[top ${i + 1}] ${p.text}`).join("\n\n")}

=== TYPICAL / MEDIAN POSTS (for contrast) ===
${medianPosts.length > 0 ? medianPosts.map((p, i) => `[median ${i + 1}] ${p.text}`).join("\n\n") : "(not enough posts for a median sample)"}

=== THE USER'S PROVEN PATTERNS (content-shaping; each has an id) ===
${patternList || "(no extracted patterns yet)"}

=== THE DRAFT TO READ ===
"""
${draftText}
"""

Judge how much the DRAFT resembles the user's TOP performers (structure, hook, angle, voice) versus their median — 0 = nothing like their winners, 100 = indistinguishable from their best. Be calibrated: a solid on-brand draft lands 60-85.

Return ONLY valid JSON in this exact shape:
{
  "resemblance_score": 0,
  "matched_pattern_ids": ["ids of patterns the draft clearly exhibits"],
  "missing_pattern_ids": ["ids of high-value patterns it could use but doesn't"],
  "summary": "one sentence: why it read high or low, and the single biggest lever to improve it"
}`;

  let parsed: ReadJudgeResponse = {};
  try {
    const result = await createChatCompletion({
      provider: aiProvider,
      modelTier: "fast",
      messages: [
        { role: "system", content: "You are a precise content analyst. Return valid JSON only." },
        { role: "user", content: judgePrompt },
      ],
      temperature: 0.1,
      maxTokens: 800,
      jsonResponse: false,
    });
    const jsonMatch = (result.content || "{}").match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]) as ReadJudgeResponse;
  } catch (e) {
    console.error("Pre-publish read judge failed:", e);
  }

  const resemblance_score = Math.max(0, Math.min(100, Math.round(Number(parsed.resemblance_score) || 50)));
  const byId = new Map(patterns.map((p) => [p.id, p]));

  const matchedIds = Array.isArray(parsed.matched_pattern_ids) ? parsed.matched_pattern_ids : [];
  const missingIds = Array.isArray(parsed.missing_pattern_ids) ? parsed.missing_pattern_ids : [];

  const matched_winning_patterns: MatchedPattern[] = matchedIds
    .map((id) => byId.get(String(id)))
    .filter((p): p is ReadPattern => Boolean(p))
    .map((p) => ({
      pattern_id: p.id,
      pattern_name: p.pattern_name || "",
      pattern_type: p.pattern_type || "",
      multiplier: Number(p.multiplier) || 1,
      sample_count: Number(p.sample_count) || 0,
    }));

  const missing_high_lift_patterns: MissingPattern[] = missingIds
    .map((id) => byId.get(String(id)))
    .filter((p): p is ReadPattern => Boolean(p))
    // Only surface missing patterns that actually lift engagement (multiplier > 1).
    .filter((p) => (Number(p.multiplier) || 1) > 1)
    .sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1))
    .slice(0, 3)
    .map((p) => ({
      pattern_id: p.id,
      pattern_name: p.pattern_name || "",
      pattern_value: p.pattern_value || "",
      multiplier: Number(p.multiplier) || 1,
    }));

  const summary = String(
    parsed.summary ||
      `This reads ${resemblance_score >= 70 ? "close to" : "below"} your proven winners. Check the algorithm-fit flags for the biggest levers.`
  );

  const readResult: PrepublishReadResult = {
    resemblance_score,
    confidence,
    matched_winning_patterns,
    missing_high_lift_patterns,
    algorithm_flags,
    algorithm_notes,
    summary,
  };

  // Best-effort persist (never fatal) for the future validation loop.
  const { error: persistError } = await supabase.from("prepublish_reads").insert({
    user_id: userId,
    draft_hash: createHash("sha256").update(draftText).digest("hex"),
    draft_type: options.draftType || "X_POST",
    resemblance_score: readResult.resemblance_score,
    confidence: readResult.confidence,
    algorithm_flags: readResult.algorithm_flags,
    matched_pattern_ids: matched_winning_patterns.map((p) => p.pattern_id),
  });
  if (persistError) {
    // Table may not exist yet (migration optional) — log and move on.
    console.error("Failed to persist pre-publish read:", persistError.message);
  }

  return readResult;
}

async function fetchEnabledPatterns(
  supabase: SupabaseClient,
  userId: string
): Promise<ReadPattern[]> {
  const { data } = await supabase
    .from("extracted_patterns")
    .select("id, pattern_type, pattern_name, pattern_value, multiplier, sample_count, applies_to_generation")
    .eq("user_id", userId)
    .eq("is_enabled", true)
    .order("multiplier", { ascending: false })
    .limit(20);
  return (data as ReadPattern[]) || [];
}
