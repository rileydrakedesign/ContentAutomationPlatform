"use client";

import { useRef } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/Tabs";
import { QueueRow } from "./QueueRow";
import { WatchBar } from "./WatchBar";
import { HuntManually } from "./HuntManually";
import type { QueueFilter, RadarTarget, SkipReason, Watch } from "./types";

// Slot for real-time alerts (Phase 2): a watched account just posted and the
// window is closing — it pins above the filters with the rubric edge. The
// treatment is designed now; nothing renders until alerts exist.
function UrgentSlot({ target, onSelect }: { target: RadarTarget | null; onSelect: (t: RadarTarget) => void }) {
  if (!target) return null;
  return (
    <button
      onClick={() => onSelect(target)}
      className="w-full text-left px-4 py-2 border-b border-[var(--color-border-default)] border-l-2 border-l-[var(--color-accent-500)] bg-[rgba(224,75,36,0.12)]"
    >
      <span className="text-xs uppercase tracking-[0.12em] text-[var(--color-accent-400)] font-bold">
        wire —{" "}
      </span>
      <span className="text-xs text-[var(--color-text-secondary)]">
        @{target.authorUsername} just posted · window closing
      </span>
    </button>
  );
}

/**
 * The left rail: watches on top, filters as newspaper section heads, the
 * bounded card list, and the demoted manual hunt at the bottom. Keyboard:
 * j/k or arrows move the selection, Enter/r opens the composer.
 */
export function QueueRail({
  visible,
  counts,
  filter,
  onFilter,
  selectedKey,
  onSelect,
  onSkip,
  onFocusComposer,
  watches,
  activeWatchId,
  lastSweptAt,
  unitsPaused,
  sweeping,
  onFilterWatch,
  onToggleWatch,
  onAddWatch,
  onSweep,
  sweepNotice,
  onHuntResults,
  children,
}: {
  visible: RadarTarget[];
  counts: Record<QueueFilter, number>;
  filter: QueueFilter;
  onFilter: (f: QueueFilter) => void;
  selectedKey: string | null;
  onSelect: (t: RadarTarget) => void;
  onSkip: (t: RadarTarget, reason: SkipReason) => void;
  onFocusComposer: () => void;
  watches: Watch[];
  activeWatchId: string | null;
  lastSweptAt: string | null;
  unitsPaused: number;
  sweeping: boolean;
  onFilterWatch: (w: Watch) => void;
  onToggleWatch: (w: Watch) => void;
  onAddWatch: (phrase: string) => Promise<{ ok: boolean; message: string }>;
  onSweep: () => void;
  sweepNotice?: string | null;
  onHuntResults: (targets: RadarTarget[]) => void;
  /** Body override: first-run reveal / done-for-today / notices. */
  children?: React.ReactNode;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  function moveSelection(delta: number) {
    if (visible.length === 0) return;
    const idx = visible.findIndex((t) => t.key === selectedKey);
    const next = visible[Math.min(visible.length - 1, Math.max(0, idx + delta))] ?? visible[0];
    onSelect(next);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    // Don't steal keys from the skip-reason picker or other inner controls.
    if (e.target !== listRef.current) return;
    if (e.key === "ArrowDown" || e.key === "j") {
      e.preventDefault();
      moveSelection(1);
    } else if (e.key === "ArrowUp" || e.key === "k") {
      e.preventDefault();
      moveSelection(-1);
    } else if (e.key === "Enter" || e.key === "r") {
      e.preventDefault();
      onFocusComposer();
    }
  }

  return (
    <section aria-label="Reply queue" className="flex flex-col min-h-0 h-full">
      <WatchBar
        watches={watches}
        activeWatchId={activeWatchId}
        lastSweptAt={lastSweptAt}
        unitsPaused={unitsPaused}
        sweeping={sweeping}
        onFilterWatch={onFilterWatch}
        onToggleWatch={onToggleWatch}
        onAddWatch={onAddWatch}
        onSweep={onSweep}
        notice={sweepNotice}
      />

      <UrgentSlot target={null} onSelect={onSelect} />

      <Tabs value={filter} onValueChange={(v) => onFilter(v as QueueFilter)}>
        <TabsList className="px-4">
          <TabsTrigger value="new" count={counts.new}>
            New
          </TabsTrigger>
          <TabsTrigger value="replied" count={counts.replied}>
            Replied
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div
        ref={listRef}
        role="listbox"
        aria-label={`${filter} targets`}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="flex-1 min-h-0 overflow-y-auto divide-y divide-[var(--color-border-subtle)] focus:outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--color-border-focus)] focus-visible:-outline-offset-1"
      >
        {children ??
          visible.map((t) => (
            <QueueRow
              key={t.key}
              target={t}
              selected={t.key === selectedKey}
              onSelect={onSelect}
              onSkip={onSkip}
            />
          ))}
      </div>

      <HuntManually onResults={onHuntResults} />
    </section>
  );
}
