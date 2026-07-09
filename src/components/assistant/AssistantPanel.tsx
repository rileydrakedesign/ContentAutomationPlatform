"use client";

import { Check, X, Sparkles, PenLine, ArrowRight, Lightbulb } from "lucide-react";
import { ScoreDial } from "./ScoreDial";
import type { AssistantReport, Finding, FindingClass, SuggestionChip } from "@/lib/analysis/assistant";
import { CLASS_STYLE, BADGE_COLOR, gradeBand, BAND_COLOR } from "@/lib/analysis/assistant";

/**
 * The dashboard writing-assistant readout (GRAMMARLY_PIVOT_UX.md §5), split into
 * two pieces so they can share the editor's container instead of stacking into one
 * tall right-hand column:
 *
 *   <AssistantScorePanel>    — the compact holistic readout (Post Score dial +
 *     Voice / Performance / Reach + state badges). Sits inline beside the editor,
 *     vertically centered.
 *   <AssistantSuggestionList> — the per-span findings + missing-pattern chips, in a
 *     wrap-friendly grid that flows UNDER the editor row (full width, optimized).
 *
 * Before the user writes anything (`hasContent` false) the score panel shows only a
 * one-line hint — no provisional "55", no nags — and the suggestion list is empty.
 */

export function AssistantScorePanel({
  report,
  hasContent = true,
  checking,
  stale,
  liveError,
  scoreUnavailable = false,
}: {
  report: AssistantReport;
  /** False until the draft has real text — gates the whole readout. */
  hasContent?: boolean;
  checking?: boolean;
  /** Shown scores are from earlier text; a refresh is pending. */
  stale?: boolean;
  liveError?: string | null;
  /** L2 score service is down — fall back to the reach score, don't hang on "–". */
  scoreUnavailable?: boolean;
}) {
  const { scores, findings, badges } = report;
  const errorCount = findings.reduce((n, f) => n + (f.class === "correctness" ? 1 : 0), 0);
  // Show a value once the full blend is in — OR fall back to the deterministic
  // reach score if the L2 (embedding) score can't be reached, so the dial never
  // hangs blank.
  const pending = scores.postProvisional && !scoreUnavailable;

  // Idle: nothing written yet. Keep it whisper-quiet.
  if (!hasContent) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-4 text-center lg:border-l lg:border-[var(--color-border-subtle)] lg:pl-4">
        <PenLine className="h-4 w-4 text-[var(--color-text-muted)]" />
        <p className="text-[11px] leading-relaxed text-[var(--color-text-muted)]">
          Start writing — I&apos;ll check your voice and the algorithm live as you go.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2.5 lg:border-l lg:border-[var(--color-border-subtle)] lg:pl-4">
      <div className="flex items-center gap-3.5">
        <ScoreDial
          value={scores.post}
          provisional={scores.postProvisional}
          pending={pending}
          errorCount={errorCount}
          checking={checking}
          size={48}
        />
        <div className="flex min-w-0 flex-1 flex-col gap-1 text-xs">
          <ScoreRow
            label="Voice"
            value={scores.voice === null ? "—" : String(scores.voice)}
            color={scores.voice === null ? "var(--color-text-muted)" : CLASS_STYLE.voice.color}
          />
          <ScoreRow
            label="Performance"
            value={scores.performance ?? "—"}
            color={scores.performance ? BAND_COLOR[gradeBand(scores.performance)] : "var(--color-text-muted)"}
          />
          <ScoreRow label="Algorithm" value={String(scores.reach)} color={CLASS_STYLE.reach.color} />
        </div>
      </div>

      {/* Subtle live-update hint — a thin line, not a chunky banner. */}
      {(checking || stale) && (
        <div className="flex items-center gap-1.5 text-[11px] text-[var(--color-text-muted)]">
          <span aria-hidden className="inline-block animate-[blink_1s_steps(1)_infinite]">▌</span>
          {checking ? "Reading your draft…" : "Updating…"}
        </div>
      )}
      {liveError && <p className="text-[11px] text-[var(--color-danger-400)]">{liveError}</p>}
      {scoreUnavailable && !pending && (
        <p className="text-[11px] text-[var(--color-text-muted)]" title="Voice/performance scoring is temporarily unavailable">
          Voice score paused — showing the algorithm score only
        </p>
      )}

      {/* Reach / state badge row */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {badges.map((b) => (
            <span
              key={b.id}
              title={b.detail}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{ color: BADGE_COLOR[b.status], background: `${BADGE_COLOR[b.status]}1a` }}
            >
              {b.status === "good" ? "✓" : b.status === "caution" ? "⚠" : "·"} {b.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The suggestion sections, in display order. Voice and Algorithm are deliberately
 * distinct, co-equal baskets — voice = "sounds like you", algorithm = "the X ranker
 * will distribute this" — never merged into one list. Correctness/Clarity are the
 * minor copy-edit baskets; Patterns are the missing high-lift content patterns.
 */
const SUGGESTION_SECTIONS: {
  key: string;
  label: string;
  color: string;
  /** Finding classes that belong to this section. */
  classes: FindingClass[];
  /** Chip kinds that belong to this section. */
  chipKinds: SuggestionChip["kind"][];
}[] = [
  { key: "correctness", label: "Correctness", color: CLASS_STYLE.correctness.color, classes: ["correctness"], chipKinds: [] },
  { key: "voice", label: "Voice", color: CLASS_STYLE.voice.color, classes: ["voice"], chipKinds: [] },
  { key: "algorithm", label: "Algorithm & reach", color: CLASS_STYLE.reach.color, classes: ["reach"], chipKinds: ["nudge"] },
  { key: "patterns", label: "Proven patterns", color: BADGE_COLOR.info, classes: [], chipKinds: ["missing_pattern"] },
  { key: "clarity", label: "Clarity", color: CLASS_STYLE.clarity.color, classes: ["clarity"], chipKinds: [] },
];

export function AssistantSuggestionList({
  report,
  hasContent = true,
  checking,
  onAccept,
  onDismiss,
}: {
  report: AssistantReport;
  hasContent?: boolean;
  checking?: boolean;
  onAccept?: (f: Finding) => void;
  onDismiss?: (f: Finding) => void;
}) {
  const { scores, findings, chips, nextStep, coreIdea } = report;
  const count = findings.length + chips.length;

  if (!hasContent) return null;

  if (count === 0 && !nextStep) {
    // Quiet reassurance only once the draft is in good shape; otherwise nothing.
    if (checking || scores.post < 80) return null;
    return (
      <p className="text-[11px] text-[var(--color-text-muted)]">Looking sharp — nothing flagged.</p>
    );
  }

  const sections = SUGGESTION_SECTIONS.map((s) => ({
    ...s,
    findings: findings.filter((f) => s.classes.includes(f.class)),
    chips: chips.filter((c) => s.chipKinds.includes(c.kind)),
  })).filter((s) => s.findings.length + s.chips.length > 0);

  return (
    <div className="space-y-3 border-t border-[var(--color-border-subtle)] pt-3">
      {coreIdea && (
        <div className="flex items-start gap-2 px-0.5">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-text-muted)]" />
          <p className="min-w-0 text-[11px] leading-snug text-[var(--color-text-secondary)]">
            <span className="font-semibold text-[var(--color-text-muted)]">Your idea:</span>{" "}
            {coreIdea}
            <span className="text-[var(--color-text-muted)]"> — every suggestion serves this.</span>
          </p>
        </div>
      )}
      {nextStep && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/5 px-2.5 py-2">
          <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-accent-400)]" />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent-400)]">
              Next step
            </p>
            <p className="mt-0.5 text-xs font-medium text-[var(--color-text-primary)]">{nextStep.label}</p>
            {nextStep.detail && (
              <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-secondary)]">
                {nextStep.detail}
              </p>
            )}
          </div>
        </div>
      )}
      {sections.map((s) => {
        const n = s.findings.length + s.chips.length;
        return (
          <div key={s.key} className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
              <h4 className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: s.color }}>
                {s.label}
              </h4>
              <span className="text-[10px] text-[var(--color-text-muted)]">({n})</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {s.findings.map((f) => (
                <SuggestionCard key={f.id} finding={f} onAccept={onAccept} onDismiss={onDismiss} />
              ))}
              {s.chips.map((c) => (
                <ChipCard key={c.id} chip={c} color={s.color} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ChipCard({ chip, color }: { chip: SuggestionChip; color: string }) {
  return (
    <div className="flex items-start gap-1.5 rounded-lg border border-dashed border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/40 px-2.5 py-2">
      <Sparkles className="mt-0.5 h-3 w-3 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[var(--color-text-primary)]">{chip.label}</p>
        {chip.detail && (
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-[var(--color-text-secondary)]">
            {chip.detail}
          </p>
        )}
      </div>
    </div>
  );
}

function ScoreRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-text-secondary)]">{label}</span>
      <span className="font-semibold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}

function SuggestionCard({
  finding,
  onAccept,
  onDismiss,
}: {
  finding: Finding;
  onAccept?: (f: Finding) => void;
  onDismiss?: (f: Finding) => void;
}) {
  const canAccept = onAccept && finding.replacement !== undefined;
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2.5 py-2">
      <div className="flex items-baseline gap-1.5">
        <p className="text-xs font-medium text-[var(--color-text-primary)]">{finding.title}</p>
        {!finding.span && (
          <span className="text-[9px] text-[var(--color-text-muted)]">· whole post</span>
        )}
      </div>
      <p className="mt-0.5 text-[11px] leading-snug text-[var(--color-text-secondary)]">{finding.why}</p>
      {(canAccept || onDismiss) && (
        <div className="mt-1.5 flex items-center gap-2.5">
          {canAccept && (
            <button
              onClick={() => onAccept!(finding)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-accent-400)] hover:text-[var(--color-accent-400)]"
            >
              <Check className="h-3 w-3" />
              {finding.replacement === "" ? "Remove" : "Accept"}
            </button>
          )}
          {onDismiss && (
            <button
              onClick={() => onDismiss(finding)}
              className="inline-flex items-center gap-1 text-[11px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
            >
              <X className="h-3 w-3" />
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}
