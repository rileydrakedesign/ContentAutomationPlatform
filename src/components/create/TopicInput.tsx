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
      <div>
        <label className="block text-sm font-medium text-slate-200 mb-2">
          What do you want to write about?
        </label>
        <div className="relative">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Enter your topic or idea..."
            rows={3}
            className={`w-full px-4 py-3 bg-slate-800 border rounded-lg text-white placeholder-slate-500 resize-none transition-all focus:outline-none focus:ring-2 focus:ring-violet-500 ${
              isFocused ? "border-violet-500" : "border-slate-700"
            }`}
          />
          <div className="absolute bottom-3 right-3 flex items-center gap-1 text-xs text-slate-500">
            <Sparkles className="w-3 h-3" />
            <span>AI-powered</span>
          </div>
        </div>
      </div>

      {!value && (
        <div>
          <p className="text-xs text-slate-500 mb-2">Suggested topics:</p>
          <div className="flex flex-wrap gap-2">
            {displaySuggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => onChange(suggestion)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-600 rounded-full text-sm text-slate-300 transition-colors"
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
