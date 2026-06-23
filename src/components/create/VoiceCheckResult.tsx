"use client";

import { Button } from "@/components/ui/Button";
import { Check, AlertTriangle, Wand2 } from "lucide-react";
import type { VoiceCheckResult as VoiceCheckResultData } from "./useVoiceCheck";

function scoreColor(score: number): string {
  if (score >= 80) return "text-[var(--color-success-400)]";
  if (score >= 60) return "text-[var(--color-warning-400)]";
  return "text-[var(--color-danger-400)]";
}

function scoreBorder(score: number): string {
  if (score >= 80) return "border-[var(--color-success-500)]/30";
  if (score >= 60) return "border-[var(--color-warning-500)]/30";
  return "border-[var(--color-danger-500)]/30";
}

interface VoiceCheckResultProps {
  result: VoiceCheckResultData;
  /** Current editor text — used to flag the result as stale if it changed. */
  currentText: string;
  /** The text the result was computed against. */
  checkedText: string | null;
  onApplyEdit?: (newText: string) => void;
  className?: string;
}

/**
 * Presentational voice-match panel: score, what's working, drifts, suggested
 * edit with one-click apply. Shared by VoiceCheckPanel and the draft editor's
 * check-gated publish so the result looks identical everywhere it appears.
 */
export function VoiceCheckResult({
  result,
  currentText,
  checkedText,
  onApplyEdit,
  className = "",
}: VoiceCheckResultProps) {
  const isStale = checkedText !== null && currentText !== checkedText;
  const showSuggestedEdit =
    result.suggested_edit.trim().length > 0 && result.suggested_edit !== currentText;

  return (
    <div
      className={`rounded-xl border ${scoreBorder(result.score)} bg-[var(--color-bg-elevated)] p-4 space-y-4 ${className}`}
    >
      {/* Score */}
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-semibold ${scoreColor(result.score)}`}>
          {result.score}/100
        </span>
        <span className="text-sm text-[var(--color-text-secondary)]">voice match</span>
        {isStale && (
          <span className="text-xs text-[var(--color-text-muted)] ml-auto">
            text changed since last check
          </span>
        )}
      </div>

      {/* What's working */}
      {result.matches.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
            What&apos;s working
          </h4>
          <ul className="space-y-1">
            {result.matches.map((m, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-text-secondary)]">
                <Check className="w-3.5 h-3.5 text-[var(--color-success-400)] shrink-0 mt-0.5" />
                <span>{m}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Drifts from your voice */}
      {result.deviations.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
            Drifts from your voice
          </h4>
          <ul className="space-y-1">
            {result.deviations.map((d, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-[var(--color-text-secondary)]">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--color-warning-400)] shrink-0 mt-0.5" />
                <span>{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Suggested edit */}
      {showSuggestedEdit && (
        <div className="pt-3 border-t border-[var(--color-border-subtle)]">
          <h4 className="text-xs font-semibold text-[var(--color-text-primary)] mb-1.5">
            Suggested edit
          </h4>
          <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap mb-3">
            {result.suggested_edit}
          </p>
          {onApplyEdit && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => onApplyEdit(result.suggested_edit)}
              icon={<Wand2 className="w-4 h-4 text-[var(--color-primary-400)]" />}
            >
              Apply edit
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
