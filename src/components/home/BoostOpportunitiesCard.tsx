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

export function BoostOpportunitiesCard({ days = 7, limit = 3 }: { days?: number; limit?: number }) {
  const [items, setItems] = useState<BoostOpportunity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
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
          No strong candidates yet. (Try raising volume or waiting for posts to accrue impressions.)
        </p>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <div key={it.post_id} className="rounded-lg border border-white/10 bg-white/5 p-3">
              <p className="text-sm text-[var(--color-text-primary)] mb-1">{snippet(it.text)}</p>
              <p className="text-xs text-[var(--color-text-secondary)] mb-2">
                ER {formatEr(it.engagement_rate)} • {Math.round(it.impressions).toLocaleString()} impressions • {Math.round(it.age_hours)}h ago
              </p>
              <a
                href={it.post_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 text-xs font-medium text-emerald-300 hover:text-emerald-200"
              >
                Open post <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
