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
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      <header className="mx-auto max-w-5xl px-6 pt-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[var(--color-primary-500)]/15 border border-[var(--color-border-default)] flex items-center justify-center">
              <span className="text-sm font-semibold text-[var(--color-primary-300)]">AX</span>
            </div>
            <div className="text-sm text-[var(--color-text-secondary)]">Agent for X</div>
          </div>

          <div className="flex items-center gap-4">
            <Link className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]" href="/login">
              sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-14 pt-12">
        <section className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-10">
          <div className="lg:col-span-7">
            <h1 className="text-heading text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">
              turn long-form ideas into x posts that actually sound like you.
            </h1>
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
              <Card className="p-4 sm:p-5">
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
                      className="flex-1"
                      aria-invalid={!!error}
                    />
                    <Button
                      type="submit"
                      loading={status === "loading"}
                      disabled={!canSubmit || status === "loading"}
                    >
                      {status === "loading" ? "joining…" : "join waitlist"}
                    </Button>
                  </form>
                )}

                {error ? (
                  <div className="mt-2 text-xs text-[var(--color-danger-400)]">{error}</div>
                ) : null}
              </Card>
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
            <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4 sm:p-5">
              <div className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">example draft</div>
              <div className="mt-3 space-y-3 text-sm text-[var(--color-text-secondary)]">
                <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white/5 p-3">
                  <div className="text-[var(--color-text-primary)] font-medium">post</div>
                  <p className="mt-2 leading-relaxed">
                    the real skill isn’t writing more.
                    it’s keeping the sharp idea intact while making it readable.
                  </p>
                  <p className="mt-2 leading-relaxed">
                    • cut the setup
                    • keep the point
                    • add a concrete next step
                  </p>
                </div>

                <div className="rounded-lg border border-[var(--color-border-subtle)] bg-white/5 p-3">
                  <div className="text-[var(--color-text-primary)] font-medium">thread</div>
                  <p className="mt-2 leading-relaxed">
                    1/ most people lose the reader before the idea shows up.
                  </p>
                  <p className="mt-2 leading-relaxed">
                    2/ if your claim can’t survive one example, it’s not ready.
                  </p>
                  <p className="mt-2 leading-relaxed">
                    3/ the draft isn’t the asset. the asset is the structure you reuse.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-14 border-t border-[var(--color-border-subtle)] pt-8 text-sm text-[var(--color-text-muted)]">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>© {new Date().getFullYear()} agent for x</div>
            <div className="flex gap-4">
              <Link className="hover:text-[var(--color-text-secondary)]" href="/agent-for-x/privacy">
                privacy
              </Link>
              <Link className="hover:text-[var(--color-text-secondary)]" href="/agent-for-x/terms">
                terms
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
