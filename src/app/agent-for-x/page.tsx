"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import {
  Bookmark,
  Sparkles,
  TrendingUp,
  MessageSquare,
  Zap,
  ShieldCheck,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  useInView — fires once when element enters viewport               */
/* ------------------------------------------------------------------ */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [isInView, setIsInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return { ref, isInView };
}

/* ------------------------------------------------------------------ */
/*  helpers                                                            */
/* ------------------------------------------------------------------ */
function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/* ------------------------------------------------------------------ */
/*  WaitlistForm — shared between hero and final CTA                  */
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
  const canSubmit = useMemo(() => isValidEmail(email), [email]);

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

  /* scroll-triggered sections */
  const howItWorks = useInView();
  const features = useInView();
  const formProps = { email, setEmail, status, error, canSubmit, submit };

  return (
    <div className="fixed inset-0 z-50 min-h-screen overflow-auto bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* ---- Sticky Nav ---- */}
      <nav className="sticky top-0 z-10 bg-[var(--color-bg-base)]/80 backdrop-blur-xl border-b border-[var(--color-border-subtle)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-sm font-semibold tracking-tight">
            agent for x
          </span>
          <Link
            href="/login"
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
          >
            sign in
          </Link>
        </div>
      </nav>

      <main className="relative mx-auto w-full max-w-5xl px-4 sm:px-6">
        {/* ---- Hero ---- */}
        <section className="relative pb-20 pt-16 sm:pt-24">
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

          <div className="relative flex flex-col items-center text-center">
            {/* Waitlist counter */}
            <div
              className="animate-fade-in"
              style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
            >
              <Badge variant="primary" dot>
                47+ people on the waitlist
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
              an ai agent that lives{" "}
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
        </section>

        {/* ---- How It Works ---- */}
        <section
          ref={howItWorks.ref}
          className="pb-20 transition-all duration-700 ease-out motion-reduce:transition-none"
          style={{
            opacity: howItWorks.isInView ? 1 : 0,
            transform: howItWorks.isInView
              ? "translateY(0)"
              : "translateY(24px)",
          }}
        >
          <div className="grid gap-6 sm:grid-cols-3">
            {[
              {
                num: "01",
                Icon: Bookmark,
                title: "save what inspires you",
                desc: "install the chrome extension. save any post from your timeline with one click.",
              },
              {
                num: "02",
                Icon: Zap,
                title: "generate replies and posts",
                desc: "pick a tone and get reply options in seconds, or generate full posts and threads from a topic.",
              },
              {
                num: "03",
                Icon: TrendingUp,
                title: "your system gets smarter",
                desc: "it learns from your top performing posts to shape your voice and surface what actually works.",
              },
            ].map((step, i) => (
              <div
                key={step.num}
                className="flex flex-col items-center text-center transition-all duration-700 ease-out motion-reduce:transition-none"
                style={{
                  opacity: howItWorks.isInView ? 1 : 0,
                  transform: howItWorks.isInView
                    ? "translateY(0)"
                    : "translateY(24px)",
                  transitionDelay: `${i * 100 + 100}ms`,
                }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[var(--color-primary-500)]/20 bg-[var(--color-primary-500)]/10 text-sm font-semibold text-[var(--color-primary-400)]">
                  {step.num}
                </div>
                <step.Icon className="mt-4 h-5 w-5 text-[var(--color-text-muted)]" />
                <h3 className="mt-3 text-sm font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] max-w-xs leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Feature Highlights ---- */}
        <section
          ref={features.ref}
          className="pb-20 transition-all duration-700 ease-out motion-reduce:transition-none"
          style={{
            opacity: features.isInView ? 1 : 0,
            transform: features.isInView
              ? "translateY(0)"
              : "translateY(24px)",
          }}
        >
          <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl max-w-lg mx-auto">
            built for creators who grow through engagement
          </h2>

          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            {[
              {
                Icon: MessageSquare,
                title: "ai reply + post agent",
                desc: "generate on-voice replies with a tone picker, or create full posts and threads from a topic. all from one system that knows how you write.",
              },
              {
                Icon: Bookmark,
                title: "one-click save",
                desc: "see something worth studying? save any post to your inspiration library without ever leaving your timeline.",
              },
              {
                Icon: Sparkles,
                title: "learns from your best work",
                desc: "the system analyzes your top performing posts to extract patterns, voice, and structure. the more data it has, the better it writes.",
              },
              {
                Icon: ShieldCheck,
                title: "guardrails you control",
                desc: "block overused phrases, cringe patterns, and topics you would never touch. built-in quality filters.",
              },
            ].map((feat, i) => (
              <div
                key={feat.title}
                className="glass rounded-xl border border-[var(--color-border-subtle)] p-5 transition-all duration-700 ease-out hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-glow-primary)] motion-reduce:transition-none"
                style={{
                  opacity: features.isInView ? 1 : 0,
                  transform: features.isInView
                    ? "translateY(0)"
                    : "translateY(24px)",
                  transitionDelay: `${i * 100 + 100}ms`,
                }}
              >
                <feat.Icon className="h-5 w-5 text-[var(--color-primary-400)]" />
                <h3 className="mt-3 text-sm font-semibold">{feat.title}</h3>
                <p className="mt-1.5 text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ---- Footer ---- */}
        <footer className="border-t border-[var(--color-border-subtle)] py-8 text-sm text-[var(--color-text-muted)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>&copy; {new Date().getFullYear()} agent for x</div>
            <div className="flex flex-wrap gap-2">
              <Link
                className="rounded-md px-3 py-2 hover:bg-white/5 hover:text-[var(--color-text-secondary)]"
                href="/agent-for-x/privacy"
              >
                privacy
              </Link>
              <Link
                className="rounded-md px-3 py-2 hover:bg-white/5 hover:text-[var(--color-text-secondary)]"
                href="/agent-for-x/terms"
              >
                terms
              </Link>
              <Link
                className="rounded-md px-3 py-2 hover:bg-white/5 hover:text-[var(--color-text-secondary)]"
                href="/login"
              >
                sign in
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
