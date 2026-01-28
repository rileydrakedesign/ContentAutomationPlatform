"use client";

import { ChatMessage as ChatMessageType, UserVoiceSettings } from "@/types/voice";
import { User, Bot, Check } from "lucide-react";

interface ChatMessageProps {
  message: ChatMessageType;
  onAcceptChanges?: (changes: Partial<UserVoiceSettings>) => void;
  changesAccepted?: boolean;
}

export function ChatMessage({ message, onAcceptChanges, changesAccepted }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? "bg-violet-600" : "bg-slate-700"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-slate-300" />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`flex-1 max-w-[80%] ${isUser ? "text-right" : ""}`}
      >
        <div
          className={`inline-block px-4 py-2 rounded-2xl text-sm ${
            isUser
              ? "bg-violet-600 text-white rounded-tr-sm"
              : "bg-slate-800 text-slate-200 rounded-tl-sm"
          }`}
        >
          {message.content}
        </div>

        {/* Sample content preview */}
        {!isUser && message.sampleContent && (
          <div className="mt-2 px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg">
            <p className="text-xs text-slate-500 mb-1">Preview:</p>
            <p className="text-sm text-slate-300 italic">
              "{message.sampleContent}"
            </p>
          </div>
        )}

        {/* Suggested changes */}
        {!isUser && message.suggestedChanges && Object.keys(message.suggestedChanges).length > 0 && (
          <div className="mt-2 px-4 py-3 bg-violet-500/10 border border-violet-500/20 rounded-lg">
            <p className="text-xs text-violet-400 mb-2">Suggested changes:</p>
            <div className="space-y-1 text-xs text-slate-400">
              {Object.entries(message.suggestedChanges).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-slate-500">{formatSettingKey(key)}:</span>
                  <span className="text-slate-300">{formatSettingValue(key, value)}</span>
                </div>
              ))}
            </div>
            {onAcceptChanges && (
              <button
                onClick={() => onAcceptChanges(message.suggestedChanges!)}
                disabled={changesAccepted}
                className={`mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  changesAccepted
                    ? "bg-green-500/20 text-green-400 cursor-default"
                    : "bg-violet-600 hover:bg-violet-500 text-white"
                }`}
              >
                {changesAccepted ? (
                  <>
                    <Check className="w-4 h-4" />
                    Applied
                  </>
                ) : (
                  "Accept Changes"
                )}
              </button>
            )}
          </div>
        )}

        {/* Timestamp */}
        <p className={`text-xs text-slate-600 mt-1 ${isUser ? "text-right" : ""}`}>
          {new Date(message.timestamp).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}

function formatSettingKey(key: string): string {
  const labels: Record<string, string> = {
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
  return labels[key] || key;
}

function formatSettingValue(key: string, value: unknown): string {
  if (typeof value === "number") {
    return String(value);
  }
  if (typeof value === "string") {
    return value;
  }
  return String(value);
}
