/**
 * Live Read — L3 of the writing assistant (GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md §7).
 *
 * The LLM is demoted to what only it can do: explain and rewrite. It returns
 * *anchored* voice-drift findings (verbatim quotes, resolved to offsets here),
 * missing high-lift pattern chips, and a one-line summary. It does NOT own the
 * displayed scores — the cheap L2 embedding pass (vectors.ts / /api/assistant/score)
 * does. L3 may still return a voice score, used ONLY to calibrate L2.
 *
 * Cadence: rare and on-demand (panel open / low-score-idle / explicit "why?"),
 * never per-pause. Subscription-gated at the route, never metered.
 *
 *   - Read-first cache: identical drafts short-circuit on assistant_live_reads
 *     before the model is called.
 *   - Persistence is best-effort and isolated (Promise.allSettled) so a write
 *     rejection can never turn a successful read into an HTTP 500.
 *
 * Returns the AssistantFindings shape the client engine consumes (assistant/merge.ts).
 */

import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createChatCompletion, resolveProvider, type AIProvider } from "@/lib/ai";
import { getAssembledPromptForUser } from "@/lib/openai/prompts/prompt-assembler";
import { getAnalyzablePosts } from "@/lib/analysis/posts-pool";
import { isGenerationApplicablePattern } from "@/lib/analysis/pattern-applicability";
import { resolveQuote } from "@/lib/analysis/assistant/spans";
import { recordCalibrationSample } from "@/lib/analysis/assistant/vectors";
import type { Finding, SuggestionChip } from "@/lib/analysis/assistant/types";
import type { AssistantFindings } from "@/lib/analysis/assistant/merge";

interface PoolPattern {
  id: string;
  pattern_name: string | null;
  pattern_value: string | null;
  pattern_type: string | null;
  multiplier: number | null;
  sample_count: number | null;
  applies_to_generation: boolean | null;
}

interface LiveJudgeResponse {
  voice_score?: number;
  voice_deviations?: { quote?: string; issue?: string; why?: string; fix?: string; index?: number }[];
  resemblance_score?: number;
  matched_pattern_ids?: string[];
  missing_pattern_ids?: string[];
  summary?: string;
}

async function fetchEnabledPatterns(supabase: SupabaseClient, userId: string): Promise<PoolPattern[]> {
  const { data } = await supabase
    .from("extracted_patterns")
    .select("id, pattern_type, pattern_name, pattern_value, multiplier, sample_count, applies_to_generation")
    .eq("user_id", userId)
    .eq("is_enabled", true)
    .order("multiplier", { ascending: false })
    .limit(20);
  return (data as PoolPattern[]) || [];
}

export async function runLiveRead(
  supabase: SupabaseClient,
  userId: string,
  draftText: string,
  voiceType: "post" | "reply" = "post",
  options: { draftType?: "X_POST" | "X_THREAD" } = {}
): Promise<AssistantFindings> {
  const draft_hash = createHash("sha256").update(draftText).digest("hex");

  // ── Read-first cache: identical draft → skip the model entirely. ───────────
  const cached = await supabase
    .from("assistant_live_reads")
    .select("result")
    .eq("user_id", userId)
    .eq("draft_hash", draft_hash)
    .eq("voice_type", voiceType)
    .maybeSingle();
  if (cached.data?.result) {
    return cached.data.result as AssistantFindings;
  }

  const [systemPrompt, patternsRaw, pool, voiceSettingsRes] = await Promise.all([
    getAssembledPromptForUser(supabase, userId, voiceType),
    fetchEnabledPatterns(supabase, userId),
    getAnalyzablePosts(supabase, userId).catch(() => []),
    supabase
      .from("user_voice_settings")
      .select("ai_model")
      .eq("user_id", userId)
      .eq("voice_type", voiceType)
      .maybeSingle(),
  ]);

  const provider: AIProvider = resolveProvider(voiceSettingsRes.data?.ai_model as string | null);
  const patterns = patternsRaw.filter(isGenerationApplicablePattern);
  const byId = new Map(patterns.map((p) => [p.id, p]));
  const topPosts = pool.slice(0, 6);
  const medianPosts = pool.slice(Math.floor(pool.length / 2), Math.floor(pool.length / 2) + 3);
  const patternList = patterns.map((p) => `- [${p.id}] ${p.pattern_name}: ${p.pattern_value}`).join("\n");

  const judgePrompt = `You are a precise writing coach for THIS specific user. You are given their full voice specification and their proven top posts. Explain how ONE draft drifts from their voice and which proven patterns it's missing — the live score is computed separately, so focus on grounded, actionable findings.

=== VOICE SPECIFICATION (their style, controls, guardrails, examples) ===
${systemPrompt}
=== END VOICE SPECIFICATION ===

=== THE USER'S TOP-PERFORMING POSTS (proven winners) ===
${topPosts.length ? topPosts.map((p, i) => `[top ${i + 1}] ${p.text}`).join("\n\n") : "(no posting history yet)"}

=== TYPICAL / MEDIAN POSTS (for contrast) ===
${medianPosts.length ? medianPosts.map((p, i) => `[median ${i + 1}] ${p.text}`).join("\n\n") : "(not enough posts)"}

=== THE USER'S PROVEN PATTERNS (content-shaping; each has an id) ===
${patternList || "(no extracted patterns yet)"}

=== THE DRAFT ===
"""
${draftText}
"""

Do this:
1) VOICE DRIFTS: list up to 4 specific drifts. For each, copy the EXACT substring of the draft it refers to as "quote" (verbatim, so it can be located — do not paraphrase), the approximate 0-based character "index" where that quote starts in the draft (so a repeated phrase anchors to the right occurrence), a short "issue", a grounded "why", and an optional "fix" that rewrites just that span.
2) PATTERNS: list which proven pattern ids the draft clearly exhibits and which high-value ones it's missing.
3) Also return a calibration-only "voice_score" (0-100, how well it matches their voice) and a "resemblance_score" (0-100 vs their winners) — these tune the live score, they are not shown directly.

Return ONLY valid JSON in this exact shape:
{
  "voice_score": 0,
  "voice_deviations": [{"quote": "exact substring", "index": 0, "issue": "what drifts", "why": "grounded reason", "fix": "rewrite of just that span"}],
  "resemblance_score": 0,
  "matched_pattern_ids": ["ids the draft exhibits"],
  "missing_pattern_ids": ["high-value ids it's missing"],
  "summary": "one sentence: the single biggest lever"
}`;

  let parsed: LiveJudgeResponse = {};
  try {
    const result = await createChatCompletion({
      provider,
      modelTier: "fast",
      messages: [
        { role: "system", content: "You are an expert writing coach. Return valid JSON only." },
        { role: "user", content: judgePrompt },
      ],
      temperature: 0.2,
      maxTokens: 1100,
      jsonResponse: false,
    });
    const m = (result.content || "{}").match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]) as LiveJudgeResponse;
  } catch (e) {
    console.error("Live read judge failed:", e);
  }

  const voice_score = clamp(Number(parsed.voice_score), 70);
  const resemblance_score = clamp(Number(parsed.resemblance_score), 50);

  // Map deviations → anchored voice findings. Resolve the verbatim quote to
  // offsets here, biased by the model's approximate `index` so a repeated phrase
  // anchors to the intended occurrence; an unfound quote keeps the card but loses
  // the underline.
  const voice_findings: Finding[] = (parsed.voice_deviations || [])
    .slice(0, 4)
    .map((d, i): Finding | null => {
      const quote = String(d.quote || "").trim();
      const title = String(d.issue || "Drifts from your voice");
      const why = String(d.why || "This doesn't match how you usually write.");
      const fix = d.fix ? String(d.fix) : undefined;
      const hint = typeof d.index === "number" && Number.isFinite(d.index) ? d.index : undefined;
      const base: Finding = {
        id: `voice:${i}`,
        class: "voice",
        severity: "warning",
        title,
        why,
        replacement: fix,
        source: "live",
        signal: "voice_drift",
      };
      if (quote) {
        const at = resolveQuote(draftText, quote, hint);
        if (at) base.span = { quote, start: at.start, end: at.end };
      }
      return base;
    })
    .filter((f): f is Finding => f !== null);

  // Missing high-lift patterns → suggestion chips (multiplier > 1 only).
  const missing_pattern_chips: SuggestionChip[] = (parsed.missing_pattern_ids || [])
    .map((id) => byId.get(String(id)))
    .filter((p): p is PoolPattern => Boolean(p) && (Number(p!.multiplier) || 1) > 1)
    .sort((a, b) => (Number(b.multiplier) || 1) - (Number(a.multiplier) || 1))
    .slice(0, 3)
    .map((p) => ({
      id: `pat:${p.id}`,
      kind: "missing_pattern" as const,
      label: p.pattern_name || "Add a proven pattern",
      detail: `≈${(Number(p.multiplier) || 1).toFixed(1)}× — ${p.pattern_value || ""}`.trim(),
      multiplier: Number(p.multiplier) || 1,
    }));

  const summary = String(parsed.summary || "");

  const findingsResult: AssistantFindings = {
    voice_findings,
    missing_pattern_chips,
    summary,
    voice_score,
  };

  // Best-effort persistence — fully isolated so a write rejection can never turn
  // this successful read into a 500 (Promise.allSettled, never a bare Promise.all).
  const matchedIds = (parsed.matched_pattern_ids || []).map(String).filter((id) => byId.has(id));
  await Promise.allSettled([
    supabase
      .from("assistant_live_reads")
      .upsert(
        { user_id: userId, draft_hash, voice_type: voiceType, result: findingsResult },
        { onConflict: "user_id,draft_hash,voice_type" }
      )
      .then(({ error }) => error && console.error("live-read cache persist:", error.message)),
    supabase
      .from("voice_check_results")
      .insert({
        user_id: userId,
        draft_hash,
        voice_type: voiceType,
        score: voice_score,
        matches: [],
        deviations: voice_findings.map((f) => f.title),
        suggested_edit: null,
      })
      .then(({ error }) => error && console.error("live-read voice persist:", error.message)),
    supabase
      .from("prepublish_reads")
      .insert({
        user_id: userId,
        draft_hash,
        draft_type: options.draftType || "X_POST",
        resemblance_score,
        confidence: pool.length >= 50 ? "high" : pool.length >= 15 ? "medium" : "low",
        algorithm_flags: [],
        matched_pattern_ids: matchedIds,
      })
      .then(({ error }) => error && console.error("live-read read persist:", error.message)),
  ]);

  // Feed the L2 calibration loop with this (draft, LLM voice score) pair. Runs its
  // own embedding; fire-and-forget so it never slows the read.
  void recordCalibrationSample(supabase, userId, draftText, voice_score);

  return findingsResult;
}

function clamp(n: number, fallback: number): number {
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}
