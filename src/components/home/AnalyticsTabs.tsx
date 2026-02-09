"use client";

import Link from "next/link";
import { Lightbulb, FileText, CheckCircle, Send } from "lucide-react";

interface AnalyticsTabsProps {
  inspirationCount: number;
  draftsCount: number;
  approvedCount: number;
  postedCount: number;
  horizontal?: boolean;
  fillHeight?: boolean;
}

export function AnalyticsTabs({
  inspirationCount,
  draftsCount,
  approvedCount,
  postedCount,
  horizontal,
  fillHeight,
}: AnalyticsTabsProps) {
  const tabs = [
    {
      label: "Inspiration",
      count: inspirationCount,
      icon: Lightbulb,
      href: "/library?filter=inspiration",
      color: "text-amber-400",
      bgColor: "bg-amber-400/10",
    },
    {
      label: "Drafts",
      count: draftsCount,
      icon: FileText,
      href: "/create?tab=drafts",
      color: "text-blue-400",
      bgColor: "bg-blue-400/10",
    },
    {
      label: "Approved",
      count: approvedCount,
      icon: CheckCircle,
      href: "/create?tab=drafts&status=approved",
      color: "text-emerald-400",
      bgColor: "bg-emerald-400/10",
    },
    {
      label: "Posted",
      count: postedCount,
      icon: Send,
      href: "/library?filter=my_posts",
      color: "text-purple-400",
      bgColor: "bg-purple-400/10",
    },
  ];

  if (horizontal) {
    return (
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl px-4 py-3">
        <div className="flex items-center gap-4">
          <span className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider shrink-0">
            Content
          </span>
          <div className="flex-1 flex items-center gap-2">
            {tabs.map((tab) => (
              <Link
                key={tab.label}
                href={tab.href}
                className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors group"
              >
                <div className={`w-7 h-7 rounded-md ${tab.bgColor} flex items-center justify-center shrink-0`}>
                  <tab.icon className={`w-3.5 h-3.5 ${tab.color}`} />
                </div>
                <span className="text-sm font-mono font-semibold text-[var(--color-text-primary)]">
                  {tab.count}
                </span>
                <span className="text-xs text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">
                  {tab.label}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-xl p-4">
      <h3 className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
        Content
      </h3>
      <div className="space-y-1">
        {tabs.map((tab) => (
          <Link
            key={tab.label}
            href={tab.href}
            className="flex items-center justify-between p-2.5 rounded-lg hover:bg-[var(--color-bg-hover)] transition-colors group"
          >
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg ${tab.bgColor} flex items-center justify-center`}>
                <tab.icon className={`w-4 h-4 ${tab.color}`} />
              </div>
              <span className="text-sm text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)] transition-colors">
                {tab.label}
              </span>
            </div>
            <span className="text-sm font-mono font-medium text-[var(--color-text-primary)]">
              {tab.count}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
