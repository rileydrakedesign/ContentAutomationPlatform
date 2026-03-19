"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ExternalLink, TrendingUp } from "lucide-react";

type BoostOpportunity = {
  post_id: string;
  post_url: string;
  text: string;
  date: string;
  impressions: number;
  engagements: number;
  engagement_rate: number;
  age_hours: number;
  score: number;
  reasons: string[];
};

function formatEr(er: number) {
  if (!Number.isFinite(er)) return "—";
  return `${(er * 100).toFixed(2)}%`;
}

function snippet(text: string, max = 140) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

function ScoreBadge({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    pct >= 70 ? "text-emerald-300 bg-emerald-500/10" :
    pct >= 45 ? "text-yellow-300 bg-yellow-500/10" :
    "text-slate-400 bg-white/5";
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>
      {pct}
    </span>
  );
}

export function BoostOpportunitiesCard({ days = 7, limit = 3 }: { days?: number; limit?: number }) {
  const [items, setItems] = useState<BoostOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/analytics/boost-opportunities?days=${days}&limit=${limit}`);
        const json = await res.json();
        if (!cancelled) setItems(Array.isArray(json.data) ? json.data : []);
      } catch (e) {
        console.error("Failed to load boost opportunities", e);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [days, limit]);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">Boost opportunities</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Best posts to amplify (last {days}d)</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          <div className="h-10 skeleton" />
          <div className="h-10 skeleton" />
          <div className="h-10 skeleton" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--color-text-secondary)]">
          No strong candidates yet. Upload a CSV or sync your timeline to get recommendations.
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.post_id} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-sm text-[var(--color-text-primary)] mb-1">{snippet(it.text)}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mb-1">
                ER {formatEr(it.engagement_rate)} · {Math.round(it.impressions).toLocaleString()} impressions · {Math.round(it.age_hours)}h ago
              </p>
              {it.reasons[0] && (
                <p className="text-xs text-[var(--color-text-secondary)] opacity-70 mb-2">{it.reasons[0]}</p>
              )}
              <div className="flex items-center justify-between">
                <a
                  href={it.post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-300 hover:text-emerald-200"
                >
                  Open post <ExternalLink className="w-3 h-3" />
                </a>
                <ScoreBadge score={it.score} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
