"use client";

import { Button } from "@/components/ui/Button";
import { RefreshCw } from "lucide-react";
import { formatAge, type Watch } from "./types";

// A disabled watch is struck through in rubric — the copyeditor killed it,
// but it stays on the desk to be picked back up.
function WatchChip({ watch, onToggle }: { watch: Watch; onToggle: (w: Watch) => void }) {
  return (
    <button
      onClick={() => onToggle(watch)}
      title={
        watch.enabled
          ? `Watching "${watch.label}" — click to pause`
          : `Paused — click to resume watching "${watch.label}"`
      }
      className={`inline-flex items-center gap-[1ch] border px-[1.5ch] text-xs uppercase tracking-[0.1em] leading-6 whitespace-nowrap transition-colors duration-100 ease-linear ${
        watch.enabled
          ? "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]"
          : "border-[var(--color-border-subtle)] text-[var(--color-text-muted)] line-through decoration-[var(--color-accent-500)] decoration-[1.5px]"
      }`}
    >
      <span
        className={`inline-block w-[7px] h-[7px] shrink-0 ${
          watch.enabled ? "bg-[var(--color-success-500)]" : "bg-[var(--color-text-muted)]"
        }`}
      />
      {watch.label}
    </button>
  );
}

/**
 * Rail header: the user's watches (system-seeded from their niche,
 * user-trimmed) + the manual sweep trigger. The ghost chip is the slot
 * where custom-watch creation lands (Wk 7–10).
 */
export function WatchBar({
  watches,
  lastSweptAt,
  unitsPaused,
  sweeping,
  onToggleWatch,
  onSweep,
  notice,
}: {
  watches: Watch[];
  lastSweptAt: string | null;
  unitsPaused: number;
  sweeping: boolean;
  onToggleWatch: (w: Watch) => void;
  onSweep: () => void;
  notice?: string | null;
}) {
  const sweptAge = lastSweptAt ? formatAge(lastSweptAt) : null;
  return (
    <div className="px-4 py-3 border-b border-[var(--color-border-default)] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          Watches
        </span>
        <div className="flex items-center gap-[2ch]">
          <span className="text-xs text-[var(--color-text-muted)] whitespace-nowrap">
            {sweptAge ? `swept ${sweptAge} ago` : "never swept"}
          </span>
          <Button
            variant="secondary"
            size="sm"
            onClick={onSweep}
            loading={sweeping}
            icon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Sweep
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-[1ch] gap-y-1.5">
        {watches.map((w) => (
          <WatchChip key={w.id} watch={w} onToggle={onToggleWatch} />
        ))}
        <span
          title="Custom watches — coming soon"
          aria-disabled="true"
          className="inline-flex items-center gap-[1ch] border border-dotted border-[var(--color-border-default)] px-[1.5ch] text-xs uppercase tracking-[0.1em] leading-6 text-[var(--color-text-muted)] cursor-default select-none"
        >
          + add watch
        </span>
      </div>

      {notice && <p className="text-xs text-[var(--color-text-muted)]">{notice}</p>}
      {unitsPaused > 0 && (
        <p className="text-xs text-[var(--color-text-muted)]">
          {unitsPaused} watch{unitsPaused > 1 ? "es" : ""} paused until tomorrow (daily read
          budget).
        </p>
      )}
    </div>
  );
}
