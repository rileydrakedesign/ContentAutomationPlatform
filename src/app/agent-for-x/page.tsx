"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */
export default function AgentForXLanding() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col overflow-auto bg-[var(--color-bg-base)] text-[var(--color-text-primary)]">
      {/* ---- Nav ---- */}
      <nav className="sticky top-0 z-10 flex-shrink-0 bg-[var(--color-bg-base)]/80 backdrop-blur-xl border-b border-[var(--color-border-subtle)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4 sm:px-6">
          <span className="flex items-center gap-1.5">
            <span
              className="overflow-hidden flex-shrink-0"
              style={{ height: 24 }}
            >
              <span
                className="font-extrabold text-[var(--color-text-primary)] uppercase tracking-tight whitespace-nowrap block"
                style={{ fontSize: 32, lineHeight: 1, marginTop: -5 }}
              >
                Agents For
              </span>
            </span>
            <span
              className="bg-[var(--color-warning-500)] flex items-center justify-center flex-shrink-0 rounded overflow-hidden"
              style={{ width: 24, height: 24 }}
            >
              <Image src="/x-logo.png" alt="X" width={30} height={30} />
            </span>
          </span>
          <Link href="/login">
            <Button variant="ghost" size="sm">
              Log in
            </Button>
          </Link>
        </div>
      </nav>

      {/* ---- Hero (vertically centered) ---- */}
      <main className="relative flex flex-1 items-center justify-center px-4 sm:px-6">
        {/* Decorative glow blobs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-32 left-1/4 h-[500px] w-[500px] rounded-full"
          style={{ background: "transparent" }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-16 right-1/4 h-[400px] w-[400px] rounded-full"
          style={{ background: "transparent" }}
        />

        <div className="relative flex w-full max-w-3xl flex-col items-center text-center">
          {/* Badge */}
          <div
            className="animate-fade-in"
            style={{ animationDelay: "0ms", animationFillMode: "backwards" }}
          >
            <Badge variant="primary" dot>
              now in early access
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
            see why your posts land —{" "}
            <span className="text-[var(--color-accent-400)]">
              as you write them
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
            you write the post. as you type, we show where it drifts from your
            voice and where it&apos;ll lose to the algorithm — grounded in your
            own best posts — and fix both in one click.
          </p>

          {/* CTAs */}
          <div
            className="mt-8 flex flex-col sm:flex-row gap-3 animate-slide-up"
            style={{
              animationDelay: "300ms",
              animationFillMode: "backwards",
            }}
          >
            <Link href="/signup">
              <Button size="lg" glow className="sm:min-w-[180px]">
                Get started free
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary" size="lg" className="sm:min-w-[180px]">
                Log in
              </Button>
            </Link>
          </div>
          <p
            className="mt-4 text-xs text-[var(--color-text-muted)] animate-slide-up"
            style={{
              animationDelay: "400ms",
              animationFillMode: "backwards",
            }}
          >
            free to start. no credit card required.
          </p>

          {/* Feature highlights */}
          <div
            className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 w-full max-w-xl animate-slide-up"
            style={{
              animationDelay: "500ms",
              animationFillMode: "backwards",
            }}
          >
            <FeatureCard title="live underlines" desc="cite the real x mechanics" />
            <FeatureCard title="voice match" desc="scored from your own top posts" />
            <FeatureCard title="one-click fixes" desc="you keep the pen" />
          </div>
        </div>
      </main>

      {/* ---- Footer ---- */}
      <footer className="flex-shrink-0 border-t border-[var(--color-border-subtle)] px-4 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-6 text-sm text-[var(--color-text-muted)]">
          <div className="flex items-center gap-1">
            &copy; {new Date().getFullYear()}
            <span
              className="overflow-hidden flex-shrink-0"
              style={{ height: 14 }}
            >
              <span
                className="font-extrabold text-[var(--color-text-primary)] uppercase tracking-tight whitespace-nowrap block"
                style={{ fontSize: 18, lineHeight: 1, marginTop: -3 }}
              >
                Agents For
              </span>
            </span>
            <span
              className="bg-[var(--color-warning-500)] flex items-center justify-center flex-shrink-0 rounded overflow-hidden"
              style={{ width: 14, height: 14 }}
            >
              <Image src="/x-logo.png" alt="X" width={18} height={18} />
            </span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/agent-for-x/terms" className="hover:text-[var(--color-text-secondary)] transition-colors">terms</Link>
            <Link href="/agent-for-x/privacy" className="hover:text-[var(--color-text-secondary)] transition-colors">privacy</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card                                                        */
/* ------------------------------------------------------------------ */
function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="p-4 rounded-xl bg-[var(--color-bg-surface)] border border-[var(--color-border-subtle)] text-center">
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-1">{desc}</p>
    </div>
  );
}
