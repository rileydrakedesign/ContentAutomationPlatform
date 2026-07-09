"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  runTier0,
  mergeReport,
  applyReplacement,
  anchorLedger,
  contradictsSettled,
  type AssistantReport,
  type Finding,
  type SuggestionChip,
  type NextStep,
  type AssistantScores,
  type AssistantFindings,
  type AcceptedEdit,
  type DeclinedSuggestion,
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

const L2_DEBOUNCE_MS = 400; // score quickly on a short pause (cheap, unmetered)
// L3 cadence is event-driven, not a fixed poll: fire a beat after the writer
// *settles*, sooner when the draft ends on a finished thought than mid-sentence.
const L3_SETTLE_MS = 1200; // idle after a sentence boundary / newline
const L3_IDLE_MS = 3500; // idle mid-sentence (don't read a half-typed clause)
const L3_MIN_INTERVAL_MS = 9000; // hard floor between actual reads (latest-wins)
const MIN_SCORE_CHARS = 5; // the score route's floor
const MIN_LIVE_CHARS = 15; // don't bother the LLM on trivial text
const L3_MIN_DELTA_CHARS = 12; // material change required since the last L3
const L3_SCORE_THRESHOLD = 65; // a low cheap-score still earns a read
const L3_DROP_DELTA = 6; // …so does the cheap voice score dropping this much
const L3_WATCHDOG_MS = 30000; // hard cap on a single read so "checking" can't hang
const RETAIN_CHECK_MS = 15000; // after an accept, did the change survive this long?
const WARM_TTL_MS = 4 * 60 * 1000; // re-warm the prompt cache before its ~5min TTL
const LEDGER_MAX = 20; // accepted-edit ledger cap (session memory, oldest out)
const DECLINED_MAX = 12; // dismissed-suggestion memory cap
const DECLINED_SENT = 8; // how many recent dismissals ride along with a read

function dismissKey(f: Finding): string {
  return `${f.class}:${f.span?.quote ?? f.title}`;
}

// Dismissals persist across sessions (localStorage): a nag the user closed must
// STAY closed — resurrection on reload is the trust-killer for an assistant.
const DISMISSED_STORAGE_KEY = "afx:assistant:dismissed:v1";
const DISMISSED_STORAGE_MAX = 300;

function loadDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(DISMISSED_STORAGE_KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : null;
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

function persistDismissed(keys: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      DISMISSED_STORAGE_KEY,
      JSON.stringify([...keys].slice(-DISMISSED_STORAGE_MAX))
    );
  } catch {
    /* quota / private mode — dismissals stay session-only */
  }
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
  /** The L2 score service is failing (e.g. embeddings quota) — the UI should fall
   *  back to the deterministic reach score instead of a blank dial. */
  scoreUnavailable: boolean;
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

  const [dismissed, setDismissed] = useState<Set<string>>(loadDismissed);
  // Session edit ledger: every accepted suggestion is a settled decision. Later
  // reads receive it in the prompt (advisory) AND are filtered against it via
  // contradictsSettled (the hard guarantee) — a fresh read can't re-flag or
  // revert the fix the user just applied. Session-scoped on purpose: a reload
  // starts a new editing session.
  const [ledger, setLedger] = useState<AcceptedEdit[]>([]);
  const ledgerRef = useRef<AcceptedEdit[]>([]);
  ledgerRef.current = ledger;
  // Suggestions dismissed this session, with enough context to tell the model
  // not to re-raise them (the persisted dismiss-keys only hide client-side).
  const declinedRef = useRef<DeclinedSuggestion[]>([]);
  // The post's core idea as pinned by the first read this session. Echoed back
  // with every later read so the engine keeps refining ONE post toward ONE
  // point instead of re-deriving a new direction per read.
  const coreIdeaRef = useRef<string>("");
  // Signals this user keeps dismissing and never accepts — hidden entirely
  // (except hard "problem" severities, which state facts, not taste). Fetched
  // once per mount from the telemetry aggregate.
  const [suppressedSignals, setSuppressedSignals] = useState<Set<string>>(new Set());
  const [scores, setScores] = useState<{ text: string; result: AssistantScores } | null>(null);
  const [findings, setFindings] = useState<{ text: string; result: AssistantFindings } | null>(null);
  const [checking, setChecking] = useState(false);
  const [liveError, setLiveError] = useState<string | null>(null);
  // The L2 score service (embeddings) is failing — surface a graceful fallback to
  // the deterministic reach score instead of a permanently blank dial.
  const [scoreUnavailable, setScoreUnavailable] = useState(false);

  // Client-side hash caches (also enforced server-side) so unchanged text never
  // re-spends on either layer.
  const scoreCache = useRef<Map<string, AssistantScores>>(new Map());
  const findingsCache = useRef<Map<string, AssistantFindings>>(new Map());
  const scoreInFlight = useRef<AbortController | null>(null);
  const findingsInFlight = useRef<AbortController | null>(null);
  const scoreTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastL3Text = useRef<string>("");
  // For the rate-limit + signal-movement gate: when the last real L3 fired, and
  // the cheap voice score at that moment (so we can detect it dropping since).
  const lastL3At = useRef<number>(0);
  const lastL3Score = useRef<number | null>(null);
  const lastWarmAt = useRef<number>(0);
  // Always-current scores + text for callbacks/timers that aren't re-created on
  // every change (the retain check reads the latest text 15s after an accept).
  const scoresRef = useRef<AssistantScores | null>(null);
  scoresRef.current = scores?.result ?? null;
  const textRef = useRef(text);
  textRef.current = text;

  // Fire-and-forget suggestion telemetry — powers value-based tuning of the
  // trigger (which suggestion types get accepted AND kept). Never blocks the UI.
  const logEvent = useCallback(
    (action: "accept" | "dismiss" | "retain", finding: Finding) => {
      if (!enabled) return;
      try {
        fetch("/api/assistant/telemetry", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            finding_class: finding.class,
            source: finding.source,
            signal: finding.signal,
            voice_score: scoresRef.current?.voice_score,
          }),
          keepalive: true,
        }).catch(() => {});
      } catch {
        // ignore — telemetry is never load-bearing
      }
    },
    [enabled]
  );

  // ── Per-user signal suppression: closes the accept/dismiss feedback loop. ──
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    fetch("/api/assistant/telemetry")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { suppressed_signals?: unknown } | null) => {
        if (!alive || !data || !Array.isArray(data.suppressed_signals)) return;
        setSuppressedSignals(new Set(data.suppressed_signals.map(String)));
      })
      .catch(() => {
        /* suppression is a tuning layer — never load-bearing */
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  // Pin the core idea from whichever path delivered findings (stream, one-shot,
  // client cache, or a server-cached read) — the ref is what rides with the
  // next request.
  useEffect(() => {
    const idea = findings?.result.core_idea;
    if (idea) coreIdeaRef.current = idea;
  }, [findings]);

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
    // Settled decisions still anchored in the current text — entries expire on
    // their own once the user rewrites that section (the post evolved).
    const settled = ledger.length ? anchorLedger(text, ledger) : [];
    // Hidden findings are filtered INSIDE mergeReport (not after) so the score
    // deductions they hold are released the moment the user dismisses them —
    // dismiss and accept both visibly move the headline.
    const isHidden =
      dismissed.size === 0 && suppressedSignals.size === 0 && settled.length === 0
        ? undefined
        : (f: Finding) =>
            dismissed.has(dismissKey(f)) ||
            // Suppressed signals hide soft nags only — a hard "problem" (e.g. the
            // external-link penalty) states a fact and always shows.
            Boolean(f.signal && f.severity !== "problem" && suppressedSignals.has(f.signal)) ||
            // A live finding that re-flags an accepted edit's span (same class)
            // or whose fix would revert it is contradiction churn — hidden, so
            // its score deduction never lands and the headline can't oscillate.
            contradictsSettled(f, settled);
    return mergeReport(
      text,
      tier0,
      scores ? scores.result : null,
      findings ? findings.result : null,
      isHidden
    );
  }, [text, tier0, scores, findings, dismissed, suppressedSignals, ledger]);

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
          // Score service down (e.g. embeddings quota) — fall back to reach, don't
          // pollute the findings' liveError with a scary score message.
          setScoreUnavailable(true);
          return;
        }
        const result: AssistantScores = {
          voice_score: Number(data.voice_score) || 0,
          resemblance_score: Number(data.resemblance_score) || 0,
        };
        // Don't cache a cold-start placeholder — the next call gets a real score.
        if (!data.cold_start) scoreCache.current.set(target, result);
        setScoreUnavailable(false);
        setScores({ text: target, result });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setScoreUnavailable(true);
        }
      } finally {
        if (scoreInFlight.current === controller) scoreInFlight.current = null;
      }
    },
    [isThread]
  );

  // ── L3 — the LLM deep check (rare). Streams findings as they resolve so they
  // appear progressively; falls back to a one-shot JSON read if the stream can't
  // start. ──────────────────────────────────────────────────────────────────
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
      // Stamp the rate-limit clock + the score we're reading at, so the trigger
      // can enforce a min interval and detect later score movement.
      lastL3At.current = Date.now();
      lastL3Score.current = scoresRef.current?.voice_score ?? null;
      // Mark this text as read NOW (not at the end of the ~10s stream) so the
      // material-change gate suppresses re-fires for the same text while it's in
      // flight — otherwise the rate-limit timer aborts and restarts this read
      // forever and "Reading your draft…" never clears.
      lastL3Text.current = target;
      setChecking(true);
      setLiveError(null);

      // Watchdog: if a read stalls (server hang, dropped SSE, flaky infra), abort
      // it so `checking` can never get stuck on "Reading your draft…" forever.
      const watchdog = setTimeout(() => {
        if (findingsInFlight.current === controller) controller.abort();
      }, L3_WATCHDOG_MS);

      // Settled session decisions ride along so the model respects them at the
      // source; the client-side contradictsSettled filter stays the hard
      // guarantee (also covers server-cached reads, which predate the ledger).
      const settled = anchorLedger(target, ledgerRef.current);
      const reqBase = {
        text: target,
        voice_type: voiceType,
        draft_type: isThread ? "X_THREAD" : "X_POST",
        has_media: Boolean(hasMedia),
        session_edits: settled.length
          ? settled.map((e) => ({ before: e.before, after: e.after }))
          : undefined,
        declined: declinedRef.current.length
          ? declinedRef.current.slice(-DECLINED_SENT)
          : undefined,
        core_idea: coreIdeaRef.current || undefined,
      };

      // One-shot fallback (used if streaming can't start).
      const runJSON = async () => {
        const res = await fetch("/api/live-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reqBase),
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setLiveError((data as { error?: string }).error || "Live read failed");
          return;
        }
        const result = data as AssistantFindings;
        findingsCache.current.set(target, result);
        setFindings({ text: target, result });
        lastL3Text.current = target;
      };

      try {
        const res = await fetch("/api/live-read", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...reqBase, stream: true }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          await runJSON();
          return;
        }

        // Accumulate streamed events into the AssistantFindings shape, pushing a
        // fresh snapshot to state on each so the editor re-anchors incrementally.
        const acc: AssistantFindings = {
          voice_findings: [],
          correctness_findings: [],
          reach_findings: [],
          missing_pattern_chips: [],
          next_edit: null,
          core_idea: undefined,
          summary: "",
        };
        const snapshot = (): AssistantFindings => ({
          voice_findings: [...acc.voice_findings],
          correctness_findings: [...(acc.correctness_findings ?? [])],
          reach_findings: [...(acc.reach_findings ?? [])],
          missing_pattern_chips: [...acc.missing_pattern_chips],
          next_edit: acc.next_edit ?? null,
          core_idea: acc.core_idea,
          summary: acc.summary,
          voice_score: acc.voice_score,
        });

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        // Server signals a mid-stream model failure with `type:"error"`. What
        // already streamed is still shown, but a partial read must never enter
        // the client cache as authoritative (mirrors the server, which skips
        // persistence on a failed stream).
        let streamErrored = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const frames = buf.split("\n\n");
          buf = frames.pop() || "";
          for (const frame of frames) {
            const dataLine = frame.split("\n").find((l) => l.startsWith("data:"));
            if (!dataLine) continue;
            const payload = dataLine.slice(5).trim();
            if (!payload) continue;
            let ev: {
              type?: string;
              result?: AssistantFindings;
              finding?: Finding;
              chip?: SuggestionChip;
              nextStep?: NextStep;
              coreIdea?: string;
              summary?: string;
            };
            try {
              ev = JSON.parse(payload);
            } catch {
              continue;
            }
            if (ev.type === "error") {
              streamErrored = true;
            } else if (ev.type === "full" && ev.result) {
              Object.assign(acc, ev.result);
            } else if (ev.type === "finding" && ev.finding) {
              const bucket =
                ev.finding.class === "correctness"
                  ? acc.correctness_findings!
                  : ev.finding.class === "reach"
                    ? acc.reach_findings!
                    : acc.voice_findings;
              bucket.push(ev.finding);
            } else if (ev.type === "chip" && ev.chip) {
              acc.missing_pattern_chips.push(ev.chip);
            } else if (ev.type === "next" && ev.nextStep) {
              acc.next_edit = ev.nextStep;
            } else if (ev.type === "idea" && ev.coreIdea) {
              acc.core_idea = ev.coreIdea;
            } else if (ev.type === "summary") {
              acc.summary = ev.summary ?? "";
            }
            if (ev.type && ev.type !== "done" && ev.type !== "error") {
              setFindings({ text: target, result: snapshot() });
            }
          }
        }

        const finalResult = snapshot();
        if (streamErrored) {
          const gotAnything =
            finalResult.voice_findings.length > 0 ||
            (finalResult.correctness_findings ?? []).length > 0 ||
            finalResult.missing_pattern_chips.length > 0 ||
            Boolean(finalResult.next_edit);
          // Keep whatever partial findings streamed (uncached — a later read of
          // the same text re-runs); surface an error only if nothing arrived.
          if (gotAnything) setFindings({ text: target, result: finalResult });
          else setLiveError("Live read failed");
        } else {
          findingsCache.current.set(target, finalResult);
          setFindings({ text: target, result: finalResult });
        }
        lastL3Text.current = target;
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          // Stream blew up — try the one-shot path before surfacing an error.
          try {
            await runJSON();
          } catch (e2) {
            if ((e2 as Error).name !== "AbortError") {
              setLiveError(e2 instanceof Error ? e2.message : "Live read failed");
            }
          }
        }
      } finally {
        clearTimeout(watchdog);
        if (findingsInFlight.current === controller) {
          setChecking(false);
          findingsInFlight.current = null;
        }
      }
    },
    [voiceType, isThread, hasMedia]
  );

  // ── Cache warming: prime the L3 prompt cache before the first real read. ──
  // Fired on settle while the user writes; throttled to once per cache-TTL window,
  // and only before the first read (a real read warms the cache itself). Makes the
  // first live read a fast cache-read instead of a cold full-input call.
  const warmCache = useCallback(() => {
    if (!enabled || !autoLiveRead) return;
    if (lastL3At.current !== 0) return; // a real read already populated the cache
    if (Date.now() - lastWarmAt.current < WARM_TTL_MS) return;
    lastWarmAt.current = Date.now();
    fetch("/api/live-read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ warm: true, voice_type: voiceType, draft_type: isThread ? "X_THREAD" : "X_POST" }),
    }).catch(() => {});
  }, [enabled, autoLiveRead, voiceType, isThread]);

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

  // ── L3 trigger: settle-event + signal-movement + rate-limit. ──────────────
  // Not a fixed poll. Cheap layers carry the live feel; the LLM fires once when a
  // thought *settles* AND the cheap signal says it's worth explaining, capped to
  // one read per interval (latest text wins). See GRAMMARLY_ASSISTANT… §7.
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

    // Warm the prompt cache while the user is actively writing, so the first real
    // read lands fast (no-op after the first read / within the TTL window).
    warmCache();

    // Settle sooner when the draft ends on a finished thought (sentence
    // punctuation, closing bracket/quote, or a newline); wait longer mid-sentence.
    const settled = /(?:[.!?…)\]"'’”]|\n)\s*$/.test(text);
    const settleMs = settled ? L3_SETTLE_MS : L3_IDLE_MS;

    idleTimer.current = setTimeout(function attempt() {
      const last = lastL3Text.current;
      // Need a material change since the last read — don't re-run on a typo fix.
      if (last && Math.abs(text.length - last.length) < L3_MIN_DELTA_CHARS) return;

      // Gate on the cheap signal: read only when it's low OR just dropped — never
      // on a stable/improving draft.
      const s = scores?.result;
      const voice = s?.voice_score;
      const low =
        voice == null || voice < L3_SCORE_THRESHOLD || (s?.resemblance_score ?? 100) < L3_SCORE_THRESHOLD;
      const worsened =
        typeof voice === "number" &&
        lastL3Score.current !== null &&
        voice <= lastL3Score.current - L3_DROP_DELTA;
      if (!low && !worsened) return;

      // Hard rate-limit, latest-wins: never read more than once per interval. If
      // we're inside the window, wait out the remainder and re-check the newest
      // text (this same closure is cleared if the user types again).
      const sinceLast = Date.now() - lastL3At.current;
      if (sinceLast < L3_MIN_INTERVAL_MS) {
        idleTimer.current = setTimeout(attempt, L3_MIN_INTERVAL_MS - sinceLast);
        return;
      }
      doFindings(text);
    }, settleMs);

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [text, enabled, autoLiveRead, scores, doFindings, warmCache]);

  const accept = useCallback(
    (finding: Finding) => {
      const { text: next } = applyReplacement(text, finding);
      const replacement = finding.replacement ?? "";

      // Ledger the decision (session memory): later reads must not re-flag this
      // span or revert this edit. Deletions (empty replacement) can't anchor in
      // the new text, so they aren't ledgered.
      if (finding.span && replacement) {
        setLedger((prev) =>
          [
            ...prev,
            {
              before: finding.span!.quote,
              after: replacement,
              class: finding.class,
              signal: finding.signal,
            },
          ].slice(-LEDGER_MAX)
        );
      }

      // An accept is NOT a material change: stamp the post-accept text as
      // already-read so the settle trigger doesn't spend a fresh read on our own
      // edit (the old length-delta gate let a long replacement re-arm the loop,
      // and that read is exactly the one that used to contradict the fix). The
      // next read must be earned by the USER typing a material delta.
      lastL3Text.current = next;

      // Rebase, don't re-infer (the suggestion-lifecycle pattern: an applied
      // edit invalidates only the suggestions it touched). The accepted finding
      // and any live finding whose span overlaps the edited range are removed;
      // every other live finding survives — mergeReport re-anchors it by quote
      // against the new text on the next render, which IS the rebase, with no
      // LLM round-trip. A span-less accept replaced the whole draft, so nothing
      // live can survive it. Tier-0 recomputes synchronously either way.
      if (findings) {
        const edited = finding.span;
        if (!edited) {
          setFindings(null);
        } else {
          const survives = (f: Finding) =>
            f.id !== finding.id &&
            (!f.span || f.span.start >= edited.end || f.span.end <= edited.start);
          setFindings({
            // Stamp the post-edit text: survivors re-anchor against it, so the
            // readout shouldn't sit on "updating…" waiting for a refresh that
            // isn't coming.
            text: next,
            result: {
              ...findings.result,
              voice_findings: findings.result.voice_findings.filter(survives),
              correctness_findings: (findings.result.correctness_findings ?? []).filter(
                survives
              ),
              reach_findings: (findings.result.reach_findings ?? []).filter(survives),
            },
          });
        }
      }

      onChangeText(next);

      // Telemetry: log the accept, then check 15s later whether the change
      // survived (wasn't undone / typed over) — "accepted AND retained".
      logEvent("accept", finding);
      const quote = finding.span?.quote;
      setTimeout(() => {
        const cur = textRef.current;
        const retained = finding.span
          ? replacement
            ? cur.includes(replacement)
            : quote
              ? !cur.includes(quote)
              : true
          : cur.trim() === replacement.trim();
        if (retained) logEvent("retain", finding);
      }, RETAIN_CHECK_MS);

      // Recompute the displayed score immediately so an applied fix visibly moves
      // the number — reach recomputes synchronously via Tier-0; this refreshes the
      // L2 voice/performance now instead of waiting out the typing-pause debounce.
      if (enabled && next.trim().length >= MIN_SCORE_CHARS) {
        doScore(next);
      }
    },
    [text, findings, onChangeText, enabled, doScore, logEvent]
  );

  const dismiss = useCallback(
    (finding: Finding) => {
      setDismissed((prev) => {
        const next = new Set(prev).add(dismissKey(finding));
        persistDismissed(next);
        return next;
      });
      // Remember what was declined (session-scoped) so the next read is told
      // not to re-raise it or a close variant.
      declinedRef.current = [
        ...declinedRef.current,
        { quote: finding.span?.quote, issue: finding.title },
      ].slice(-DECLINED_MAX);
      logEvent("dismiss", finding);
    },
    [logEvent]
  );

  const runDeepCheck = useCallback(() => {
    if (text.trim().length >= MIN_SCORE_CHARS) doFindings(text);
  }, [text, doFindings]);

  return { report, checking, stale, liveError, scoreUnavailable, accept, dismiss, runDeepCheck };
}
