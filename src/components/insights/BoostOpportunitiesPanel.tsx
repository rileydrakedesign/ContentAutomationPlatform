"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ExternalLink, Filter, TrendingUp } from "lucide-react";

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

function snippet(text: string, max = 220) {
  const t = (text || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return t.slice(0, max - 1) + "…";
}

export function BoostOpportunitiesPanel() {
  const [items, setItems] = useState<BoostOpportunity[]>([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState<7 | 14 | 30>(7);
  const [minImpressions, setMinImpressions] = useState<100 | 200 | 500>(200);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(
          `/api/analytics/boost-opportunities?days=${days}&limit=50&minImpressions=${minImpressions}`
        );
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
  }, [days, minImpressions]);

  const top = useMemo(() => items.slice(0, 15), [items]);

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-white">Boost opportunities</h3>
            <p className="text-sm text-slate-400">
              Recommended posts to amplify (high ER + decent impressions + recent)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-300">
          <Filter className="w-4 h-4" />
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value) as any)}
            className="bg-slate-900 border border-white/10 rounded-md px-2 py-1"
          >
            <option value={7}>Last 7d</option>
            <option value={14}>Last 14d</option>
            <option value={30}>Last 30d</option>
          </select>
          <select
            value={minImpressions}
            onChange={(e) => setMinImpressions(Number(e.target.value) as any)}
            className="bg-slate-900 border border-white/10 rounded-md px-2 py-1"
          >
            <option value={100}>≥ 100 impressions</option>
            <option value={200}>≥ 200 impressions</option>
            <option value={500}>≥ 500 impressions</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="h-14 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-14 bg-slate-800 rounded-lg animate-pulse" />
          <div className="h-14 bg-slate-800 rounded-lg animate-pulse" />
        </div>
      ) : top.length === 0 ? (
        <p className="text-sm text-slate-400">No candidates match the current filters.</p>
      ) : (
        <div className="space-y-3">
          {top.map((it) => (
            <div key={it.post_id} className="rounded-lg border border-white/10 bg-slate-900/40 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-white mb-1">{snippet(it.text)}</p>
                  <p className="text-xs text-slate-400">
                    ER {formatEr(it.engagement_rate)} • {Math.round(it.impressions).toLocaleString()} impressions • {Math.round(it.age_hours)}h ago
                  </p>
                  <p className="text-xs text-slate-500 mt-2">{it.reasons.slice(0, 2).join(" • ")}</p>
                </div>
                <a
                  href={it.post_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-medium text-white whitespace-nowrap"
                >
                  Open <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && items.length > 15 && (
        <p className="text-xs text-slate-500 mt-3">Showing top 15 (ranked by Boost Score).</p>
      )}
    </Card>
  );
}
