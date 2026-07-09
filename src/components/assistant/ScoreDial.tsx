"use client";

/**
 * GALLEY: the "proof grade" — a bordered proofreader's stamp (replaces the
 * circular Grammarly orb). Tiny uppercase eyebrow, a big numeral, a ruled-off
 * verdict. Bands: ≥90 "Clean proof" · 60–89 "Light marks" · <60 "Foul proof"
 * (foul switches border + numeral + verdict to rubric). See docs/design/galley/.
 * Props are unchanged from the original ScoreDial.
 */
export function ScoreDial({
  value,
  label,
  provisional = false,
  pending = false,
  errorCount = 0,
  size = 56,
  checking = false,
}: {
  /** 0-100. */
  value: number;
  label?: string;
  /** Dim the numeral when the score doesn't yet include the LLM components. */
  provisional?: boolean;
  /** No real score yet — show a placeholder instead of a number that will jump. */
  pending?: boolean;
  /** Correctness marks — surfaced in the verdict line. */
  errorCount?: number;
  size?: number;
  checking?: boolean;
}) {
  const scoring = pending || checking;
  const foul = !pending && value < 60;
  const numeralSize = Math.round(size * 0.78);

  const verdict = scoring
    ? "Scoring"
    : value < 60
      ? "Foul proof"
      : value < 90
        ? errorCount > 0
          ? `${errorCount} mark${errorCount > 1 ? "s" : ""}`
          : "Light marks"
        : "Clean proof";

  return (
    <div
      className={`inline-flex shrink-0 flex-col items-center whitespace-nowrap bg-[var(--color-bg-surface)] border px-[2ch] pt-3 pb-2 ${
        foul ? "border-[var(--color-accent-600)]" : "border-[var(--color-border-strong)]"
      }`}
    >
      <span className="text-[10px] uppercase tracking-[0.2em] text-[var(--color-text-muted)]">
        {label ?? "Proof"}
      </span>
      <span
        className={`inline-flex items-center gap-1.5 font-extrabold leading-none ${
          foul ? "text-[var(--color-accent-400)]" : "text-[var(--color-text-primary)]"
        } ${scoring ? "opacity-60" : provisional && !pending ? "opacity-50" : ""}`}
        style={{ fontSize: numeralSize }}
      >
        {pending ? "–" : value}
        {scoring && (
          <span
            aria-hidden
            className="inline-block w-[3px] shrink-0 bg-[var(--color-accent-500)] animate-[blink_1s_steps(1)_infinite]"
            style={{ height: Math.round(numeralSize * 0.62) }}
          />
        )}
      </span>
      <span
        className={`mt-1 w-full border-t pt-1.5 text-center text-xs uppercase tracking-[0.14em] ${
          foul
            ? "border-[var(--color-accent-600)] text-[var(--color-accent-400)]"
            : "border-[var(--color-border-subtle)] text-[var(--color-text-secondary)]"
        }`}
      >
        {verdict}
      </span>
    </div>
  );
}
