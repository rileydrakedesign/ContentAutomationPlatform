"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { useSubscription } from "@/components/auth/SubscriptionProvider";
import { useSidebar } from "./SidebarContext";

export function SidebarUpgradeBanner() {
  const { isFreePlan, subscription, loading } = useSubscription();
  const { isCollapsed } = useSidebar();

  if (loading || !isFreePlan) return null;

  const used = subscription?.usage?.used ?? 0;
  const limit = subscription?.usage?.limit ?? 5;
  const pct = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  if (isCollapsed) {
    return (
      <div className="px-2 pb-2">
        <Link
          href="/pricing"
          title="Upgrade to Pro"
          className="flex items-center justify-center w-full h-10 rounded-xl bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-accent-500)] text-white hover:opacity-90 transition"
        >
          <Zap className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-3 pb-3">
      <div className="rounded-xl bg-gradient-to-br from-[var(--color-primary-500)]/10 to-[var(--color-accent-500)]/10 border border-[var(--color-primary-500)]/20 p-3.5">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-accent-500)] flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">Free Plan</span>
        </div>

        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--color-text-muted)]">AI generations</span>
            <span className="font-mono text-[var(--color-text-secondary)]">{used}/{limit}</span>
          </div>
          <div className="h-1.5 rounded-full bg-[var(--color-bg-base)] overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                pct >= 100
                  ? "bg-[var(--color-danger-400)]"
                  : pct >= 60
                    ? "bg-[var(--color-warning-400)]"
                    : "bg-[var(--color-primary-400)]"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <Link
          href="/pricing"
          className="flex items-center justify-center gap-1.5 w-full py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-600)] hover:from-[var(--color-primary-400)] hover:to-[var(--color-primary-500)] text-white transition-all shadow-sm"
        >
          <Zap className="w-3 h-3" />
          Upgrade to Pro
        </Link>
      </div>
    </div>
  );
}
