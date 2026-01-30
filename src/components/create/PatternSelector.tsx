"use client";

import { useState, useEffect } from "react";
import { Check, Sparkles, TrendingUp, Clock, MessageSquare, Zap } from "lucide-react";

interface Pattern {
  id: string;
  pattern_type: string;
  pattern_name: string;
  pattern_value: string;
  multiplier: number;
  is_enabled: boolean;
}

interface PatternSelectorProps {
  selectedPatterns: string[];
  onSelectionChange: (patternIds: string[]) => void;
}

const PATTERN_TYPE_ICONS: Record<string, React.ReactNode> = {
  hook_style: <MessageSquare className="w-3 h-3" />,
  format: <Sparkles className="w-3 h-3" />,
  timing: <Clock className="w-3 h-3" />,
  topic: <TrendingUp className="w-3 h-3" />,
  engagement_trigger: <Zap className="w-3 h-3" />,
};

export function PatternSelector({
  selectedPatterns,
  onSelectionChange,
}: PatternSelectorProps) {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPatterns = async () => {
      try {
        const res = await fetch("/api/patterns?enabled_only=true");
        if (res.ok) {
          const data = await res.json();
          setPatterns(data.patterns || []);
          // Auto-select top 3 patterns by default
          const topPatterns = (data.patterns || [])
            .sort((a: Pattern, b: Pattern) => b.multiplier - a.multiplier)
            .slice(0, 3)
            .map((p: Pattern) => p.id);
          if (selectedPatterns.length === 0) {
            onSelectionChange(topPatterns);
          }
        }
      } catch (error) {
        console.error("Failed to fetch patterns:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPatterns();
  }, []);

  const togglePattern = (patternId: string) => {
    if (selectedPatterns.includes(patternId)) {
      onSelectionChange(selectedPatterns.filter((id) => id !== patternId));
    } else {
      onSelectionChange([...selectedPatterns, patternId]);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 skeleton rounded-full w-24" />
          ))}
        </div>
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="p-4 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg">
        <p className="text-sm text-[var(--color-text-muted)]">
          No patterns available yet. Save posts and extract patterns on the Insights page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {patterns.map((pattern) => {
          const isSelected = selectedPatterns.includes(pattern.id);
          return (
            <button
              key={pattern.id}
              onClick={() => togglePattern(pattern.id)}
              className={`
                inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                transition-all duration-200 cursor-pointer
                ${isSelected
                  ? "bg-[var(--color-primary-500)] text-white shadow-[var(--shadow-glow-primary)]"
                  : "bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]"
                }
              `}
            >
              {isSelected ? (
                <Check className="w-3 h-3" />
              ) : (
                PATTERN_TYPE_ICONS[pattern.pattern_type] || <Sparkles className="w-3 h-3" />
              )}
              <span>{pattern.pattern_name}</span>
              {pattern.multiplier > 1.2 && (
                <span
                  className={`text-xs ${
                    isSelected ? "text-white/80" : "text-[var(--color-success-400)]"
                  }`}
                >
                  {pattern.multiplier.toFixed(1)}x
                </span>
              )}
            </button>
          );
        })}
      </div>

      {selectedPatterns.length > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {selectedPatterns.length} pattern{selectedPatterns.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
