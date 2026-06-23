"use client";

import { Button } from "@/components/ui/Button";
import { AudioLines } from "lucide-react";
import { useVoiceCheck } from "./useVoiceCheck";
import { VoiceCheckResult } from "./VoiceCheckResult";

interface VoiceCheckPanelProps {
  /** Current draft text to check */
  text: string;
  /** Voice context — "post" (default) or "reply" */
  voiceType?: "post" | "reply";
  /** Called with the suggested edit when the user clicks "Apply edit" */
  onApplyEdit?: (newText: string) => void;
  className?: string;
}

export function VoiceCheckPanel({
  text,
  voiceType = "post",
  onApplyEdit,
  className = "",
}: VoiceCheckPanelProps) {
  const { checking, result, checkedText, error, check, markChecked } = useVoiceCheck(voiceType);

  const handleApply = (newText: string) => {
    onApplyEdit?.(newText);
    markChecked(newText);
  };

  return (
    <div className={className}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => check(text)}
        disabled={!text.trim()}
        icon={<AudioLines className="w-4 h-4 text-[var(--color-primary-400)]" />}
        loading={checking}
      >
        Voice check
      </Button>

      {error && (
        <div className="mt-3 rounded-xl border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5 px-4 py-3">
          <p className="text-sm text-[var(--color-danger-400)]">{error}</p>
        </div>
      )}

      {result && (
        <VoiceCheckResult
          result={result}
          currentText={text}
          checkedText={checkedText}
          onApplyEdit={onApplyEdit ? handleApply : undefined}
          className="mt-3"
        />
      )}
    </div>
  );
}
