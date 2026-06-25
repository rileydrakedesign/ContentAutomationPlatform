"use client";

import { Check, X, Sparkles, Loader2 } from "lucide-react";
import { ScoreDial } from "./ScoreDial";
import type { AssistantReport, Finding } from "@/lib/analysis/assistant";
import { CLASS_STYLE, BADGE_COLOR, gradeBand, BAND_COLOR } from "@/lib/analysis/assistant";

/**
 * The dashboard assistant sidebar (GRAMMARLY_PIVOT_UX.md §5). Always-visible:
 * Post Score dial + Voice Match + Performance grade, a Reach badge row, and the
 * suggestion cards that mirror the underlines (Accept / Dismiss). The score area
 * is for holistic metrics; the cards are the per-span findings + missing-pattern
 * chips. Nothing here is an underline — those live in the editor.
 */
export function AssistantPanel({
  report,
  checking,
  stale,
  liveError,
  onAccept,
  onDismiss,
  onDeepCheck,
  showDeepCheck = false,
}: {
  report: AssistantReport;
  checking?: boolean;
  /** Shown scores are from earlier text; a refresh is pending. */
  stale?: boolean;
  liveError?: string | null;
  onAccept?: (f: Finding) => void;
  onDismiss?: (f: Finding) => void;
  onDeepCheck?: () => void;
  showDeepCheck?: boolean;
}) {
  const { scores, findings, chips, badges } = report;

  // Count findings by class for the pill row.
  const counts = findings.reduce<Record<string, number>>((acc, f) => {
    acc[f.class] = (acc[f.class] || 0) + 1;
    return acc;
  }, {});
  const errorCount = counts.correctness || 0;

  return (
    <div className="flex w-full flex-col gap-4 rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
      {/* Scores */}
      <div className="flex items-center gap-4">
        <ScoreDial
          value={scores.post}
          label="Post score"
          provisional={scores.postProvisional}
          errorCount={errorCount}
          checking={checking}
        />
        <div className="flex flex-1 flex-col gap-1.5 text-xs">
          <ScoreRow
            label="Voice match"
            value={scores.voice === null ? "—" : String(scores.voice)}
            color={scores.voice === null ? "var(--color-text-muted)" : CLASS_STYLE.voice.color}
          />
          <ScoreRow
            label="Performance"
            value={scores.performance ?? "—"}
            color={scores.performance ? BAND_COLOR[gradeBand(scores.performance)] : "var(--color-text-muted)"}
          />
          <ScoreRow label="Reach" value={String(scores.reach)} color={CLASS_STYLE.reach.color} />
        </div>
      </div>

      {/* Reach / state badge row */}
      {badges.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {badges.map((b) => (
            <span
              key={b.id}
              title={b.detail}
              className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
              style={{ color: BADGE_COLOR[b.status], background: `${BADGE_COLOR[b.status]}1a` }}
            >
              {b.status === "good" ? "✓" : b.status === "caution" ? "⚠" : "·"} {b.label}
            </span>
          ))}
        </div>
      )}

      {(checking || stale) && (
        <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {checking ? "Reading your draft…" : "Scores from a moment ago — updating on pause"}
        </div>
      )}
      {liveError && <p className="text-xs text-[var(--color-danger-400)]">{liveError}</p>}

      {/* Suggestion cards (mirror the underlines + missing-pattern chips) */}
      <div className="flex flex-col gap-2">
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
          Suggestions {findings.length + chips.length > 0 ? `(${findings.length + chips.length})` : ""}
        </h4>

        {findings.length === 0 && chips.length === 0 && (
          <p className="text-xs text-[var(--color-text-muted)]">
            {scores.post >= 80 ? "Looking sharp — nothing flagged." : "No flagged spans. Keep writing."}
          </p>
        )}

        {findings.map((f) => (
          <SuggestionCard key={f.id} finding={f} onAccept={onAccept} onDismiss={onDismiss} />
        ))}

        {chips.map((c) => (
          <div
            key={c.id}
            className="flex items-start gap-2 rounded-lg border border-dashed border-[var(--color-border-default)] px-2.5 py-2"
          >
            <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--color-warning-400)]" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-[var(--color-text-primary)]">{c.label}</p>
              {c.detail && <p className="text-[11px] text-[var(--color-text-muted)]">{c.detail}</p>}
            </div>
          </div>
        ))}
      </div>

      {showDeepCheck && onDeepCheck && (
        <button
          onClick={onDeepCheck}
          disabled={checking}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--color-primary-500)]/40 px-3 py-2 text-xs font-medium text-[var(--color-primary-400)] transition hover:bg-[var(--color-bg-hover)] disabled:opacity-50"
        >
          <Sparkles className="h-3.5 w-3.5" />
          {checking ? "Reading…" : "Deep voice + performance check"}
        </button>
      )}
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
  const style = CLASS_STYLE[finding.class];
  const canAccept = onAccept && finding.replacement !== undefined;
  return (
    <div className="rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] px-2.5 py-2">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full" style={{ background: style.color }} />
        <span className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: style.color }}>
          {style.label}
        </span>
        {!finding.span && (
          <span className="text-[10px] text-[var(--color-text-muted)]">· whole post</span>
        )}
      </div>
      <p className="mt-1 text-xs font-medium text-[var(--color-text-primary)]">{finding.title}</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">{finding.why}</p>
      {(canAccept || onDismiss) && (
        <div className="mt-1.5 flex items-center gap-2">
          {canAccept && (
            <button
              onClick={() => onAccept!(finding)}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)]"
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
