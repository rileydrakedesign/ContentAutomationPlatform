"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Sparkles, TrendingUp, Clock, Zap, ArrowRight, Lightbulb } from "lucide-react";

interface Suggestion {
  id: string;
  type: "pattern" | "timing" | "topic" | "action";
  title: string;
  description: string;
  impact: string;
  action?: string;
  patternId?: string;
}

interface Stats {
  totalPatterns: number;
  avgViews: number;
  avgLikes: number;
  postsAnalyzed: number;
}

const SUGGESTION_ICONS: Record<string, React.ReactNode> = {
  pattern: <Sparkles className="w-5 h-5" />,
  timing: <Clock className="w-5 h-5" />,
  topic: <TrendingUp className="w-5 h-5" />,
  action: <Zap className="w-5 h-5" />,
};

const SUGGESTION_COLORS: Record<string, string> = {
  pattern: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  timing: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  topic: "bg-green-500/10 text-green-400 border-green-500/20",
  action: "bg-amber-500/10 text-amber-400 border-amber-500/20",
};

export function SuggestionsTab() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSuggestions() {
      try {
        const res = await fetch("/api/patterns/suggestions");
        if (res.ok) {
          const data = await res.json();
          setSuggestions(data.suggestions || []);
          setStats(data.stats || null);
        }
      } catch (error) {
        console.error("Failed to fetch suggestions:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchSuggestions();
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-slate-800 rounded-lg"></div>
        <div className="h-32 bg-slate-800 rounded-lg"></div>
      </div>
    );
  }

  if (suggestions.length === 0) {
    return (
      <Card className="p-8 text-center">
        <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-amber-500/10 flex items-center justify-center">
          <Lightbulb className="w-6 h-6 text-amber-400" />
        </div>
        <h3 className="text-lg font-medium text-white mb-2">
          No Suggestions Yet
        </h3>
        <p className="text-slate-400 mb-4 max-w-md mx-auto">
          Extract patterns from your posts to receive personalized suggestions
          for improving engagement.
        </p>
        <Link
          href="/insights?tab=patterns"
          className="inline-flex items-center gap-2 px-4 py-2 bg-violet-500 hover:bg-violet-600 text-white rounded-lg font-medium transition-colors"
        >
          Extract Patterns
          <ArrowRight className="w-4 h-4" />
        </Link>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="p-4">
            <p className="text-xs text-slate-500 uppercase mb-1">Patterns Active</p>
            <p className="text-2xl font-semibold text-white font-mono">
              {stats.totalPatterns}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 uppercase mb-1">Posts Analyzed</p>
            <p className="text-2xl font-semibold text-white font-mono">
              {stats.postsAnalyzed}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 uppercase mb-1">Avg Views</p>
            <p className="text-2xl font-semibold text-white font-mono">
              {stats.avgViews.toLocaleString()}
            </p>
          </Card>
          <Card className="p-4">
            <p className="text-xs text-slate-500 uppercase mb-1">Avg Likes</p>
            <p className="text-2xl font-semibold text-white font-mono">
              {stats.avgLikes}
            </p>
          </Card>
        </div>
      )}

      {/* Suggestions */}
      <div>
        <h3 className="font-medium text-white mb-4">Recommended Actions</h3>
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <Card
              key={suggestion.id}
              className={`p-6 border ${SUGGESTION_COLORS[suggestion.type]}`}
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center flex-shrink-0">
                  {SUGGESTION_ICONS[suggestion.type]}
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-white text-lg">
                      {suggestion.title}
                    </h4>
                    <span className="px-3 py-1 bg-white/10 rounded-full text-sm font-medium">
                      {suggestion.impact}
                    </span>
                  </div>
                  <p className="text-slate-300 mb-4">{suggestion.description}</p>
                  {suggestion.action && (
                    <Link
                      href={
                        suggestion.type === "topic"
                          ? `/create?topic=${encodeURIComponent(
                              suggestion.title.replace("Write about: ", "")
                            )}`
                          : "/create"
                      }
                      className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg font-medium transition-colors"
                    >
                      {suggestion.action}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Tips Section */}
      <Card className="p-6 bg-slate-900/50">
        <h3 className="font-medium text-white mb-4">Quick Tips</h3>
        <ul className="space-y-3 text-sm text-slate-400">
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            <span>
              Posts with question hooks get 2-3x more replies on average
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            <span>
              Threads perform best when the first tweet is a strong hook
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            <span>
              Consistency matters - posting 3-5 times per week builds momentum
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-violet-400">•</span>
            <span>
              Reply to comments within the first hour for maximum engagement
            </span>
          </li>
        </ul>
      </Card>
    </div>
  );
}
