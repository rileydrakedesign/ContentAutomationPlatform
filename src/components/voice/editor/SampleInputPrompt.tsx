"use client";

import { useState } from "react";
import { VoiceType } from "@/types/voice";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import { Send, FileText, MessageSquare } from "lucide-react";

interface SampleInputPromptProps {
  voiceType: VoiceType;
  onSubmit: (input: string) => void;
  disabled?: boolean;
}

export function SampleInputPrompt({
  voiceType,
  onSubmit,
  disabled = false,
}: SampleInputPromptProps) {
  const [inputValue, setInputValue] = useState("");

  const isPost = voiceType === "post";
  const placeholder = isPost
    ? "Describe a topic or outline for a sample post...\n\nExample: hot take about AI replacing developers"
    : "Paste a post you'd like to generate a sample reply to...";

  const label = isPost
    ? "What should I write about?"
    : "What post should I reply to?";

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSubmit(inputValue.trim());
    }
  };

  return (
    <div className="mt-3 p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-xl">
      <div className="flex items-center gap-2 mb-3">
        {isPost ? (
          <FileText className="w-4 h-4 text-[var(--color-primary-400)]" />
        ) : (
          <MessageSquare className="w-4 h-4 text-[var(--color-primary-400)]" />
        )}
        <p className="text-sm font-medium text-[var(--color-text-primary)]">
          {label}
        </p>
      </div>

      <Textarea
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder={placeholder}
        rows={4}
        disabled={disabled}
        className="mb-3"
      />

      <Button
        onClick={handleSubmit}
        disabled={disabled || !inputValue.trim()}
        size="sm"
        icon={<Send className="w-3.5 h-3.5" />}
        fullWidth
      >
        Generate Sample {isPost ? "Post" : "Reply"}
      </Button>
    </div>
  );
}
