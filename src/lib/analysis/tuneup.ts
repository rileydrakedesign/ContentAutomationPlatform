/**
 * Voice Tune-Up — the one-click analyze loop, shared by the web app
 * (POST /api/insights/tuneup) and the agent surface
 * (POST /api/v1/insights/tuneup, the run_tuneup MCP tool).
 *
 * Runs refresh → pattern extract → niche analyze sequentially over the
 * canonical post pool, then assembles the Voice Report: niche + positioning,
 * top patterns, top posts, cadence vs strategy, recurring voice-check
 * deviations (with concrete settings suggestions), feedback themes,
 * inspiration alignment, and context freshness.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { refreshVoiceExamples } from "./voice-refresh";
import { extractPatternsForUser } from "./pattern-extract";
import { analyzeNicheForUser } from "./niche-analyze";
import { getAnalyzablePosts } from "./posts-pool";
import { getContextFreshness, type ContextFreshness } from "./freshness";
import type { NicheProfile } from "@/types/niche";

export interface DeviationSuggestion {
  category: string;
  occurrences: number;
  suggestion: string;
}

export interface VoiceTuneupReport {
  niche_summary: string | null;
  positioning: unknown;
  content_pillars: string[];
  top_patterns: unknown[];
  top_posts: Array<{ text: string; engagement_score: number; impressions: number }>;
  cadence: {
    posts_last_28_days: number;
    avg_posts_per_week: number;
    target_posts_per_week: number | null;
    pillar_targets: unknown[];
  };
  recurring_deviations: DeviationSuggestion[];
  feedback_themes: {
    likes: number;
    dislikes: number;
    recent_disliked: string[];
    recent_liked: string[];
  };
  inspiration_alignment: {
    total: number;
    aligned: number;
    note: string;
  };
  context_freshness: ContextFreshness;
  steps: {
    examples_updated: number;
    patterns_extracted: number;
    pattern_extraction_skipped: string | null;
    posts_analyzed: number;
  };
}

export type VoiceTuneupResult =
  | { ok: true; report: VoiceTuneupReport }
  | { ok: false; status: 422 | 500; error: string };

// Recurring-deviation buckets → concrete, user-actionable settings changes.
// Deviations are model free-text; keyword buckets are deliberately coarse.
const DEVIATION_BUCKETS: Array<{ category: string; keywords: string[]; suggestion: string }> = [
  {
    category: "length",
    keywords: ["too long", "length", "shorter", "wordy", "verbose", "rambl"],
    suggestion:
      'Checks repeatedly flag length — consider setting the LENGTH control to "short" on the voice page.',
  },
  {
    category: "formality",
    keywords: ["formal", "stiff", "corporate", "buttoned"],
    suggestion:
      "Drafts keep reading more formal than your voice — nudge the tone dial toward casual.",
  },
  {
    category: "hype",
    keywords: ["hype", "salesy", "promotional", "marketing", "exagger", "clickbait"],
    suggestion:
      "Drafts keep drifting into marketing hype — lower the optimization dial toward authenticity or add a guardrail.",
  },
  {
    category: "hedging",
    keywords: ["hedg", "qualifier", "tentative", "wishy", "noncommittal"],
    suggestion:
      'Drafts keep hedging — set the DIRECTNESS control to "blunt" or raise the stance dial.',
  },
  {
    category: "energy",
    keywords: ["flat", "punchy", "energy", "monotone", "dull"],
    suggestion:
      "Drafts keep missing your energy — adjust the energy dial (calm ↔ punchy) to match your examples.",
  },
  {
    category: "emoji_hashtag",
    keywords: ["emoji", "hashtag"],
    suggestion:
      "Emoji/hashtag usage keeps deviating from your voice — check the EMOJIS control and your guardrails.",
  },
];

function categorizeDeviations(deviationTexts: string[]): DeviationSuggestion[] {
  const counts = new Map<string, number>();
  for (const text of deviationTexts) {
    const lower = text.toLowerCase();
    for (const bucket of DEVIATION_BUCKETS) {
      if (bucket.keywords.some((k) => lower.includes(k))) {
        counts.set(bucket.category, (counts.get(bucket.category) || 0) + 1);
        break; // one bucket per deviation line
      }
    }
  }

  const suggestions: DeviationSuggestion[] = [];
  for (const bucket of DEVIATION_BUCKETS) {
    const occurrences = counts.get(bucket.category) || 0;
    if (occurrences >= 3) {
      suggestions.push({
        category: bucket.category,
        occurrences,
        suggestion: bucket.suggestion,
      });
    }
  }
  return suggestions.sort((a, b) => b.occurrences - a.occurrences);
}

export async function runVoiceTuneup(
  supabase: SupabaseClient,
  userId: string,
  opts: { allowPatternExtraction: boolean; patternGateMessage?: string }
): Promise<VoiceTuneupResult> {
  // ── 1. Refresh voice examples (canonical pool, weighted engagement) ──
  const refresh = await refreshVoiceExamples(supabase, userId);

  // ── 2. Extract patterns (Pro feature — skipped, not fatal, when gated) ──
  let patternsExtracted = 0;
  let patternExtractionSkipped: string | null = null;
  if (!opts.allowPatternExtraction) {
    patternExtractionSkipped =
      opts.patternGateMessage ?? "Pattern extraction requires a Pro plan.";
  } else {
    const extract = await extractPatternsForUser(supabase, userId);
    if (extract.ok) {
      patternsExtracted = extract.patterns.length;
    } else {
      patternExtractionSkipped = extract.error;
    }
  }

  // ── 3. Analyze niche (includes positioning) ────────────────
  const niche = await analyzeNicheForUser(supabase, userId);
  if (!niche.ok) {
    return { ok: false, status: niche.status, error: niche.error };
  }

  // ── 4. Assemble the Voice Report from the now-updated stored state ──
  // The assembly reads only persisted tables, so the exact same builder backs
  // the free, read-only GET /api/insights/report (view the latest report
  // without re-running the 5-credit tune-up).
  const report = await assembleVoiceReportFromStoredState(supabase, userId, {
    examples_updated: refresh.examples_updated,
    patterns_extracted: patternsExtracted,
    pattern_extraction_skipped: patternExtractionSkipped,
    posts_analyzed: niche.posts_analyzed,
  });

  return { ok: true, report };
}

/**
 * Assemble the Voice Report purely from already-stored state (niche profile,
 * enabled patterns w/ provenance, top posts from the canonical pool, cadence vs
 * strategy, recurring voice-check deviations, feedback themes, inspiration
 * alignment, freshness). No model calls, no writes — this is the read half that
 * both runVoiceTuneup (after it writes) and the free GET endpoint share, so the
 * persisted report never drifts from the live tables.
 */
export async function assembleVoiceReportFromStoredState(
  supabase: SupabaseClient,
  userId: string,
  steps: VoiceTuneupReport["steps"]
): Promise<VoiceTuneupReport> {
  const [
    { data: nicheProfileRow },
    { data: topPatterns },
    { data: strategy },
    pool,
    { data: checkRows },
    { data: feedbackRows },
    { data: inspirationRows },
    freshness,
  ] = await Promise.all([
    supabase
      .from("user_niche_profile")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("extracted_patterns")
      // Include applies_to_generation so the Voice Report can label
      // timing/post-type/visual patterns as insight-only (shown, not applied
      // to generation). The report deliberately does NOT filter these out.
      .select("id, pattern_type, pattern_name, pattern_value, multiplier, sample_count, source_post_examples, applies_to_generation")
      .eq("user_id", userId)
      .eq("is_enabled", true)
      .order("multiplier", { ascending: false })
      .limit(5),
    supabase
      .from("content_strategy")
      .select("posts_per_week, threads_per_week, replies_per_week, pillar_targets")
      .eq("user_id", userId)
      .maybeSingle(),
    getAnalyzablePosts(supabase, userId),
    supabase
      .from("voice_check_results")
      .select("deviations")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("generation_feedback")
      .select("content_text, feedback_type")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("inspiration_posts")
      .select("raw_content")
      .eq("user_id", userId)
      .limit(100),
    getContextFreshness(supabase, userId),
  ]);

  const profile = (nicheProfileRow as NicheProfile | null) ?? null;

  // Top posts + posting cadence from the canonical pool
  const topPosts = pool.slice(0, 5).map((p) => ({
    text: p.text,
    engagement_score: Math.round(p.engagement_score),
    impressions: p.metrics.impressions,
  }));

  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const postsLast28 = pool.filter((p) => {
    const t = new Date(p.posted_at).getTime();
    return Number.isFinite(t) && t >= cutoff;
  }).length;
  const avgPostsPerWeek = Math.round((postsLast28 / 4) * 10) / 10;

  // Recurring voice-check deviations → settings suggestions (closed loop)
  const deviationTexts: string[] = [];
  for (const row of checkRows ?? []) {
    if (Array.isArray(row.deviations)) {
      for (const d of row.deviations) deviationTexts.push(String(d));
    }
  }
  const recurringDeviations = categorizeDeviations(deviationTexts);

  // Feedback themes (closed loop for generation_feedback)
  const likes = (feedbackRows ?? []).filter((f) => f.feedback_type === "like");
  const dislikes = (feedbackRows ?? []).filter((f) => f.feedback_type === "dislike");
  const snippet = (s: string) => (s.length > 120 ? `${s.slice(0, 117)}...` : s);

  // Inspiration alignment vs the stored niche (closed loop for the Library)
  const pillars = (profile?.content_pillars ?? []).map((p) => p.toLowerCase());
  const clusterKeywords = (profile?.topic_clusters ?? [])
    .flatMap((c) => c.keywords ?? [])
    .map((k) => k.toLowerCase())
    .filter((k) => k.length >= 4);
  const alignmentTerms = [...new Set([...pillars, ...clusterKeywords])];

  const inspirationTexts = (inspirationRows ?? [])
    .map((r) => String(r.raw_content || "").toLowerCase())
    .filter(Boolean);
  const alignedCount = inspirationTexts.filter((text) =>
    alignmentTerms.some((term) => text.includes(term))
  ).length;

  const inspirationNote =
    inspirationTexts.length === 0
      ? "No saved inspiration yet — save posts you admire and they'll be compared against your niche here."
      : `${alignedCount} of ${inspirationTexts.length} saved inspiration posts align with your niche pillars${
          alignedCount < inspirationTexts.length / 2
            ? " — much of your inspiration is outside your niche; consider saving more on-pillar posts or expanding your pillars."
            : "."
        }`;

  return {
    niche_summary: profile?.niche_summary ?? null,
    positioning: profile?.positioning ?? null,
    content_pillars: profile?.content_pillars ?? [],
    top_patterns: topPatterns ?? [],
    top_posts: topPosts,
    cadence: {
      posts_last_28_days: postsLast28,
      avg_posts_per_week: avgPostsPerWeek,
      target_posts_per_week: strategy?.posts_per_week ?? null,
      pillar_targets: strategy?.pillar_targets ?? [],
    },
    recurring_deviations: recurringDeviations,
    feedback_themes: {
      likes: likes.length,
      dislikes: dislikes.length,
      recent_disliked: dislikes.slice(0, 3).map((f) => snippet(String(f.content_text || ""))),
      recent_liked: likes.slice(0, 3).map((f) => snippet(String(f.content_text || ""))),
    },
    inspiration_alignment: {
      total: inspirationTexts.length,
      aligned: alignedCount,
      note: inspirationNote,
    },
    context_freshness: freshness,
    steps,
  };
}

/**
 * Whether enough analyzed state exists to show a Voice Report without running a
 * tune-up. Used by the read-only GET to decide between returning a report and
 * telling the client to run the first tune-up.
 */
export async function hasStoredVoiceReport(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const [{ data: niche }, { count: patternCount }] = await Promise.all([
    supabase
      .from("user_niche_profile")
      .select("niche_summary")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("extracted_patterns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_enabled", true),
  ]);
  return Boolean(niche?.niche_summary) || (patternCount ?? 0) > 0;
}

/**
 * Compute the "steps" summary for a read-only report from stored counts (the
 * GET path has no run-time step values — derive plausible ones from state).
 */
export async function deriveReportSteps(
  supabase: SupabaseClient,
  userId: string
): Promise<VoiceTuneupReport["steps"]> {
  const [{ count: exampleCount }, { count: patternCount }, { data: niche }] = await Promise.all([
    supabase
      .from("user_voice_examples")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_excluded", false),
    supabase
      .from("extracted_patterns")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_enabled", true),
    supabase
      .from("user_niche_profile")
      .select("total_posts_analyzed")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  return {
    examples_updated: exampleCount ?? 0,
    patterns_extracted: patternCount ?? 0,
    pattern_extraction_skipped: null,
    posts_analyzed: niche?.total_posts_analyzed ?? 0,
  };
}
