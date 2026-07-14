"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Radar } from "lucide-react";
import type { SweepOutcome } from "./useRadarQueue";

/**
 * The seeded first-run state (PRD §9: zero blank states). Not silent
 * infrastructure — a reveal: "here's what we'll watch for you." The first
 * sweep compiles watches from the analyzed niche automatically; if there's
 * no niche yet, the reveal walks through analyzing it first.
 */
export function FirstRunReveal({
  sweep,
  sweeping,
}: {
  sweep: () => Promise<SweepOutcome>;
  sweeping: boolean;
}) {
  const [noNiche, setNoNiche] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function runFirstSweep() {
    setMessage(null);
    const out = await sweep();
    if (!out.ok) {
      setMessage(out.message);
      return;
    }
    // Sweep succeeded but nothing seeded and nothing queued → no niche
    // profile to compile watches from yet.
    if (out.seededWatches === 0 && out.queued === 0) setNoNiche(true);
  }

  async function analyzeThenSweep() {
    setAnalyzing(true);
    setMessage(null);
    try {
      const res = await fetch("/api/niche/analyze", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "Niche analysis failed — try again from the Voice page.");
        return;
      }
      setNoNiche(false);
      await runFirstSweep();
    } catch {
      setMessage("Niche analysis failed — try again from the Voice page.");
    } finally {
      setAnalyzing(false);
    }
  }

  const steps: [string, string][] = [
    ["watches", "compiled from your analyzed niche — no query writing, ever"],
    ["sweeps", "run daily on a read budget. Bounded, never a feed"],
    ["the session", "12–15 cards, each says why it's here. Twenty minutes, done"],
  ];

  return (
    <div className="px-6 py-8 space-y-6 animate-fade-in">
      <div className="border-t-2 border-[var(--color-border-strong)] pt-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-primary)] inline-flex items-center gap-[1ch]">
          <Radar className="w-3.5 h-3.5" />
          {noNiche ? "One step first" : "The radar hunts. You write."}
        </p>
      </div>

      {noNiche ? (
        <>
          <p className="text-sm text-[var(--color-text-secondary)] leading-6">
            Watches are compiled from your analyzed niche — and yours hasn&apos;t been analyzed
            yet. It takes about a minute, then the first sweep runs on its own.
          </p>
          <Button onClick={analyzeThenSweep} loading={analyzing || sweeping}>
            {analyzing ? "Analyzing your niche…" : "Analyze my niche"}
          </Button>
        </>
      ) : (
        <>
          <ol className="space-y-0">
            {steps.map(([term, detail], i) => (
              <li
                key={term}
                className="flex gap-[2ch] py-2 border-b border-dotted border-[var(--color-border-default)] text-sm leading-6"
              >
                <span className="text-[var(--color-text-muted)]">0{i + 1}</span>
                <span>
                  <span className="uppercase tracking-[0.08em] font-bold text-[var(--color-text-primary)]">
                    {term}
                  </span>{" "}
                  <span className="text-[var(--color-text-secondary)]">— {detail}.</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="space-y-2">
            <Button onClick={runFirstSweep} loading={sweeping}>
              {sweeping ? "Compiling your watches…" : "Run first sweep"}
            </Button>
            <p className="text-xs text-[var(--color-text-muted)]">
              The first sweep builds your watches from your niche automatically.
            </p>
          </div>
        </>
      )}

      {message && <p className="text-sm text-[var(--color-danger-400)]">{message}</p>}
    </div>
  );
}
