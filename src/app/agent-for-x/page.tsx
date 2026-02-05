"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default function AgentForXLanding() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = useMemo(() => isValidEmail(email), [email]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!canSubmit) {
      setError("enter a valid email");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, product: "agent-for-x" }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "failed to join waitlist");
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "failed to join waitlist");
    }
  }

  return (
    // Render as a full-screen overlay so the landing does not inherit the app shell/sidebar visually.
    <div className="fixed inset-0 z-50 min-h-screen overflow-auto bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <main className="mx-auto w-full max-w-6xl px-4 pb-14 pt-12 sm:px-6">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <h1 className="text-heading text-3xl sm:text-4xl lg:text-5xl font-semibold tracking-tight leading-tight text-[var(--color-text-primary)]">
              agent for x
            </h1>
            <h2 className="mt-4 text-heading text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              turn long-form ideas into x posts that actually sound like you.
            </h2>
            <p className="mt-4 text-base text-[var(--color-text-secondary)] leading-relaxed max-w-xl">
              agent for x pulls out the real points, keeps your voice, and generates drafts you can ship.
              no fluff. no fake wisdom. just usable posts.
            </p>

            <div className="mt-6 flex flex-wrap gap-2 text-xs text-[var(--color-text-muted)]">
              <span className="rounded-full border border-[var(--color-border-subtle)] bg-white/5 px-3 py-1">section-by-section insights</span>
              <span className="rounded-full border border-[var(--color-border-subtle)] bg-white/5 px-3 py-1">draft formats that vary</span>
              <span className="rounded-full border border-[var(--color-border-subtle)] bg-white/5 px-3 py-1">guardrails (no banned phrases)</span>
            </div>

            <div className="mt-10">
              <div className="gradient-border">
                <Card className="p-4 sm:p-5 glow-primary">
                  <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold">join the waitlist</div>
                    <div className="mt-1 text-sm text-[var(--color-text-secondary)]">
                      get early access + the first templates.
                    </div>
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)]">private • no spam</div>
                </div>

                {status === "success" ? (
                  <div className="mt-4 rounded-lg border border-[var(--color-success-500)]/20 bg-[var(--color-success-500)]/10 p-3">
                    <div className="text-sm text-[var(--color-success-400)] font-medium">you’re in.</div>
                    <div className="mt-1 text-xs text-[var(--color-text-secondary)]">we’ll email you when the waitlist opens.</div>
                  </div>
                ) : (
                  <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row">
                    <label className="sr-only" htmlFor="email">email</label>
                    <input
                      id="email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      placeholder="you@domain.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="flex-1 h-12"
                      aria-invalid={!!error}
                    />
                    <Button
                      type="submit"
                      size="lg"
                      glow
                      className="sm:min-w-[160px]"
                      loading={status === "loading"}
                      disabled={!canSubmit || status === "loading"}
                    >
                      {status === "loading" ? "joining…" : "join waitlist"}
                    </Button>
                  </form>
                )}

                {error ? (
                  <div className="mt-2 text-xs text-[var(--color-danger-400)]">{error}</div>
                ) : (
                  <div className="mt-3 text-xs text-[var(--color-text-muted)]">
                    private. no spam. easy unsubscribe.
                  </div>
                )}
              </Card>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white/5 p-4">
                <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">input</div>
                <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  podcast transcript, voice memo, or notes.
                </div>
              </div>
              <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white/5 p-4">
                <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">output</div>
                <div className="mt-2 text-sm text-[var(--color-text-secondary)]">
                  drafts that preserve meaning and avoid cringe.
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 sm:p-5 h-full flex flex-col">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
                    feature highlights
                  </div>
                  <div className="mt-2 text-sm font-semibold text-[var(--color-text-primary)]">
                    what agent for x actually does
                  </div>
                </div>
                <div className="text-xs text-[var(--color-text-muted)]">scroll →</div>
              </div>

              <div className="mt-4 flex-1 flex gap-3 overflow-x-auto pb-2 [-webkit-overflow-scrolling:touch]">
                {/* Draft samples */}
                <div className="min-w-[280px] rounded-lg border border-[var(--color-border-subtle)] bg-white/5 p-4">
                  <div className="text-[var(--color-text-primary)] font-medium">sample post</div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    the real skill isn’t writing more.
                    it’s keeping the sharp idea intact while making it readable.
                  </p>
                  <p className="mt-3 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    • cut the setup
                    • keep the point
                    • add a concrete next step
                  </p>
                </div>

                <div className="min-w-[280px] rounded-lg border border-[var(--color-border-subtle)] bg-white/5 p-4">
                  <div className="text-[var(--color-text-primary)] font-medium">sample thread</div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    1/ most people lose the reader before the idea shows up.
                  </p>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    2/ if your claim can’t survive one example, it’s not ready.
                  </p>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    3/ the draft isn’t the asset. the asset is the structure you reuse.
                  </p>
                </div>

                {/* Other features from repo */}
                <div className="min-w-[280px] rounded-lg border border-[var(--color-border-subtle)] bg-white/5 p-4">
                  <div className="text-[var(--color-text-primary)] font-medium">chrome extension reply agent</div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    draft replies faster with your voice + saved examples.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                    <li>• one-click capture</li>
                    <li>• guided reply structure</li>
                    <li>• human approval</li>
                  </ul>
                </div>

                <div className="min-w-[280px] rounded-lg border border-[var(--color-border-subtle)] bg-white/5 p-4">
                  <div className="text-[var(--color-text-primary)] font-medium">insights + patterns</div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    see what’s working and why — trend, not vanity metrics.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                    <li>• performance snapshot</li>
                    <li>• pattern insights</li>
                    <li>• best times</li>
                  </ul>
                </div>

                <div className="min-w-[280px] rounded-lg border border-[var(--color-border-subtle)] bg-white/5 p-4">
                  <div className="text-[var(--color-text-primary)] font-medium">voice memos → drafts</div>
                  <p className="mt-2 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                    talk it out. we transcribe, extract the points, then draft.
                  </p>
                  <ul className="mt-3 space-y-1 text-sm text-[var(--color-text-secondary)]">
                    <li>• fast capture</li>
                    <li>• clean structure</li>
                    <li>• edit + approve</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-14 border-t border-[var(--color-border-subtle)] pt-8 text-sm text-[var(--color-text-muted)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>© {new Date().getFullYear()} agent for x</div>
            <div className="flex flex-wrap gap-2">
              <Link className="rounded-md px-3 py-2 hover:bg-white/5 hover:text-[var(--color-text-secondary)]" href="/agent-for-x/privacy">
                privacy
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-white/5 hover:text-[var(--color-text-secondary)]" href="/agent-for-x/terms">
                terms
              </Link>
              <Link className="rounded-md px-3 py-2 hover:bg-white/5 hover:text-[var(--color-text-secondary)]" href="/login">
                sign in
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
