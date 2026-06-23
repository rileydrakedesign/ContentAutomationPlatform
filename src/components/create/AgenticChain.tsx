"use client";

import {
  Search,
  PenLine,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";

export type StepName = "research" | "draft" | "voice_check" | "iterate";

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

const STEP_ICON: Record<StepName, typeof Search> = {
  research: Search,
  draft: PenLine,
  voice_check: ShieldCheck,
  iterate: RefreshCw,
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-[var(--color-success-400)]";
  if (score >= 60) return "text-[var(--color-warning-400)]";
  return "text-[var(--color-danger-400)]";
}

interface AgenticChainProps {
  steps: ChainStepView[];
  sources: ChainSource[];
  scores: ChainScore[];
  liveDraft: string;
  active: boolean;
}

/**
 * Live view of the agentic post pipeline: a vertical timeline of steps
 * (research → draft → voice-check → iterate) with status icons, the sources
 * surfaced by web search, the streaming draft, and the voice score per pass.
 */
export function AgenticChain({ steps, sources, scores, liveDraft, active }: AgenticChainProps) {
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
      </CardContent>
    </Card>
  );
}
