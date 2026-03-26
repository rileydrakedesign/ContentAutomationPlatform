"use client";

import { Settings, MessageCircle } from "lucide-react";

export type ViewMode = "settings" | "editor";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 bg-[var(--color-bg-elevated)]/50 p-1 rounded-lg">
      <button
        onClick={() => onChange("settings")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
          value === "settings"
            ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]/50"
        }`}
      >
        <Settings className="w-4 h-4" />
        Settings
      </button>
      <button
        onClick={() => onChange("editor")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
          value === "editor"
            ? "bg-[var(--color-bg-hover)] text-[var(--color-text-primary)]"
            : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-hover)]/50"
        }`}
      >
        <MessageCircle className="w-4 h-4" />
        Voice Editor
      </button>
    </div>
  );
}
