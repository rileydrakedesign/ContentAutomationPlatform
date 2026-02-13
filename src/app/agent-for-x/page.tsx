"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ------------------------------------------------------------------ */
/*  WaitlistForm                                                       */
/* ------------------------------------------------------------------ */
function WaitlistForm({
  email,
  setEmail,
  status,
  error,
  canSubmit,
  submit,
}: {
  email: string;
  setEmail: (v: string) => void;
  status: "idle" | "loading" | "success" | "error";
  error: string | null;
  canSubmit: boolean;
  submit: (e: React.FormEvent) => void;
}) {
  if (status === "success") {
    return (
      <div className="rounded-lg border border-[var(--color-success-500)]/20 bg-[var(--color-success-500)]/10 p-4 text-center">
        <div className="text-sm text-[var(--color-success-400)] font-medium">
          you&apos;re in.
        </div>
        <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
          we&apos;ll email you when early access opens.
        </div>
      </div>
    );
  }

  return (
    <div>
      <form
        onSubmit={submit}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        <label className="sr-only" htmlFor="waitlist-email">
          email
        </label>
        <input
          id="waitlist-email"
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
      {error ? (
        <p className="mt-2 text-xs text-[var(--color-danger-400)]">{error}</p>
      ) : (
        <p className="mt-3 text-xs text-[var(--color-text-muted)]">
          no spam. no selling your email. unsubscribe anytime.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AgentForXLanding() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [waitlistCount, setWaitlistCount] = useState(47);
  const canSubmit = useMemo(() => isValidEmail(email), [email]);

  useEffect(() => {
    fetch("/api/waitlist")
      .then((r) => r.json())
      .then((d) => {
        if (d.count) setWaitlistCount(d.count);
      })
      .catch(() => {});
  }, []);

  const submit = useCallback(
    async (e: React.FormEvent) => {
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

        setWaitlistCount((c) => c + 1);
        setStatus("success");
      } catch (err) {
        setStatus("error");
        setError(
          err instanceof Error ? err.message : "failed to join waitlist"
        );
      }
    },
    [canSubmit, email]
  );

  const formProps = { email, setEmail, status, error, canSubmit, submit };

  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-auto bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* ---- Nav (logo only) ---- */}
      <nav className="sticky top-0 z-10 flex-shrink-0 bg-[var(--color-bg-base)]/80 backdrop-blur-xl border-b border-[var(--color-border-subtle)]">
        <div className="mx-auto flex max-w-5xl items-center px-4 py-4 sm:px-6">
          <span className="flex items-center gap-1.5">
            <span
              className="overflow-hidden flex-shrink-0"
              style={{ height: 24 }}
            >
              <span
                className="font-extrabold text-white uppercase tracking-tight whitespace-nowrap block"
                style={{ fontSize: 32, lineHeight: 1, marginTop: -5 }}
              >
                Agents For
              </span>
            </span>
            <span
              className="bg-amber-500 flex items-center justify-center flex-shrink-0 rounded overflow-hidden"
              style={{ width: 24, height: 24 }}
            >
              <Image src="/x-logo.png" alt="X" width={30} height={30} />
            </span>
          </span>
        </div>
      </nav>

      {/* ---- Hero (vertically centered) ---- */}
      <main className="relative flex flex-1 items-center justify-center px-4 sm:px-6">
        {/* Decorative glow blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/4 h-[500px] w-[500px] rounded-full blur-3xl opacity-[0.12]"
          style={{
            background:
              "radial-gradient(circle, rgba(99,102,241,0.6) 0%, transparent 70%)",
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 right-1/4 h-[400px] w-[400px] rounded-full blur-3xl opacity-[0.10]"
          style={{
            background:
              "radial-gradient(circle, rgba(249,115,22,0.5) 0%, transparent 70%)",
          }}
        />

        <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
          {/* Waitlist counter */}
          <div
            className="animate-fade-in"
            style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
          >
            <Badge variant="primary" dot>
              {waitlistCount}+ people on the waitlist
            </Badge>
          </div>

          {/* Headline */}
          <h1
            className="mt-6 text-4xl font-semibold tracking-tight leading-tight sm:text-5xl lg:text-6xl max-w-3xl animate-slide-up"
            style={{
              animationDelay: "100ms",
              animationFillMode: "backwards",
            }}
          >
            ai agents that live{" "}
            <span className="gradient-text">
              inside your x timeline
            </span>
          </h1>

          {/* Subhead */}
          <p
            className="mt-5 max-w-xl text-base sm:text-lg text-[var(--color-text-secondary)] leading-relaxed animate-slide-up"
            style={{
              animationDelay: "200ms",
              animationFillMode: "backwards",
            }}
          >
            save posts that inspire you with one click. generate replies in
            your voice. let patterns compound your growth.
          </p>

          {/* Inline waitlist form */}
          <div
            className="mt-8 w-full max-w-md animate-slide-up"
            style={{
              animationDelay: "300ms",
              animationFillMode: "backwards",
            }}
          >
            <WaitlistForm {...formProps} />
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="flex-shrink-0 border-t border-[var(--color-border-subtle)] px-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-center py-6 text-sm text-[var(--color-text-muted)]">
          <div className="flex items-center gap-1">
            &copy; {new Date().getFullYear()}
            <span
              className="overflow-hidden flex-shrink-0"
              style={{ height: 14 }}
            >
              <span
                className="font-extrabold text-white uppercase tracking-tight whitespace-nowrap block"
                style={{ fontSize: 18, lineHeight: 1, marginTop: -3 }}
              >
                Agents For
              </span>
            </span>
            <span
              className="bg-amber-500 flex items-center justify-center flex-shrink-0 rounded overflow-hidden"
              style={{ width: 14, height: 14 }}
            >
              <Image src="/x-logo.png" alt="X" width={18} height={18} />
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
