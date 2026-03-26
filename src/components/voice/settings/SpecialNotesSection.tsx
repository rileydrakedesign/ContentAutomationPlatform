"use client";

import { useState, useEffect } from "react";
import { UserVoiceSettings } from "@/types/voice";

interface SpecialNotesSectionProps {
  settings: UserVoiceSettings;
  onSettingsUpdate: (updates: Partial<UserVoiceSettings>) => Promise<void>;
}

export function SpecialNotesSection({ settings, onSettingsUpdate }: SpecialNotesSectionProps) {
  const [notes, setNotes] = useState(settings.special_notes || "");
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setNotes(settings.special_notes || "");
    setIsDirty(false);
  }, [settings.special_notes]);

  const handleChange = (value: string) => {
    setNotes(value);
    setIsDirty(value !== (settings.special_notes || ""));
  };

  const handleSave = async () => {
    await onSettingsUpdate({ special_notes: notes || null });
    setIsDirty(false);
  };

  return (
    <div className="bg-[var(--color-bg-base)] border border-[var(--color-border-default)] rounded-lg p-4">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Special Notes</h3>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Custom instructions for the AI to follow when generating content.
          </p>
        </div>
        {isDirty && (
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-medium rounded-md transition"
          >
            Save
          </button>
        )}
      </div>

      <textarea
        value={notes}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => isDirty && handleSave()}
        placeholder="e.g., Always mention our product when relevant. Never use first person plural. Reference industry trends when possible."
        className="w-full h-28 px-3 py-2 mt-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-md text-[var(--color-text-primary)] text-sm placeholder-[var(--color-text-muted)] resize-none focus:outline-none focus:border-[var(--color-primary-500)]"
      />

      <p className="text-xs text-[var(--color-text-muted)] mt-1.5">
        These notes are included in every content generation prompt.
      </p>
    </div>
  );
}
