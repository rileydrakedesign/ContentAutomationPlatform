"use client";

/**
 * The end of the ritual — the anti-vigil promise kept. "-30-" is the
 * old newsroom end-of-copy mark: nothing follows it.
 */
export function DoneForToday({
  repliedCount,
  onReviewReplied,
}: {
  repliedCount: number;
  onReviewReplied: () => void;
}) {
  return (
    <div className="px-6 py-12 text-center space-y-3 animate-fade-in">
      <p
        title="'-30-' — end of copy. Nothing follows."
        className="text-sm font-bold tracking-[0.5em] text-[var(--color-text-primary)] select-none"
      >
        -30-
      </p>
      <p className="text-sm text-[var(--color-text-secondary)]">
        Queue cleared. The radar keeps watching — it refills tomorrow morning.
      </p>
      {repliedCount > 0 && (
        <button
          onClick={onReviewReplied}
          className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:underline"
        >
          review today&apos;s handoffs →
        </button>
      )}
    </div>
  );
}
