"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Sparkles, Loader2, RefreshCw, MessageSquare, Clock, TrendingUp, Zap } from "lucide-react";

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
  hook_style: "Hook Styles",
  format: "Formats",
  timing: "Timing",
  topic: "Topics",
  engagement_trigger: "Engagement Triggers",
};

const PATTERN_TYPE_COLORS: Record<string, string> = {
  hook_style: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  format: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  timing: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  topic: "bg-green-500/10 text-green-400 border-green-500/20",
  engagement_trigger: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function PatternsTab() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);

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

  const handleExtractPatterns = async () => {
    setExtracting(true);
    try {
      const res = await fetch("/api/patterns/extract", {
        method: "POST",
      });

      if (res.ok) {
        await fetchPatterns();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to extract patterns");
      }
    } catch (error) {
      console.error("Failed to extract patterns:", error);
    } finally {
      setExtracting(false);
    }
  };

  const handleTogglePattern = async (id: string, currentEnabled: boolean) => {
    try {
      const res = await fetch(`/api/patterns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_enabled: !currentEnabled }),
      });

      if (res.ok) {
        setPatterns((prev) =>
          prev.map((p) => (p.id === id ? { ...p, is_enabled: !currentEnabled } : p))
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
        <div className="h-12 bg-slate-800 rounded-lg w-48"></div>
        <div className="h-64 bg-slate-800 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Extract Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-white">Extracted Patterns</h3>
          <p className="text-sm text-slate-400 mt-1">
            Patterns discovered from your posts
          </p>
        </div>
        <button
          onClick={handleExtractPatterns}
          disabled={extracting}
          className="flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 disabled:bg-slate-700 text-white rounded-lg font-medium transition-colors"
        >
          {extracting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Extracting...</span>
            </>
          ) : (
            <>
              <RefreshCw className="w-4 h-4" />
              <span>Extract Patterns</span>
            </>
          )}
        </button>
      </div>

      {patterns.length === 0 ? (
        <Card className="p-8 text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-violet-500/10 flex items-center justify-center">
            <Sparkles className="w-6 h-6 text-violet-400" />
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No Patterns Yet</h3>
          <p className="text-slate-400 mb-4 max-w-md mx-auto">
            Save at least 5 posts using the Chrome extension, then click &quot;Extract Patterns&quot;
            to discover what&apos;s working.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedPatterns).map(([type, typePatterns]) => (
            <Card key={type} className="p-4">
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${PATTERN_TYPE_COLORS[type] || "bg-slate-700"}`}>
                  {PATTERN_TYPE_ICONS[type] || <Sparkles className="w-4 h-4" />}
                </div>
                <h4 className="font-medium text-white">
                  {PATTERN_TYPE_LABELS[type] || type}
                </h4>
                <span className="text-xs text-slate-500">
                  ({typePatterns.length})
                </span>
              </div>

              <div className="space-y-3">
                {typePatterns.map((pattern) => (
                  <div
                    key={pattern.id}
                    className={`flex items-start justify-between p-4 rounded-lg border transition-colors ${
                      pattern.is_enabled
                        ? "bg-slate-800/50 border-slate-700"
                        : "bg-slate-800/20 border-slate-800 opacity-60"
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-white">
                          {pattern.pattern_name}
                        </span>
                        {pattern.multiplier > 1.2 && (
                          <span className="px-2 py-0.5 bg-green-500/10 text-green-400 rounded-full text-xs font-medium">
                            {pattern.multiplier.toFixed(1)}x engagement
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mb-2">
                        {pattern.pattern_value}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span>
                          Confidence: {Math.max(0, Math.min(100, Math.round(pattern.confidence_score)))}%
                        </span>
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
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
