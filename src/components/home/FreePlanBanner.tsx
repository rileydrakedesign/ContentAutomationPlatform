"use client";

import Link from "next/link";
import { Zap, ArrowRight, Sparkles, Calendar, BarChart2, MessageSquare } from "lucide-react";
import { useSubscription } from "@/components/auth/SubscriptionProvider";

export function FreePlanBanner() {
  const { isFreePlan, subscription, loading } = useSubscription();

  if (loading || !isFreePlan) return null;

  const used = subscription?.usage?.used ?? 0;
  const limit = subscription?.usage?.limit ?? 5;
  const remaining = limit - used;

  return (
    <div className="rounded-xl border border-[var(--color-primary-500)]/20 bg-gradient-to-r from-[var(--color-primary-500)]/5 via-[var(--color-bg-surface)] to-[var(--color-accent-500)]/5 p-4 mb-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          {/* Plan badge */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] flex items-center justify-center">
              <Zap className="w-4 h-4 text-[var(--color-text-muted)]" />
            </div>
            <div>
              <p className="text-xs font-semibold text-[var(--color-text-primary)]">Free Plan</p>
              <p className="text-[10px] text-[var(--color-text-muted)]">
                {remaining > 0
                  ? `${remaining} AI generation${remaining !== 1 ? "s" : ""} left today`
                  : "Daily limit reached"}
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="w-px h-8 bg-[var(--color-border-default)] shrink-0" />

          {/* Locked features */}
          <div className="flex items-center gap-3 text-[var(--color-text-muted)]">
            <div className="flex items-center gap-1 text-xs" title="Pattern extraction">
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Patterns</span>
            </div>
            <div className="flex items-center gap-1 text-xs" title="Post scheduling">
              <Calendar className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Scheduling</span>
            </div>
            <div className="flex items-center gap-1 text-xs" title="X API sync">
              <BarChart2 className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">API Sync</span>
            </div>
            <div className="flex items-center gap-1 text-xs" title="Insights chat">
              <MessageSquare className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">AI Chat</span>
            </div>
          </div>
        </div>

        {/* CTA */}
        <Link
          href="/pricing"
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-gradient-to-r from-[var(--color-primary-500)] to-[var(--color-primary-600)] hover:from-[var(--color-primary-400)] hover:to-[var(--color-primary-500)] text-white transition-all shadow-sm shrink-0"
        >
          Upgrade
          <ArrowRight className="w-3 h-3" />
        </Link>
      </div>
    </div>
  );
}
