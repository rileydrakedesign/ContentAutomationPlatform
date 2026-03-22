"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Target, ArrowRight } from "lucide-react";
import Link from "next/link";

type ProgressItem = { target: number; actual: number };
type PillarProgress = { pillar: string; target: number; actual: number };

type StrategyProgressData = {
  posts: ProgressItem;
  threads: ProgressItem;
  replies: ProgressItem;
  pillars: PillarProgress[];
  pacing: "ahead" | "on_track" | "behind";
  week_start: string;
};

function ProgressBar({
  label,
  actual,
  target,
  color,
}: {
  label: string;
  actual: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  const over = actual > target;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
        <span className={`text-xs font-mono tabular-nums ${over ? "text-emerald-400" : "text-[var(--color-text-muted)]"}`}>
          {actual}/{target}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            backgroundColor: color,
          }}
        />
      </div>
    </div>
  );
}

const pacingConfig = {
  ahead: { label: "Ahead", className: "text-emerald-400 bg-emerald-500/10" },
  on_track: { label: "On track", className: "text-blue-400 bg-blue-500/10" },
  behind: { label: "Behind", className: "text-amber-400 bg-amber-500/10" },
};

export function StrategyProgress({ className }: { className?: string }) {
  const [data, setData] = useState<StrategyProgressData | null>(null);
  const [hasStrategy, setHasStrategy] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/strategy").then((r) => r.json()),
      fetch("/api/strategy/progress").then((r) => r.json()),
    ])
      .then(([strategyRes, progressRes]) => {
        // If user has never set a strategy (no row in DB), don't show widget
        if (!strategyRes.strategy?.id) {
          setHasStrategy(false);
          return;
        }
        if (progressRes.posts) {
          setData(progressRes);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className={className}>
        <CardContent>
          <div className="h-4 skeleton w-32 mb-3" />
          <div className="space-y-3">
            <div className="h-6 skeleton" />
            <div className="h-6 skeleton" />
            <div className="h-6 skeleton" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if user hasn't set up a strategy
  if (!hasStrategy || !data) {
    return (
      <Card className={className}>
        <CardContent className="py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Target size={16} className="text-[var(--color-text-muted)]" />
              <span className="text-sm text-[var(--color-text-secondary)]">
                No weekly targets set
              </span>
            </div>
            <Link
              href="/strategy"
              className="text-xs font-medium text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition-colors flex items-center gap-1"
            >
              Set targets
              <ArrowRight size={12} />
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const pacing = pacingConfig[data.pacing];

  return (
    <Card className={className}>
      <CardContent>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-[var(--color-text-primary)]">
              This week
            </h3>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${pacing.className}`}>
              {pacing.label}
            </span>
          </div>
          <Link
            href="/strategy"
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            Edit
          </Link>
        </div>

        <div className="space-y-2.5">
          <ProgressBar label="Posts" actual={data.posts.actual} target={data.posts.target} color="rgb(96, 165, 250)" />
          <ProgressBar label="Threads" actual={data.threads.actual} target={data.threads.target} color="rgb(192, 132, 252)" />
          <ProgressBar label="Replies" actual={data.replies.actual} target={data.replies.target} color="rgb(52, 211, 153)" />
        </div>

        {data.pillars.length > 0 && (
          <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
            <div className="flex flex-wrap gap-1.5">
              {data.pillars.map((p) => (
                <span
                  key={p.pillar}
                  className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    p.actual >= p.target
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : "border-[var(--color-border-default)] text-[var(--color-text-muted)]"
                  }`}
                >
                  {p.pillar} {p.actual}/{p.target}
                </span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
