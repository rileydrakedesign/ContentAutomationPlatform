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
      <div className="animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-32 mb-3"></div>
        <div className="flex gap-2">
          <div className="h-8 bg-slate-800 rounded-full w-24"></div>
          <div className="h-8 bg-slate-800 rounded-full w-28"></div>
          <div className="h-8 bg-slate-800 rounded-full w-20"></div>
        </div>
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
        <p className="text-sm text-slate-400">
          No patterns available yet. Save posts and extract patterns on the Insights page.
        </p>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-medium text-slate-200 mb-2">
        Apply patterns:
      </label>
      <div className="flex flex-wrap gap-2">
        {patterns.map((pattern) => {
          const isSelected = selectedPatterns.includes(pattern.id);
          return (
            <button
              key={pattern.id}
              onClick={() => togglePattern(pattern.id)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                isSelected
                  ? "bg-violet-500 text-white"
                  : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
              }`}
            >
              {isSelected ? (
                <Check className="w-3 h-3" />
              ) : (
                PATTERN_TYPE_ICONS[pattern.pattern_type] || (
                  <Sparkles className="w-3 h-3" />
                )
              )}
              <span>{pattern.pattern_name}</span>
              {pattern.multiplier > 1.2 && (
                <span
                  className={`text-xs ${
                    isSelected ? "text-violet-200" : "text-green-400"
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
        <p className="text-xs text-slate-500 mt-2">
          {selectedPatterns.length} pattern{selectedPatterns.length !== 1 ? "s" : ""} selected
        </p>
      )}
    </div>
  );
}
