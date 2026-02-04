"use client";

import { UserVoiceSettings } from "@/types/voice";
import { Button } from "@/components/ui/Button";
import { Check, Edit3 } from "lucide-react";

interface ProposedChangesCardProps {
  changes: Partial<UserVoiceSettings>;
  onAccept: () => void;
  onModify: () => void;
  disabled?: boolean;
}

const settingLabels: Record<string, string> = {
  optimization_authenticity: "Optimization",
  tone_formal_casual: "Tone",
  energy_calm_punchy: "Energy",
  stance_neutral_opinionated: "Stance",
  length_mode: "Length",
  directness_mode: "Directness",
  humor_mode: "Humor",
  emoji_mode: "Emojis",
  question_rate: "Questions",
  disagreement_mode: "Disagreement",
  special_notes: "Special Notes",
};

const dialDescriptions: Record<string, { low: string; high: string }> = {
  optimization_authenticity: { low: "Authentic", high: "Optimized" },
  tone_formal_casual: { low: "Formal", high: "Casual" },
  energy_calm_punchy: { low: "Calm", high: "Punchy" },
  stance_neutral_opinionated: { low: "Neutral", high: "Opinionated" },
};

function formatValue(key: string, value: unknown): string {
  if (typeof value === "number" && dialDescriptions[key]) {
    const desc = dialDescriptions[key];
    if (value < 35) return `${value} (${desc.low})`;
    if (value > 65) return `${value} (${desc.high})`;
    return `${value} (Balanced)`;
  }
  if (typeof value === "string") {
    return value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  return String(value);
}

export function ProposedChangesCard({
  changes,
  onAccept,
  onModify,
  disabled = false,
}: ProposedChangesCardProps) {
  const changeEntries = Object.entries(changes).filter(
    ([key]) => key !== "voice_type" && key !== "id" && key !== "user_id"
  );

  if (changeEntries.length === 0) {
    return null;
  }

  return (
    <div className="mt-3 p-4 bg-[var(--color-primary-500)]/10 border border-[var(--color-primary-500)]/20 rounded-xl">
      <p className="text-xs font-medium text-[var(--color-primary-400)] mb-3">
        Proposed settings changes:
      </p>
      <div className="space-y-2 mb-4">
        {changeEntries.map(([key, value]) => (
          <div
            key={key}
            className="flex items-center justify-between text-sm"
          >
            <span className="text-[var(--color-text-muted)]">
              {settingLabels[key] || key}
            </span>
            <span className="text-[var(--color-text-primary)] font-medium">
              {formatValue(key, value)}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <Button
          onClick={onAccept}
          disabled={disabled}
          size="sm"
          icon={<Check className="w-3.5 h-3.5" />}
          className="flex-1"
        >
          Accept
        </Button>
        <button
          onClick={onModify}
          disabled={disabled}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors disabled:opacity-50"
        >
          <Edit3 className="w-3.5 h-3.5" />
          Modify
        </button>
      </div>
    </div>
  );
}
