"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { Sparkles, ArrowRight, CheckCircle2, Upload } from "lucide-react";
import { voiceConfidence } from "@/lib/analysis/voice-confidence";

type Phase = "idle" | "running" | "done" | "empty" | "error";

/**
 * First-session value: when the user lands on the dashboard right after
 * connecting X (`?connected=1`), kick off the bootstrap (timeline sync + first
 * Voice Tune-Up) and show progress, then reveal "what works for you" — niche,
 * patterns, top posts — with no manual CSV upload. Reads the flag from the URL
 * client-side to avoid a Suspense boundary.
 */
export function FirstRunAnalysis({
  onComplete,
  onUploadClick,
}: {
  onComplete?: () => void;
  onUploadClick?: () => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<string | null>(null);
  const [postsAnalyzed, setPostsAnalyzed] = useState<number>(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") !== "1") return;
    started.current = true;

    // Strip the flag so a refresh doesn't re-trigger analysis.
    params.delete("connected");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));

    // Run the one-time bootstrap; all state updates happen inside this async
    // flow (not synchronously in the effect body).
    void (async () => {
      setPhase("running");
      try {
        const res = await fetch("/api/x/bootstrap", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.ok) {
          setSummary((data.report?.niche_summary as string | undefined) || null);
          setPostsAnalyzed(Number(data.posts_analyzed) || 0);
          setPhase("done");
          onComplete?.();
        } else if (res.ok && !data.ok) {
          setPhase("empty");
        } else {
          setPhase("error");
        }
      } catch {
        setPhase("error");
      }
    })();
  }, [onComplete]);

  if (phase === "idle") return null;

  return (
    <Card className="mb-5 border-[var(--color-accent-500)]/30 bg-[var(--color-accent-500)]/5">
      <CardContent>
        {phase === "running" && (
          <div className="flex items-center gap-3">
            <span aria-hidden className="inline-block animate-[blink_1s_steps(1)_infinite] text-[var(--color-accent-400)] shrink-0">▌</span>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                Analyzing your account…
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                Reading your recent posts to find your niche, your proven patterns, and
                what performs — this takes a few seconds.
              </p>
            </div>
          </div>
        )}

        {phase === "done" && (() => {
          const conf = voiceConfidence(postsAnalyzed);
          return (
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <CheckCircle2 className="w-5 h-5 text-[var(--color-success-400)] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                      Your voice is tuned from your own posts
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                      {summary
                        ? summary
                        : "We found what works for you — niche, patterns, and top posts are ready."}
                    </p>
                  </div>
                </div>
                <Link
                  href="/insights"
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary-500)] text-[var(--color-text-inverse)] text-sm font-medium hover:bg-[var(--color-primary-600)] transition-colors"
                >
                  See your Voice Report
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
              {/* Honest confidence framing — a thin-history tune is flagged, not hidden */}
              <div
                className={`flex items-start gap-2 rounded-lg px-3 py-2 text-xs ${
                  conf.level === "good"
                    ? "bg-[var(--color-success-500)]/5 text-[var(--color-text-secondary)]"
                    : "bg-[var(--color-warning-500)]/5 text-[var(--color-text-secondary)]"
                }`}
              >
                <span
                  className={`mt-0.5 shrink-0 font-semibold ${
                    conf.level === "good"
                      ? "text-[var(--color-success-400)]"
                      : "text-[var(--color-warning-400)]"
                  }`}
                >
                  {conf.label}:
                </span>
                <span>{conf.blurb}</span>
              </div>
            </div>
          );
        })()}

        {phase === "empty" && (
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Sparkles className="w-5 h-5 text-[var(--color-accent-400)] shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                  Connected — let&apos;s get enough signal to learn your voice
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] mt-0.5">
                  We couldn&apos;t find enough recent posts to analyze yet. The fastest
                  path: import your X analytics CSV (covers your whole history), or write
                  your first post and we&apos;ll start learning.
                </p>
              </div>
            </div>
            <div className="shrink-0 flex flex-col gap-2">
              <button
                onClick={() => onUploadClick?.()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--color-primary-500)] text-[var(--color-text-inverse)] text-sm font-medium hover:bg-[var(--color-primary-600)] transition-colors"
              >
                <Upload className="w-4 h-4" />
                Import CSV
              </button>
              <Link
                href="/create"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--color-border-default)] text-sm font-medium hover:bg-[var(--color-bg-hover)] transition-colors text-center justify-center"
              >
                Write a post
              </Link>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-[var(--color-accent-400)] shrink-0" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Connected! Your first analysis didn&apos;t finish — run a{" "}
              <Link href="/insights" className="text-[var(--color-accent-400)] hover:underline">
                Voice Tune-Up
              </Link>{" "}
              to see what works for you.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
