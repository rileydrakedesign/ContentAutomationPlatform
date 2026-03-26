"use client";

import { useState } from "react";
import { UserVoiceSettings, VoiceType } from "@/types/voice";
import { RefreshCw, Sparkles } from "lucide-react";

interface SettingsPreviewProps {
  settings: UserVoiceSettings;
  voiceType: VoiceType;
}

export function SettingsPreview({ settings, voiceType }: SettingsPreviewProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const generatePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/voice/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_type: voiceType }),
      });

      if (res.ok) {
        const data = await res.json();
        setPreview(data.preview);
      }
    } catch (err) {
      console.error("Failed to generate preview:", err);
    } finally {
      setLoading(false);
    }
  };

  const getDialLabel = (value: number, lowLabel: string, highLabel: string) => {
    if (value < 30) return lowLabel;
    if (value > 70) return highLabel;
    return "Balanced";
  };

  return (
    <div className="bg-[var(--color-bg-base)] border border-[var(--color-border-default)] rounded-lg p-4 space-y-4">
      <h3 className="text-sm font-medium text-[var(--color-text-primary)]">Current Settings</h3>

      {/* Dials summary */}
      <div className="space-y-2">
        <SettingRow
          label="Optimization"
          value={settings.optimization_authenticity}
          displayValue={getDialLabel(settings.optimization_authenticity, "Authentic", "Optimized")}
        />
        <SettingRow
          label="Tone"
          value={settings.tone_formal_casual}
          displayValue={getDialLabel(settings.tone_formal_casual, "Formal", "Casual")}
        />
        <SettingRow
          label="Energy"
          value={settings.energy_calm_punchy}
          displayValue={getDialLabel(settings.energy_calm_punchy, "Calm", "Punchy")}
        />
        <SettingRow
          label="Stance"
          value={settings.stance_neutral_opinionated}
          displayValue={getDialLabel(settings.stance_neutral_opinionated, "Neutral", "Opinionated")}
        />
      </div>

      {/* Mode settings */}
      <div className="pt-2 border-t border-[var(--color-border-default)] space-y-1">
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">Length</span>
          <span className="text-[var(--color-text-secondary)] capitalize">{settings.length_mode}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">Humor</span>
          <span className="text-[var(--color-text-secondary)] capitalize">{settings.humor_mode}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-[var(--color-text-muted)]">Emojis</span>
          <span className="text-[var(--color-text-secondary)] capitalize">{settings.emoji_mode}</span>
        </div>
      </div>

      {/* Preview section */}
      <div className="pt-2 border-t border-[var(--color-border-default)]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-[var(--color-text-primary)]">Preview</span>
          <button
            onClick={generatePreview}
            disabled={loading}
            className="flex items-center gap-1 text-xs text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            {loading ? "Generating..." : "Generate"}
          </button>
        </div>

        {preview ? (
          <div className="p-3 bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]/50 rounded-lg">
            <p className="text-sm text-[var(--color-text-secondary)] italic">"{preview}"</p>
          </div>
        ) : (
          <div className="p-3 bg-[var(--color-bg-elevated)]/30 border border-dashed border-[var(--color-border-default)] rounded-lg text-center">
            <p className="text-xs text-[var(--color-text-muted)]">
              Click generate to see how your voice sounds
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

interface SettingRowProps {
  label: string;
  value: number;
  displayValue: string;
}

function SettingRow({ label, value, displayValue }: SettingRowProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-[var(--color-text-muted)] w-20">{label}</span>
      <div className="flex-1 h-1.5 bg-[var(--color-bg-elevated)] rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-400)] rounded-full transition-all"
          style={{ width: `${value}%` }}
        />
      </div>
      <span className="text-xs text-[var(--color-text-secondary)] w-20 text-right">{displayValue}</span>
    </div>
  );
}
