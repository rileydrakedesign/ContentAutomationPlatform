"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { AudioLines, Check, AlertTriangle, Wand2 } from "lucide-react";
import { parseGateError } from "@/lib/utils/gate-error";

interface VoiceCheckResult {
  score: number;
  matches: string[];
  deviations: string[];
  suggested_edit: string;
}

interface VoiceCheckPanelProps {
  /** Current draft text to check */
  text: string;
  /** Voice context — "post" (default) or "reply" */
  voiceType?: "post" | "reply";
  /** Called with the suggested edit when the user clicks "Apply edit" */
  onApplyEdit?: (newText: string) => void;
  className?: string;
}

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

export function VoiceCheckPanel({
  text,
  voiceType = "post",
  onApplyEdit,
  className = "",
}: VoiceCheckPanelProps) {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VoiceCheckResult | null>(null);
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheck = async () => {
    if (!text.trim()) return;

    setChecking(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/voice/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice_type: voiceType }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const gateErr = parseGateError(res.status, data);
        if (gateErr) {
          setError(gateErr.message);
        } else {
          setError(data.error || "Failed to check voice match");
        }
        return;
      }

      setResult(data as VoiceCheckResult);
      setCheckedText(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check voice match");
    } finally {
      setChecking(false);
    }
  };

  const handleApply = () => {
    if (result?.suggested_edit && onApplyEdit) {
      onApplyEdit(result.suggested_edit);
      setCheckedText(result.suggested_edit);
    }
  };

  const isStale = result !== null && checkedText !== null && text !== checkedText;
  const showSuggestedEdit =
    result !== null && result.suggested_edit.trim().length > 0 && result.suggested_edit !== text;

  return (
    <div className={className}>
      <Button
        variant="secondary"
        size="sm"
        onClick={handleCheck}
        disabled={!text.trim()}
        icon={<AudioLines className="w-4 h-4 text-[var(--color-primary-400)]" />}
        loading={checking}
      >
        Voice check
      </Button>

      {/* Error Display */}
      {error && (
        <div className="mt-3 rounded-xl border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5 px-4 py-3">
          <p className="text-sm text-[var(--color-danger-400)]">{error}</p>
        </div>
      )}

      {/* Result Panel */}
      {result && (
        <div
          className={`mt-3 rounded-xl border ${scoreBorder(result.score)} bg-[var(--color-bg-elevated)] p-4 space-y-4`}
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
                  onClick={handleApply}
                  icon={<Wand2 className="w-4 h-4 text-[var(--color-primary-400)]" />}
                >
                  Apply edit
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
