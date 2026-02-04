"use client";

import { useState, KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { X, Plus, SkipForward } from "lucide-react";

interface GuardrailsInputProps {
  onSubmit: (words: string[]) => void;
  onSkip: () => void;
  disabled?: boolean;
}

export function GuardrailsInput({
  onSubmit,
  onSkip,
  disabled = false,
}: GuardrailsInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [words, setWords] = useState<string[]>([]);

  const addWord = () => {
    const trimmed = inputValue.trim().toLowerCase();
    if (trimmed && !words.includes(trimmed)) {
      setWords((prev) => [...prev, trimmed]);
      setInputValue("");
    }
  };

  const removeWord = (word: string) => {
    setWords((prev) => prev.filter((w) => w !== word));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      addWord();
    }
  };

  const handleDone = () => {
    onSubmit(words);
  };

  return (
    <div className="mt-3 p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-xl">
      <p className="text-sm text-[var(--color-text-secondary)] mb-3">
        Add words or phrases you want to avoid in your content:
      </p>

      {/* Input row */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., synergy, leverage..."
            disabled={disabled}
          />
        </div>
        <Button
          onClick={addWord}
          disabled={disabled || !inputValue.trim()}
          size="md"
          variant="secondary"
          icon={<Plus className="w-4 h-4" />}
        >
          Add
        </Button>
      </div>

      {/* Tags display */}
      {words.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {words.map((word) => (
            <span
              key={word}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-sm bg-[var(--color-danger-500)]/10 text-[var(--color-danger-400)] border border-[var(--color-danger-500)]/20 rounded-full"
            >
              {word}
              <button
                onClick={() => removeWord(word)}
                disabled={disabled}
                className="hover:text-[var(--color-danger-300)] transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          onClick={handleDone}
          disabled={disabled}
          size="sm"
          className="flex-1"
        >
          {words.length > 0 ? "Done" : "Continue Without Adding"}
        </Button>
        <button
          onClick={onSkip}
          disabled={disabled}
          className="flex items-center gap-1.5 text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors disabled:opacity-50"
        >
          <SkipForward className="w-3.5 h-3.5" />
          Skip
        </button>
      </div>
    </div>
  );
}
