import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getPublicVoiceReport } from "@/lib/share/public-voice-report";

export const runtime = "nodejs";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const report = await getPublicVoiceReport(token);
  if (!report) return { title: "Voice Report — Agents For X" };
  const who = report.handle ? `@${report.handle}` : "This creator";
  return {
    title: `${who}'s Voice Report — Agents For X`,
    description:
      report.niche_summary ||
      `The proven patterns mined from ${who}'s own top-performing posts.`,
  };
}

export default async function SharedVoiceReport({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const report = await getPublicVoiceReport(token);
  if (!report) notFound();

  const who = report.handle ? `@${report.handle}` : "This creator";

  return (
    <div className="min-h-screen bg-[var(--color-bg-base)] text-[var(--color-text-primary)] px-4 py-10">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Header — branded, screenshot-ready */}
        <div className="text-center space-y-1">
          <p className="text-xs uppercase tracking-wide text-[var(--color-primary-400)] font-semibold">
            Voice Report
          </p>
          <h1 className="text-2xl font-semibold">{who}&apos;s voice, by the data</h1>
          {report.niche_summary && (
            <p className="text-sm text-[var(--color-text-secondary)]">{report.niche_summary}</p>
          )}
        </div>

        {report.positioning_statement && (
          <div className="rounded-xl border border-[var(--color-primary-500)]/20 bg-[var(--color-primary-500)]/5 p-4 text-center">
            <p className="text-sm font-medium">{report.positioning_statement}</p>
          </div>
        )}

        {/* The proof: patterns mined from their own top posts */}
        {report.patterns.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)]">
              Proven patterns — from {who}&apos;s own top posts
            </h2>
            {report.patterns.map((p, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold">{p.pattern_name}</span>
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400">
                    {p.multiplier.toFixed(1)}× engagement
                  </span>
                </div>
                <p className="text-xs text-[var(--color-text-secondary)] mt-1">{p.pattern_value}</p>
                {p.example && (
                  <p className="mt-2 pl-2 border-l-2 border-[var(--color-primary-500)]/30 text-[11px] text-[var(--color-text-muted)] line-clamp-2">
                    &ldquo;{p.example}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {report.top_post && (
          <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-muted)] mb-1">
              Top post
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">
              {report.top_post.text}
            </p>
            <p className="text-xs text-green-400 mt-2">
              {report.top_post.engagement_score.toLocaleString()} weighted engagement
            </p>
          </div>
        )}

        {/* CTA */}
        <div className="text-center pt-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)]"
          >
            Tune your own voice with Agents For X →
          </Link>
          <p className="text-[11px] text-[var(--color-text-muted)] mt-2">
            Patterns are mined from this account&apos;s own highest-performing posts —
            not generic AI.
          </p>
        </div>
      </div>
    </div>
  );
}
