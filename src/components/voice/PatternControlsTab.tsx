"use client";

import { useState, useEffect } from "react";
import { Sparkles, TrendingUp, Clock, MessageSquare, Zap } from "lucide-react";

interface Pattern {
  id: string;
  pattern_type: string;
  pattern_name: string;
  pattern_value: string;
  confidence_score: number;
  sample_count: number;
  avg_engagement: number;
  multiplier: number;
  is_enabled: boolean;
  discovered_at: string;
}

const PATTERN_TYPE_ICONS: Record<string, React.ReactNode> = {
  hook_style: <MessageSquare className="w-4 h-4" />,
  format: <Sparkles className="w-4 h-4" />,
  timing: <Clock className="w-4 h-4" />,
  topic: <TrendingUp className="w-4 h-4" />,
  engagement_trigger: <Zap className="w-4 h-4" />,
};

const PATTERN_TYPE_LABELS: Record<string, string> = {
  hook_style: "Hook Style",
  format: "Format",
  timing: "Timing",
  topic: "Topic",
  engagement_trigger: "Engagement Trigger",
};

export function PatternControlsTab() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPatterns = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/patterns");
      if (res.ok) {
        const data = await res.json();
        setPatterns(data.patterns || []);
      }
    } catch (error) {
      console.error("Failed to fetch patterns:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatterns();
  }, []);

  const handleTogglePattern = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch(`/api/patterns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: !currentEnabled }),
      });

      if (res.ok) {
        setPatterns((prev) =>
          prev.map((p) =>
            p.id === id ? { ...p, is_enabled: !currentEnabled } : p
          )
        );
      }
    } catch (error) {
      console.error("Failed to toggle pattern:", error);
    }
  };

  // Group patterns by type
  const groupedPatterns = patterns.reduce((acc, pattern) => {
    const type = pattern.pattern_type;
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(pattern);
    return acc;
  }, {} as Record<string, Pattern[]>);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-slate-800 rounded w-48"></div>
        <div className="h-32 bg-slate-800 rounded"></div>
      </div>
    );
  }

  if (patterns.length === 0) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center">
          <Sparkles className="w-6 h-6 text-violet-400" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">No Patterns Extracted Yet</h3>
        <p className="text-slate-400 mb-4 max-w-md mx-auto">
          Patterns are extracted from your posts and watched accounts. Save more posts
          via the Chrome extension, then use the Extract Patterns feature on the Insights page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-medium text-white">Extracted Patterns</h3>
            <p className="text-sm text-slate-400 mt-1">
              Enable patterns to apply them when generating content from topics.
            </p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-full text-sm">
            <Sparkles className="w-4 h-4" />
            <span>{patterns.filter((p) => p.is_enabled).length} active</span>
          </div>
        </div>

        <div className="space-y-6">
          {Object.entries(groupedPatterns).map(([type, typePatterns]) => (
            <div key={type}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded bg-slate-800 flex items-center justify-center text-slate-400">
                  {PATTERN_TYPE_ICONS[type] || <Sparkles className="w-4 h-4" />}
                </div>
                <h4 className="text-sm font-medium text-slate-300">
                  {PATTERN_TYPE_LABELS[type] || type}
                </h4>
              </div>

              <div className="space-y-2">
                {typePatterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className={`flex items-start justify-between p-4 rounded-lg border transition-colors ${
                      pattern.is_enabled
                        ? "bg-slate-800/50 border-violet-500/30"
                        : "bg-slate-800/20 border-slate-700/50"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">
                          {pattern.pattern_name}
                        </span>
                        {pattern.multiplier > 1.2 && (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs font-medium">
                            {pattern.multiplier.toFixed(1)}x
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 line-clamp-2">
                        {pattern.pattern_value}
                      </p>
                      <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                        <span>Confidence: {Math.round(pattern.confidence_score * 100)}%</span>
                        <span>{pattern.sample_count} samples</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleTogglePattern(pattern.id, pattern.is_enabled)}
                      className={`relative ml-4 w-12 h-6 rounded-full transition-colors ${
                        pattern.is_enabled ? "bg-violet-500" : "bg-slate-600"
                      }`}
                    >
                      <span
                        className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          pattern.is_enabled ? "left-7" : "left-1"
                        }`}
                      />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-violet-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-300">
              Enabled patterns are automatically applied when you generate content from
              the Create page. The AI will try to incorporate these proven techniques.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
