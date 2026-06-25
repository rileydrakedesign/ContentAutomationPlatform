"use client";

import {
  Search,
  PenLine,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Loader2,
  ExternalLink,
  TrendingUp,
  CircleCheck,
  CircleAlert,
  CircleX,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

export type StepName = "research" | "draft" | "voice_check" | "iterate" | "read";

export interface ChainStepView {
  step: StepName;
  status: "running" | "done";
  label: string;
  iteration?: number;
}

export interface ChainSource {
  title: string;
  url: string;
}

export interface ChainScore {
  iteration: number;
  score: number;
}

export interface ChainReadFlag {
  signal: string;
  status: "good" | "caution" | "penalty";
  label: string;
  note: string;
}

export interface ChainReadNote {
  signal: string;
  weight: number | null;
  label: string;
  effect: "positive" | "negative";
  note: string;
}

export interface ChainRead {
  resemblance_score: number;
  confidence: "low" | "medium" | "high";
  matched_winning_patterns: { pattern_name: string; multiplier: number }[];
  missing_high_lift_patterns: { pattern_name: string; pattern_value?: string; multiplier: number }[];
  algorithm_flags: ChainReadFlag[];
  algorithm_notes: ChainReadNote[];
  summary: string;
}

const STEP_ICON: Record<StepName, typeof Search> = {
  research: Search,
  draft: PenLine,
  voice_check: ShieldCheck,
  iterate: RefreshCw,
  read: TrendingUp,
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-[var(--color-success-400)]";
  if (score >= 60) return "text-[var(--color-warning-400)]";
  return "text-[var(--color-danger-400)]";
}

const FLAG_STYLE: Record<ChainReadFlag["status"], { icon: typeof CircleCheck; cls: string }> = {
  good: { icon: CircleCheck, cls: "text-[var(--color-success-400)]" },
  caution: { icon: CircleAlert, cls: "text-[var(--color-warning-400)]" },
  penalty: { icon: CircleX, cls: "text-[var(--color-danger-400)]" },
};

interface AgenticChainProps {
  steps: ChainStepView[];
  sources: ChainSource[];
  scores: ChainScore[];
  liveDraft: string;
  active: boolean;
  read?: ChainRead | null;
}

/**
 * Live view of the agentic post pipeline: a vertical timeline of steps
 * (research → draft → voice-check → iterate) with status icons, the sources
 * surfaced by web search, the streaming draft, and the voice score per pass.
 */
export function AgenticChain({ steps, sources, scores, liveDraft, active, read }: AgenticChainProps) {
  if (steps.length === 0 && !active) return null;

  return (
    <Card className="max-w-2xl mx-auto">
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
            {active ? (
              <Loader2 className="w-4 h-4 text-[var(--color-primary-400)] animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-[var(--color-success-400)]" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Agentic pipeline
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              {active ? "Working through the chain…" : "Chain complete"}
            </p>
          </div>
        </div>

        <ol className="space-y-3">
          {steps.map((s, i) => {
            const Icon = STEP_ICON[s.step];
            const running = s.status === "running";
            return (
              <li key={`${s.step}:${s.iteration ?? 0}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center border ${
                      running
                        ? "border-[var(--color-primary-500)]/40 bg-[var(--color-primary-500)]/10"
                        : "border-[var(--color-success-500)]/40 bg-[var(--color-success-500)]/10"
                    }`}
                  >
                    {running ? (
                      <Loader2 className="w-3.5 h-3.5 text-[var(--color-primary-400)] animate-spin" />
                    ) : (
                      <Icon className="w-3.5 h-3.5 text-[var(--color-success-400)]" />
                    )}
                  </div>
                  {i < steps.length - 1 && (
                    <div className="w-px flex-1 min-h-[12px] bg-[var(--color-border-default)] mt-1" />
                  )}
                </div>

                <div className="flex-1 pb-1">
                  <p
                    className={`text-sm ${
                      running
                        ? "text-[var(--color-text-primary)] font-medium"
                        : "text-[var(--color-text-secondary)]"
                    }`}
                  >
                    {s.label}
                  </p>

                  {/* Sources surfaced by the research step */}
                  {s.step === "research" && s.status === "done" && sources.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {sources.map((src, j) => (
                        <li key={j}>
                          <a
                            href={src.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[var(--color-primary-400)] hover:underline max-w-full"
                          >
                            <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                            <span className="truncate">{src.title || src.url}</span>
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </li>
            );
          })}
        </ol>

        {/* Streaming draft preview while writing/refining */}
        {active && liveDraft && (
          <div className="mt-4 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/50 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
              Drafting
            </p>
            <p className="text-sm text-[var(--color-text-primary)] whitespace-pre-wrap leading-relaxed">
              {liveDraft}
              <span className="inline-block w-1.5 h-4 ml-0.5 align-text-bottom bg-[var(--color-primary-400)] animate-pulse" />
            </p>
          </div>
        )}

        {/* Voice score progression across passes */}
        {scores.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-[var(--color-text-muted)]">Voice match:</span>
            {scores.map((sc, i) => (
              <div key={sc.iteration} className="flex items-center gap-2">
                {i > 0 && <span className="text-[var(--color-text-muted)] text-xs">→</span>}
                <span className={`text-sm font-semibold ${scoreColor(sc.score)}`}>{sc.score}</span>
              </div>
            ))}
          </div>
        )}

        {/* Pre-publish engagement read */}
        {read && (
          <div className="mt-5 rounded-lg border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]/50 px-3 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--color-text-primary)]">
                Engagement read
              </span>
              <span className="flex items-baseline gap-1.5">
                <span className={`text-sm font-semibold ${scoreColor(read.resemblance_score)}`}>
                  {read.resemblance_score}
                </span>
                <span className="text-[10px] text-[var(--color-text-muted)]">
                  resembles your winners · {read.confidence} confidence
                </span>
              </span>
            </div>

            {read.summary && (
              <p className="mt-1.5 text-xs text-[var(--color-text-secondary)] leading-relaxed">
                {read.summary}
              </p>
            )}

            {/* Algorithm-fit flags */}
            {read.algorithm_flags.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {read.algorithm_flags.map((f, i) => {
                  const { icon: Icon, cls } = FLAG_STYLE[f.status];
                  return (
                    <li key={i} className="flex items-start gap-2">
                      <Icon className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${cls}`} />
                      <span className="text-[11px] text-[var(--color-text-secondary)] leading-snug">
                        <span className="font-medium text-[var(--color-text-primary)]">{f.label}.</span>{" "}
                        {f.note}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}

            {/* Proven-pattern chips */}
            {(read.matched_winning_patterns.length > 0 || read.missing_high_lift_patterns.length > 0) && (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {read.matched_winning_patterns.map((p, i) => (
                  <span
                    key={`m${i}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-500)]/10 px-2 py-0.5 text-[10px] text-[var(--color-success-400)]"
                  >
                    {p.pattern_name} ×{p.multiplier.toFixed(1)}
                  </span>
                ))}
                {read.missing_high_lift_patterns.map((p, i) => (
                  <span
                    key={`x${i}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] px-2 py-0.5 text-[10px] text-[var(--color-text-muted)]"
                    title={p.pattern_value || undefined}
                  >
                    + {p.pattern_name} ×{p.multiplier.toFixed(1)}
                  </span>
                ))}
              </div>
            )}

            {/* How X treats this — transparency disclosure */}
            {read.algorithm_notes.length > 0 && (
              <details className="mt-2.5 group">
                <summary className="cursor-pointer text-[11px] text-[var(--color-primary-400)] hover:underline list-none">
                  How X treats this ▾
                </summary>
                <ul className="mt-2 space-y-1">
                  {read.algorithm_notes.map((n, i) => (
                    <li key={i} className="flex items-start gap-2 text-[11px] leading-snug">
                      <span
                        className={`shrink-0 font-mono ${
                          n.effect === "positive"
                            ? "text-[var(--color-success-400)]"
                            : "text-[var(--color-danger-400)]"
                        }`}
                      >
                        {n.weight === null ? "—" : n.weight > 0 ? `+${n.weight}` : n.weight}
                      </span>
                      <span className="text-[var(--color-text-muted)]">
                        <span className="text-[var(--color-text-secondary)]">{n.label}.</span> {n.note}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
