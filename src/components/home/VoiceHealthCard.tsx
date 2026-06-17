"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { ArrowRight, X } from "lucide-react";
import { apiFetch } from "@/lib/utils/apiFetch";
import { formatRelativeTime } from "@/lib/utils/formatting";

type StaleComponent = "examples" | "patterns" | "niche";

type VoiceHealthData = {
  freshness: {
    analytics_updated_at: string | null;
    examples_refreshed_at: string | null;
    patterns_extracted_at: string | null;
    niche_analyzed_at: string | null;
    stale_components: StaleComponent[];
    retune_recommended: boolean;
  };
  examples_count: number;
  patterns_count: number;
  has_niche: boolean;
  has_positioning: boolean;
  has_strategy: boolean;
};

// Dedupe concurrent fetches — the card and the re-tune banner mount together
// and share one request; later remounts fetch fresh.
let inflight: Promise<VoiceHealthData> | null = null;
function fetchVoiceHealth(): Promise<VoiceHealthData> {
  if (!inflight) {
    inflight = apiFetch<VoiceHealthData>("/api/insights/voice-health");
    inflight
      .catch(() => {})
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

function useVoiceHealth() {
  const [data, setData] = useState<VoiceHealthData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetchVoiceHealth()
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        // Fail quiet — status widget renders nothing on error
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading };
}

type RowStatus = "ok" | "stale" | "missing";

function StatusDot({ status }: { status: RowStatus }) {
  const color =
    status === "ok"
      ? "bg-emerald-400"
      : status === "stale"
        ? "bg-amber-400"
        : "bg-[var(--color-text-muted)]/40";
  return <span className={`w-2 h-2 rounded-full shrink-0 ${color}`} />;
}

function HealthRow({
  label,
  value,
  detail,
  status,
}: {
  label: string;
  value: string;
  detail?: string | null;
  status: RowStatus;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5 min-w-0">
        <StatusDot status={status} />
        <span className="text-xs text-[var(--color-text-secondary)] truncate">
          {label}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5 shrink-0">
        <span
          className={`text-xs font-medium ${
            status === "missing"
              ? "text-[var(--color-text-muted)]"
              : "text-[var(--color-text-primary)]"
          }`}
        >
          {value}
        </span>
        {detail && (
          <span className="text-[10px] text-[var(--color-text-muted)]">
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}

function rowStatus(present: boolean, stale: boolean): RowStatus {
  if (!present) return "missing";
  return stale ? "stale" : "ok";
}

export function VoiceHealthCard({ className }: { className?: string }) {
  const { data, loading } = useVoiceHealth();

  if (loading) {
    return (
      <Card className={className}>
        <CardContent>
          <div className="h-4 skeleton w-28 mb-3" />
          <div className="space-y-2.5">
            <div className="h-4 skeleton" />
            <div className="h-4 skeleton" />
            <div className="h-4 skeleton" />
            <div className="h-4 skeleton" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Fail quiet — it's a status widget
  if (!data) return null;

  const { freshness } = data;
  const stale = new Set(freshness.stale_components);
  const nicheAnalyzed = data.has_niche || data.has_positioning;

  return (
    <Card className={className}>
      <CardContent>
        <h3 className="text-sm font-medium text-[var(--color-text-primary)] mb-3">
          Voice Health
        </h3>

        <div className="space-y-2.5">
          <HealthRow
            label="Voice examples"
            value={String(data.examples_count)}
            detail={
              freshness.examples_refreshed_at
                ? formatRelativeTime(freshness.examples_refreshed_at)
                : null
            }
            status={rowStatus(data.examples_count > 0, stale.has("examples"))}
          />
          <HealthRow
            label="Proven patterns"
            value={String(data.patterns_count)}
            detail={
              freshness.patterns_extracted_at
                ? formatRelativeTime(freshness.patterns_extracted_at)
                : null
            }
            status={rowStatus(data.patterns_count > 0, stale.has("patterns"))}
          />
          <HealthRow
            label="Niche & Positioning"
            value={nicheAnalyzed ? "Analyzed" : "Not analyzed"}
            detail={
              freshness.niche_analyzed_at
                ? formatRelativeTime(freshness.niche_analyzed_at)
                : null
            }
            status={rowStatus(nicheAnalyzed, stale.has("niche"))}
          />
          <HealthRow
            label="Strategy"
            value={data.has_strategy ? "Set" : "Not set"}
            status={rowStatus(data.has_strategy, false)}
          />
        </div>

        <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
          <Link
            href="/insights"
            className="text-xs font-medium text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition-colors flex items-center gap-1"
          >
            Run Voice Tune-Up
            <ArrowRight size={12} />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}

const RETUNE_BANNER_DISMISS_KEY = "voice-retune-banner-dismissed";

export function RetuneBanner() {
  const { data } = useVoiceHealth();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(RETUNE_BANNER_DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  if (
    !data ||
    dismissed ||
    !data.freshness.retune_recommended ||
    !data.freshness.analytics_updated_at
  ) {
    return null;
  }

  const staleList = data.freshness.stale_components.join(", ");

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(RETUNE_BANNER_DISMISS_KEY, "1");
    } catch {
      // sessionStorage unavailable — useState dismiss still applies
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 mb-5 flex items-center justify-between gap-4">
      <p className="text-xs text-[var(--color-text-secondary)] min-w-0">
        Your analytics are newer than your tuned voice — run a{" "}
        <Link
          href="/insights"
          className="font-medium text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition-colors"
        >
          Voice Tune-Up
        </Link>{" "}
        to re-tune.
        {staleList && (
          <span className="text-[var(--color-text-muted)]"> ({staleList} out of date)</span>
        )}
      </p>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
      >
        <X size={14} />
      </button>
    </div>
  );
}
