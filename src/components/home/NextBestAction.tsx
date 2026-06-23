"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { ArrowRight, Sparkles, PenSquare, Reply, Plug, RefreshCw } from "lucide-react";
import { apiFetch } from "@/lib/utils/apiFetch";

interface Draft {
  status: "DRAFT" | "POSTED" | "SCHEDULED" | "REJECTED";
}

interface NextBestActionProps {
  drafts: Draft[];
  xConnected: boolean;
}

interface Action {
  icon: React.ReactNode;
  title: string;
  detail: string;
  href: string;
  cta: string;
}

/**
 * The single highest-priority next step in the loop, derived from live loop
 * state (X connection → freshness → drafts ready → reply). Orients the ICP
 * around "what should I do right now to keep the flywheel turning" instead of a
 * wall of widgets.
 */
export function NextBestAction({ drafts, xConnected }: NextBestActionProps) {
  const [retune, setRetune] = useState(false);

  useEffect(() => {
    let cancelled = false;
    apiFetch<{ freshness?: { retune_recommended?: boolean } }>("/api/insights/voice-health")
      .then((d) => {
        if (!cancelled) setRetune(Boolean(d?.freshness?.retune_recommended));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const draftsReady = drafts.filter((d) => d.status === "DRAFT").length;

  const action: Action = !xConnected
    ? {
        icon: <Plug className="w-5 h-5" />,
        title: "Connect your X account",
        detail: "Connect X to learn what works for you and start the loop.",
        href: "/settings",
        cta: "Connect X",
      }
    : retune
      ? {
          icon: <RefreshCw className="w-5 h-5" />,
          title: "Re-tune your voice",
          detail: "Your analytics moved ahead of your tuned voice — re-tune so new posts learn from your latest performance.",
          href: "/insights",
          cta: "Run Voice Tune-Up",
        }
      : draftsReady > 0
        ? {
            icon: <PenSquare className="w-5 h-5" />,
            title: `Publish your ${draftsReady} ready draft${draftsReady > 1 ? "s" : ""}`,
            detail: "Voice-check and ship — each published post feeds your voice within a day.",
            href: "/create?tab=drafts",
            cta: "Review drafts",
          }
        : {
            icon: <Reply className="w-5 h-5" />,
            title: "Find posts to reply to",
            detail: "Replying to high-traction posts in your voice is the other half of growth.",
            href: "/reply",
            cta: "Find reply targets",
          };

  return (
    <Card className="border-[var(--color-primary-500)]/30 bg-[var(--color-primary-500)]/5">
      <CardContent>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-[var(--color-primary-400)]" />
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-primary-400)]">
            Next best action
          </span>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center text-[var(--color-primary-400)] shrink-0">
              {action.icon}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                {action.title}
              </h3>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                {action.detail}
              </p>
            </div>
          </div>
          <Link
            href={action.href}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary-500)] text-white text-sm font-medium hover:bg-[var(--color-primary-600)] transition-colors"
          >
            {action.cta}
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
