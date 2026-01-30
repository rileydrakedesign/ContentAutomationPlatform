"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";

interface TopicInputProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: string[];
}

export function TopicInput({ value, onChange, suggestions = [] }: TopicInputProps) {
  const [isFocused, setIsFocused] = useState(false);

  const defaultSuggestions = [
    "Building in public updates",
    "AI tools and workflows",
    "Lessons learned this week",
    "Hot takes on industry trends",
    "Behind the scenes content",
  ];

  const displaySuggestions = suggestions.length > 0 ? suggestions : defaultSuggestions;

  return (
    <div className="space-y-4">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Enter your topic or idea..."
          rows={3}
          className={`
            w-full px-4 py-3 text-sm resize-none transition-all duration-200
            ${isFocused ? "ring-2 ring-[var(--color-primary-500)]/20" : ""}
          `}
        />
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
          <Sparkles className="w-3 h-3" />
          <span>AI-powered</span>
        </div>
      </div>

      {!value && (
        <div>
          <p className="text-xs text-[var(--color-text-muted)] mb-2">Quick suggestions:</p>
          <div className="flex flex-wrap gap-2">
            {displaySuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onChange(suggestion)}
                className="
                  px-3 py-1.5 text-xs font-medium rounded-full
                  bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)]
                  border border-[var(--color-border-default)]
                  hover:border-[var(--color-primary-500)]/50 hover:text-[var(--color-primary-400)]
                  transition-all duration-200 cursor-pointer
                "
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
