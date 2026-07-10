"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RefreshCw, X } from "lucide-react";
import { formatAge, type Watch } from "./types";

// Chip body = filter the queue to this watch's posts; the hover-× kills the
// watch (struck through in rubric — the copyeditor's strike; click the
// struck chip to resurrect it).
function WatchChip({
  watch,
  active,
  onFilter,
  onToggle,
}: {
  watch: Watch;
  active: boolean;
  onFilter: (w: Watch) => void;
  onToggle: (w: Watch) => void;
}) {
  if (!watch.enabled) {
    return (
      <button
        onClick={() => onToggle(watch)}
        title={`Paused — click to resume watching "${watch.label}"`}
        className="inline-flex items-center gap-[1ch] border border-[var(--color-border-subtle)] px-[1.5ch] text-xs uppercase tracking-[0.1em] leading-6 whitespace-nowrap text-[var(--color-text-muted)] line-through decoration-[var(--color-accent-500)] decoration-[1.5px] transition-colors duration-100 ease-linear hover:border-[var(--color-border-default)]"
      >
        <span className="inline-block w-[7px] h-[7px] shrink-0 bg-[var(--color-text-muted)]" />
        {watch.label}
      </button>
    );
  }

  return (
    <span
      className={`group inline-flex items-stretch border transition-colors duration-100 ease-linear ${
        active
          ? "border-[var(--color-border-strong)] bg-[var(--color-bg-hover)]"
          : "border-[var(--color-border-default)] hover:border-[var(--color-border-strong)]"
      }`}
    >
      <button
        onClick={() => onFilter(watch)}
        title={
          active
            ? "Showing only this watch — click to show all"
            : `Show only posts from "${watch.label}"`
        }
        className={`inline-flex items-center gap-[1ch] px-[1.5ch] text-xs uppercase tracking-[0.1em] leading-6 whitespace-nowrap transition-colors duration-100 ease-linear ${
          active
            ? "text-[var(--color-text-primary)] font-bold"
            : "text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]"
        }`}
      >
        <span
          className={`inline-block w-[7px] h-[7px] shrink-0 ${
            active ? "bg-[var(--color-accent-500)]" : "bg-[var(--color-success-500)]"
          }`}
        />
        {watch.label}
      </button>
      <button
        onClick={() => onToggle(watch)}
        title={`Stop watching "${watch.label}"`}
        aria-label={`Turn off watch ${watch.label}`}
        className="hidden group-hover:inline-flex items-center px-[0.5ch] text-[var(--color-text-muted)] hover:text-[var(--color-accent-400)] transition-colors duration-100"
      >
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}

/**
 * Rail header: the user's watches (system-seeded from their niche,
 * user-trimmed) + the manual sweep trigger. "+ add watch" creates a
 * custom watch from a phrase (custom tracker v1 — no test-sweep preview
 * yet). Sweeps also run automatically via the daily-ops cron.
 */
export function WatchBar({
  watches,
  activeWatchId,
  lastSweptAt,
  unitsPaused,
  sweeping,
  onFilterWatch,
  onToggleWatch,
  onAddWatch,
  onSweep,
  notice,
}: {
  watches: Watch[];
  activeWatchId: string | null;
  lastSweptAt: string | null;
  unitsPaused: number;
  sweeping: boolean;
  onFilterWatch: (w: Watch) => void;
  onToggleWatch: (w: Watch) => void;
  onAddWatch: (phrase: string) => Promise<{ ok: boolean; message: string }>;
  onSweep: () => void;
  notice?: string | null;
}) {
  const [adding, setAdding] = useState(false);
  const [phrase, setPhrase] = useState("");
  const [saving, setSaving] = useState(false);
  const [addNotice, setAddNotice] = useState<string | null>(null);

  async function submitWatch() {
    const p = phrase.trim();
    if (!p || saving) return;
    setSaving(true);
    const out = await onAddWatch(p);
    setSaving(false);
    setAddNotice(out.message);
    if (out.ok) {
      setPhrase("");
      setAdding(false);
    }
  }

  const sweptAge = lastSweptAt ? formatAge(lastSweptAt) : null;
  return (
    <div className="px-4 py-3 border-b border-[var(--color-border-default)] space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          Watches
        </span>
        <div className="flex items-center gap-[2ch]">
          <span
            className="text-xs text-[var(--color-text-muted)] whitespace-nowrap"
            title="Sweeps run automatically every day; this button is the 'I just sat down' refresh."
          >
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
          <WatchChip
            key={w.id}
            watch={w}
            active={activeWatchId === w.id}
            onFilter={onFilterWatch}
            onToggle={onToggleWatch}
          />
        ))}
        {adding ? (
          <span className="inline-flex items-center gap-[1ch]">
            <input
              autoFocus
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitWatch();
                if (e.key === "Escape") {
                  setAdding(false);
                  setPhrase("");
                }
              }}
              placeholder="phrase to watch…"
              maxLength={80}
              className="w-[24ch] bg-transparent border-b border-[var(--color-border-default)] focus:border-[var(--color-text-secondary)] text-xs leading-6 text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none caret-[var(--color-accent-500)] transition-colors duration-100"
            />
            <button
              onClick={submitWatch}
              disabled={!phrase.trim() || saving}
              className="text-xs uppercase tracking-[0.08em] leading-6 px-[1ch] border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)] disabled:opacity-50 transition-colors duration-100"
            >
              {saving ? "adding…" : "add"}
            </button>
          </span>
        ) : (
          <button
            onClick={() => {
              setAdding(true);
              setAddNotice(null);
            }}
            className="inline-flex items-center gap-[1ch] border border-dotted border-[var(--color-border-default)] px-[1.5ch] text-xs uppercase tracking-[0.1em] leading-6 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] transition-colors duration-100"
          >
            + add watch
          </button>
        )}
      </div>

      {addNotice && <p className="text-xs text-[var(--color-text-muted)]">{addNotice}</p>}
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
