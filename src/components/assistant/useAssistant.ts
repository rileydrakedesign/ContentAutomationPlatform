"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  runTier0,
  mergeReport,
  applyReplacement,
  type AssistantReport,
  type Finding,
  type AssistantScores,
  type AssistantFindings,
} from "@/lib/analysis/assistant";

/**
 * useAssistant — the client brain that turns editor text into a live
 * AssistantReport across the four engines/cadences
 * (GRAMMARLY_ASSISTANT_ARCHITECTURE_HANDOFF.md §3):
 *
 *   L0 (free, instant): runTier0 recomputes on every keystroke.
 *   L2 (cheap scores):  debounced ~1s after a pause → POST /api/assistant/score
 *     (embedding cosine vs cached centroids). Drives the Voice Match number +
 *     Performance grade. Unmetered. This is the ALWAYS-ON loop.
 *   L3 (LLM, rare):     anchored voice-drift findings + rewrites + missing-pattern
 *     chips → POST /api/live-read. Runs ONLY on demand: an explicit deep check, or
 *     (when autoLiveRead) once the user goes idle on a low-scoring, materially-
 *     changed draft. Never per-pause. Unmetered (subscription entitlement).
 *
 * Both layers are hash-cached client-side so unchanged text never re-spends.
 *
 * Accept applies a finding's replacement to the text via onChangeText; Dismiss
 * hides it by a content-stable key so it stays gone as offsets shift.
 */

const L2_DEBOUNCE_MS = 1000; // score on a ~1s pause
const L3_IDLE_MS = 6000; // auto deep-check only after ~6s idle
const MIN_SCORE_CHARS = 5; // the score route's floor
const MIN_LIVE_CHARS = 15; // don't bother the LLM on trivial text
const L3_MIN_DELTA_CHARS = 12; // material change required since the last L3
const L3_SCORE_THRESHOLD = 65; // only auto-run L3 when voice/performance is low

function dismissKey(f: Finding): string {
  return `${f.class}:${f.span?.quote ?? f.title}`;
}

export interface UseAssistantOptions {
  text: string;
  onChangeText: (next: string) => void;
  voiceType?: "post" | "reply";
  isThread?: boolean;
  hasMedia?: boolean;
  avoidWords?: string[];
  authenticity?: number;
  /** Master switch (feature flag). */
  enabled?: boolean;
  /** Auto-run the rare L3 deep check on idle when the score is low (post box /
   *  dashboard). When false, L3 runs only via runDeepCheck() — the reply-box
   *  default. L2 scores always run while enabled. */
  autoLiveRead?: boolean;
}

export interface UseAssistantResult {
  report: AssistantReport;
  /** An L3 deep check (LLM) is in flight. */
  checking: boolean;
  /** The shown voice/performance scores are from an earlier text (a refresh is
   *  pending) — surface a subtle "updating…" rather than a hard number change. */
  stale: boolean;
  liveError: string | null;
  /** Apply a finding's one-click fix. */
  accept: (finding: Finding) => void;
  /** Hide a finding (content-stable). */
  dismiss: (finding: Finding) => void;
  /** Force an L3 deep check now (the reply-box on-demand path / "why?"). */
  runDeepCheck: () => void;
}

export function useAssistant(opts: UseAssistantOptions): UseAssistantResult {
  const {
    text,
    onChangeText,
    voiceType = "post",
    isThread,
    hasMedia,
    avoidWords,
    authenticity,
    enabled = true,
    autoLiveRead = true,
  } = opts;

  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<{ text: string; result: AssistantScores } | null>(null);
  const [findings, setFindings] = useState<{ text: string; result: AssistantFindings } | null>(null);
  const [checking, setChecking] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);

  // Client-side hash caches (also enforced server-side) so unchanged text never
  // re-spends on either layer.
  const scoreCache = useRef<Map<string, AssistantScores>>(new Map());
  const findingsCache = useRef<Map<string, AssistantFindings>>(new Map());
  const scoreInFlight = useRef<AbortController | null>(null);
  const findingsInFlight = useRef<AbortController | null>(null);
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastL3Text = useRef<string>("");

  // ── L0 — deterministic, every render. ─────────────────────────────────────
  const tier0 = useMemo(
    () => runTier0({ text, isThread, hasMedia, avoidWords, authenticity }),
    [text, isThread, hasMedia, avoidWords, authenticity]
  );

  // ── Merge L0 + L2 scores + L3 findings. ───────────────────────────────────
  // Seamlessness: keep showing the last scores/findings even after the user types
  // on (marked `stale`) instead of dropping to "—" on every keystroke. mergeReport
  // re-anchors voice findings to the current text, so a drift card only survives
  // while its quoted phrase still exists.
  const stale =
    (scores !== null && scores.text !== text) || (findings !== null && findings.text !== text);
  const report = useMemo<AssistantReport>(() => {
    const merged = mergeReport(
      text,
      tier0,
      scores ? scores.result : null,
      findings ? findings.result : null
    );
    if (dismissed.size === 0) return merged;
    return { ...merged, findings: merged.findings.filter((f) => !dismissed.has(dismissKey(f))) };
  }, [text, tier0, scores, findings, dismissed]);

  // ── L2 — embedding scores. ────────────────────────────────────────────────
  const doScore = useCallback(
    async (target: string) => {
      const cached = scoreCache.current.get(target);
      if (cached) {
        setScores({ text: target, result: cached });
        return;
      }
      scoreInFlight.current?.abort();
      const controller = new AbortController();
      scoreInFlight.current = controller;
      try {
        const res = await fetch("/api/assistant/score", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: target, draft_type: isThread ? "X_THREAD" : "X_POST" }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLiveError(data.error || "Score failed");
          return;
        }
        const result: AssistantScores = {
          voice_score: Number(data.voice_score) || 0,
          resemblance_score: Number(data.resemblance_score) || 0,
        };
        // Don't cache a cold-start placeholder — the next call gets a real score.
        if (!data.cold_start) scoreCache.current.set(target, result);
        setScores({ text: target, result });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setLiveError(err instanceof Error ? err.message : "Score failed");
        }
      } finally {
        if (scoreInFlight.current === controller) scoreInFlight.current = null;
      }
    },
    [isThread]
  );

  // ── L3 — the LLM deep check (rare). ───────────────────────────────────────
  const doFindings = useCallback(
    async (target: string) => {
      const cached = findingsCache.current.get(target);
      if (cached) {
        setFindings({ text: target, result: cached });
        lastL3Text.current = target;
        return;
      }
      findingsInFlight.current?.abort();
      const controller = new AbortController();
      findingsInFlight.current = controller;
      setChecking(true);
      setLiveError(null);
      try {
        const res = await fetch("/api/live-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: target,
            voice_type: voiceType,
            draft_type: isThread ? "X_THREAD" : "X_POST",
            has_media: Boolean(hasMedia),
          }),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLiveError(data.error || "Live read failed");
          return;
        }
        const result = data as AssistantFindings;
        findingsCache.current.set(target, result);
        setFindings({ text: target, result });
        lastL3Text.current = target;
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setLiveError(err instanceof Error ? err.message : "Live read failed");
        }
      } finally {
        if (findingsInFlight.current === controller) {
          setChecking(false);
          findingsInFlight.current = null;
        }
      }
    },
    [voiceType, isThread, hasMedia]
  );

  // ── L2 driver: debounced score on every materially-present pause. ─────────
  useEffect(() => {
    if (!enabled) return;
    if (scoreTimer.current) clearTimeout(scoreTimer.current);

    const trimmed = text.trim();
    if (trimmed.length < MIN_SCORE_CHARS) return;
    if (scoreCache.current.has(text)) {
      setScores({ text, result: scoreCache.current.get(text)! });
      return;
    }
    scoreTimer.current = setTimeout(() => doScore(text), L2_DEBOUNCE_MS);
    return () => {
      if (scoreTimer.current) clearTimeout(scoreTimer.current);
    };
  }, [text, enabled, doScore]);

  // ── L3 auto-trigger: low score + idle + material change. Never per-pause. ──
  useEffect(() => {
    if (!enabled || !autoLiveRead) return;
    if (idleTimer.current) clearTimeout(idleTimer.current);

    const trimmed = text.trim();
    if (trimmed.length < MIN_LIVE_CHARS) return;
    if (findingsCache.current.has(text)) {
      setFindings({ text, result: findingsCache.current.get(text)! });
      lastL3Text.current = text;
      return;
    }

    idleTimer.current = setTimeout(() => {
      const last = lastL3Text.current;
      // Material change gate — don't re-run on a typo fix.
      if (last && Math.abs(text.length - last.length) < L3_MIN_DELTA_CHARS) return;
      // Only spend an LLM call when the cheap L2 score says something's off.
      const s = scores?.result;
      const low =
        !s ||
        s.voice_score < L3_SCORE_THRESHOLD ||
        s.resemblance_score < L3_SCORE_THRESHOLD;
      if (!low) return;
      doFindings(text);
    }, L3_IDLE_MS);

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [text, enabled, autoLiveRead, scores, doFindings]);

  const accept = useCallback(
    (finding: Finding) => {
      const { text: next } = applyReplacement(text, finding);
      onChangeText(next);
    },
    [text, onChangeText]
  );

  const dismiss = useCallback((finding: Finding) => {
    setDismissed((prev) => new Set(prev).add(dismissKey(finding)));
  }, []);

  const runDeepCheck = useCallback(() => {
    if (text.trim().length >= MIN_SCORE_CHARS) doFindings(text);
  }, [text, doFindings]);

  return { report, checking, stale, liveError, accept, dismiss, runDeepCheck };
}
