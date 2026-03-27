"use client";

import { useSubscription } from "@/components/auth/SubscriptionProvider";
import Link from "next/link";

interface AiUsageCounterProps {
  className?: string;
  compact?: boolean;
}

export function AiUsageCounter({ className = "", compact = false }: AiUsageCounterProps) {
  const { subscription, loading } = useSubscription();

  if (loading || !subscription) return null;
  if (subscription.usage.unlimited) return null;

  const { used, limit, remaining } = subscription.usage;
  if (limit === null) return null;

  const pct = Math.min(100, Math.round((used / limit) * 100));
  const barColor =
    pct >= 100
      ? "bg-[var(--color-danger-400)]"
      : pct >= 80
        ? "bg-[var(--color-warning-400)]"
        : "bg-[var(--color-success-400)]";

  if (compact) {
    return (
      <span
        className={`text-xs text-[var(--color-text-muted)] ${className}`}
      >
        {used}/{limit} AI generations
      </span>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-[var(--color-text-muted)]">
          AI generations today
        </span>
        <span className="font-mono text-[var(--color-text-secondary)]">
          {used}/{limit}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-[var(--color-bg-elevated)] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {remaining !== null && remaining <= 0 && (
        <p className="text-xs text-[var(--color-danger-400)]">
          Daily limit reached.{" "}
          <Link
            href="/pricing"
            className="text-[var(--color-primary-400)] hover:underline"
          >
            Upgrade for unlimited
          </Link>
        </p>
      )}
    </div>
  );
}
