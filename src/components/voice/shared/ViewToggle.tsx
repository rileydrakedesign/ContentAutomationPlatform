"use client";

import { Settings, MessageCircle } from "lucide-react";

export type ViewMode = "settings" | "editor";

interface ViewToggleProps {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
      <button
        onClick={() => onChange("settings")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
          value === "settings"
            ? "bg-slate-700 text-white"
            : "text-slate-400 hover:text-white hover:bg-slate-700/50"
        }`}
      >
        <Settings className="w-4 h-4" />
        Settings
      </button>
      <button
        onClick={() => onChange("editor")}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition ${
          value === "editor"
            ? "bg-slate-700 text-white"
            : "text-slate-400 hover:text-white hover:bg-slate-700/50"
        }`}
      >
        <MessageCircle className="w-4 h-4" />
        Voice Editor
      </button>
    </div>
  );
}
