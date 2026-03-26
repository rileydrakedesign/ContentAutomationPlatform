"use client";

import { ChatMessage as ChatMessageType, UserVoiceSettings, VoiceType } from "@/types/voice";
import { User, Bot, Check } from "lucide-react";
import { ProposedChangesCard } from "./ProposedChangesCard";
import { GuardrailsInput } from "./GuardrailsInput";
import { SampleInputPrompt } from "./SampleInputPrompt";

interface ChatMessageProps {
  message: ChatMessageType;
  voiceType: VoiceType;
  onAcceptChanges?: (changes: Partial<UserVoiceSettings>) => void;
  onModifyChanges?: () => void;
  onGuardrailsSubmit?: (words: string[]) => void;
  onGuardrailsSkip?: () => void;
  onSampleInputSubmit?: (input: string) => void;
  changesAccepted?: boolean;
  actionDisabled?: boolean;
}

export function ChatMessage({
  message,
  voiceType,
  onAcceptChanges,
  onModifyChanges,
  onGuardrailsSubmit,
  onGuardrailsSkip,
  onSampleInputSubmit,
  changesAccepted,
  actionDisabled = false,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
          isUser ? "bg-[var(--color-primary-500)]" : "bg-[var(--color-bg-hover)]"
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-[var(--color-text-primary)]" />
        ) : (
          <Bot className="w-4 h-4 text-[var(--color-text-secondary)]" />
        )}
      </div>

      {/* Message bubble */}
      <div className={`flex-1 max-w-[80%] ${isUser ? "text-right" : ""}`}>
        <div
          className={`inline-block px-4 py-2 rounded-2xl text-sm ${
            isUser
              ? "bg-[var(--color-primary-500)] text-[var(--color-text-primary)] rounded-tr-sm"
              : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] rounded-tl-sm"
          }`}
        >
          {message.content}
        </div>

        {/* Sample content preview */}
        {!isUser && message.sampleContent && (
          <div className="mt-2 px-4 py-3 bg-[var(--color-bg-elevated)]/50 border border-[var(--color-border-default)]/50 rounded-lg">
            <p className="text-xs text-[var(--color-text-muted)] mb-1">Sample {voiceType}:</p>
            <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
              {message.sampleContent}
            </p>
          </div>
        )}

        {/* Stage-specific UI based on requiresAction */}
        {!isUser && message.requiresAction === "accept_changes" && message.pendingChanges && (
          changesAccepted ? (
            <div className="mt-3 p-4 bg-[var(--color-success-500)]/10 border border-[var(--color-success-500)]/20 rounded-xl">
              <div className="flex items-center gap-2 text-[var(--color-success-400)]">
                <Check className="w-4 h-4" />
                <span className="text-sm font-medium">Changes accepted</span>
              </div>
            </div>
          ) : (
            <ProposedChangesCard
              changes={message.pendingChanges}
              onAccept={() => onAcceptChanges?.(message.pendingChanges!)}
              onModify={() => onModifyChanges?.()}
              disabled={actionDisabled}
            />
          )
        )}

        {!isUser && message.requiresAction === "provide_guardrails" && (
          <GuardrailsInput
            onSubmit={(words) => onGuardrailsSubmit?.(words)}
            onSkip={() => onGuardrailsSkip?.()}
            disabled={actionDisabled}
          />
        )}

        {!isUser && message.requiresAction === "provide_input" && (
          <SampleInputPrompt
            voiceType={voiceType}
            onSubmit={(input) => onSampleInputSubmit?.(input)}
            disabled={actionDisabled}
          />
        )}

        {/* Legacy suggested changes (for backward compatibility) */}
        {!isUser &&
          !message.requiresAction &&
          message.suggestedChanges &&
          Object.keys(message.suggestedChanges).length > 0 && (
            <div className="mt-2 px-4 py-3 bg-[var(--color-primary-500)]/10 border border-[var(--color-primary-500)]/20 rounded-lg">
              <p className="text-xs text-[var(--color-primary-400)] mb-2">Suggested changes:</p>
              <div className="space-y-1 text-xs text-[var(--color-text-secondary)]">
                {Object.entries(message.suggestedChanges).map(([key, value]) => (
                  <div key={key} className="flex items-center justify-between">
                    <span className="text-[var(--color-text-muted)]">{formatSettingKey(key)}:</span>
                    <span className="text-[var(--color-text-secondary)]">{formatSettingValue(key, value)}</span>
                  </div>
                ))}
              </div>
              {onAcceptChanges && (
                <button
                  onClick={() => onAcceptChanges(message.suggestedChanges!)}
                  disabled={changesAccepted}
                  className={`mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    changesAccepted
                      ? "bg-[var(--color-success-500)]/20 text-[var(--color-success-400)] cursor-default"
                      : "bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] text-[var(--color-text-primary)]"
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
        <p className={`text-xs text-[var(--color-text-muted)] mt-1 ${isUser ? "text-right" : ""}`}>
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
