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
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h3 className="text-lg font-medium text-white">Special Notes</h3>
          <p className="text-sm text-slate-400 mt-1">
            Custom instructions for the AI to follow when generating content.
          </p>
        </div>
        {isDirty && (
          <button
            onClick={handleSave}
            className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-sm rounded-lg transition-colors"
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
        className="w-full h-32 px-3 py-2 mt-3 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm placeholder-slate-500 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500"
      />

      <p className="text-xs text-slate-500 mt-2">
        These notes are included in every content generation prompt.
      </p>
    </div>
  );
}
