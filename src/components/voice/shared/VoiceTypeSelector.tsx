"use client";

import { VoiceType } from "@/types/voice";
import { MessageSquare, FileText } from "lucide-react";

interface VoiceTypeSelectorProps {
  value: VoiceType;
  onChange: (type: VoiceType) => void;
}

export function VoiceTypeSelector({ value, onChange }: VoiceTypeSelectorProps) {
  return (
    <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
      <button
        onClick={() => onChange("post")}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition ${
          value === "post"
            ? "bg-violet-600 text-white"
            : "text-slate-400 hover:text-white hover:bg-slate-700/50"
        }`}
      >
        <FileText className="w-4 h-4" />
        Post Voice
      </button>
      <button
        onClick={() => onChange("reply")}
        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm transition ${
          value === "reply"
            ? "bg-violet-600 text-white"
            : "text-slate-400 hover:text-white hover:bg-slate-700/50"
        }`}
      >
        <MessageSquare className="w-4 h-4" />
        Reply Voice
      </button>
    </div>
  );
}
