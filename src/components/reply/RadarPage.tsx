"use client";

import { useState } from "react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { Button } from "@/components/ui/Button";
import { useRadarQueue } from "./useRadarQueue";
import { QueueRail } from "./QueueRail";
import { ReplyDesk } from "./ReplyDesk";
import { FirstRunReveal } from "./FirstRunReveal";
import { DoneForToday } from "./DoneForToday";
import type { QueueFilter, RadarTarget, SkipReason, Watch } from "./types";

/**
 * Radar — the daily reply desk. Left rail: watches + the bounded, ranked
 * queue ("your 20-minute session, pre-hunted", PRD §3.4). Right pane: the
 * reply desk for the selected target. The rail is the ritual; the desk is
 * the work.
 */
export function RadarPage() {
  const queue = useRadarQueue();
  const [rawFilter, setFilter] = usePersistentState<QueueFilter>("radar:filter", "new");
  // Older sessions may have persisted the retired "snoozed" filter.
  const filter: QueueFilter = rawFilter === "replied" ? "replied" : "new";
  const [selectedKey, setSelectedKey] = usePersistentState<string | null>("radar:selected", null);
  const [watchFilter, setWatchFilter] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"rail" | "desk">("rail");
  const [focusNonce, setFocusNonce] = useState(0);
  const [sweepNotice, setSweepNotice] = useState<string | null>(null);

  // Date stamp: computed once per mount; suppressHydrationWarning below
  // absorbs any server/client timezone drift in the prerendered text.
  const [edition] = useState(() =>
    new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase()
  );

  const visible = queue.targets.filter(
    (t) => t.state === filter && (!watchFilter || t.watchId === watchFilter)
  );
  const selected = queue.targets.find((t) => t.key === selectedKey) ?? null;

  /** Chip body click: narrow the queue to one watch (click again to clear). */
  function filterByWatch(w: Watch) {
    setWatchFilter((prev) => (prev === w.id ? null : w.id));
  }

  /** Chip × / struck-chip click: pause or resume the watch itself. */
  function toggleWatch(w: Watch) {
    queue.toggleWatch(w);
    if (w.enabled && watchFilter === w.id) setWatchFilter(null);
  }

  function select(t: RadarTarget) {
    setSelectedKey(t.key);
    setMobileView("desk");
  }

  /** After triaging away the selected card, move the desk to the next new one. */
  function advanceFrom(t: RadarTarget) {
    const next = queue.targets.find((x) => x.state === "new" && x.key !== t.key) ?? null;
    setSelectedKey(next?.key ?? null);
    if (!next) setMobileView("rail");
  }

  function handleSkip(t: RadarTarget, reason: SkipReason) {
    queue.setState(t, "skipped", reason);
    if (selectedKey === t.key) advanceFrom(t);
  }

  function handleHandedOff(t: RadarTarget) {
    queue.setState(t, "replied");
    advanceFrom(t);
  }

  async function handleSweep() {
    setSweepNotice(null);
    const out = await queue.sweep();
    setSweepNotice(out.message);
  }

  function focusComposer() {
    if (!selected && visible[0]) setSelectedKey(visible[0].key);
    setMobileView("desk");
    setFocusNonce((n) => n + 1);
  }

  // Rail-body overrides, in precedence order: loading → beta gate → error →
  // first-run reveal → done-for-today / quiet empties.
  const firstRun =
    queue.loaded && !queue.notBeta && queue.targets.length === 0 && !queue.lastSweptAt;
  const cleared =
    queue.loaded &&
    filter === "new" &&
    queue.counts.new === 0 &&
    !!queue.lastSweptAt &&
    queue.targets.length > 0;

  let railBody: React.ReactNode | undefined;
  if (!queue.loaded) {
    railBody = (
      <p className="px-4 py-6 text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
        reading the wires…
      </p>
    );
  } else if (queue.notBeta) {
    railBody = (
      <div className="px-4 py-6 space-y-2">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-secondary)]">
          Radar beta
        </p>
        <p className="text-sm text-[var(--color-text-secondary)]">
          The pre-hunted queue isn&apos;t enabled for this account yet. You can still hunt
          manually below.
        </p>
      </div>
    );
  } else if (queue.loadError) {
    railBody = (
      <div className="px-4 py-6 space-y-3">
        <p className="text-sm text-[var(--color-danger-400)]">{queue.loadError}</p>
        <Button variant="secondary" size="sm" onClick={queue.fetchQueue}>
          Retry
        </Button>
      </div>
    );
  } else if (firstRun) {
    railBody = <FirstRunReveal sweep={queue.sweep} sweeping={queue.sweeping} />;
  } else if (cleared) {
    railBody = (
      <DoneForToday
        repliedCount={queue.counts.replied}
        onReviewReplied={() => setFilter("replied")}
      />
    );
  } else if (visible.length === 0) {
    railBody = (
      <p className="px-4 py-6 text-sm text-[var(--color-text-muted)]">
        {watchFilter
          ? "Nothing from this watch right now — click the chip again to show all."
          : filter === "replied"
            ? "Handoffs land here — with their outcomes, soon."
            : "Nothing new from the last sweep — the radar keeps watching."}
      </p>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Masthead: double rule, edition stamp — today's edition, not a feed. */}
      <div className="flex items-end justify-between gap-4 border-b-[3px] border-double border-[var(--color-border-strong)] pb-3 mb-6">
        <div>
          <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)]">
            Radar
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Your 20-minute reply session, pre-hunted.
          </p>
        </div>
        <p
          className="text-xs uppercase tracking-[0.14em] text-[var(--color-text-muted)] whitespace-nowrap hidden sm:block"
          suppressHydrationWarning
        >
          {edition ? `edition · ${edition}` : ""}
        </p>
      </div>

      <div className="lg:grid lg:grid-cols-[400px_minmax(0,1fr)] border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] lg:h-[calc(100vh-13rem)] lg:min-h-[520px]">
        <div
          className={`${
            mobileView === "desk" ? "hidden lg:flex" : "flex"
          } flex-col min-h-0 lg:border-r lg:border-[var(--color-border-default)]`}
        >
          <QueueRail
            visible={visible}
            counts={queue.counts}
            filter={filter}
            onFilter={setFilter}
            selectedKey={selectedKey}
            onSelect={select}
            onSkip={handleSkip}
            onFocusComposer={focusComposer}
            watches={queue.watches}
            activeWatchId={watchFilter}
            lastSweptAt={queue.lastSweptAt}
            unitsPaused={queue.unitsPaused}
            sweeping={queue.sweeping}
            onFilterWatch={filterByWatch}
            onToggleWatch={toggleWatch}
            onAddWatch={queue.addWatch}
            onSweep={handleSweep}
            sweepNotice={sweepNotice}
            onHuntResults={(targets) => {
              queue.mergeHunt(targets);
              setFilter("new");
            }}
          >
            {railBody}
          </QueueRail>
        </div>

        <div
          className={`${mobileView === "rail" ? "hidden lg:flex" : "flex"} flex-col min-h-0`}
        >
          <ReplyDesk
            target={selected}
            queueCount={queue.counts.new}
            onHandedOff={handleHandedOff}
            onBack={() => setMobileView("rail")}
            focusNonce={focusNonce}
          />
        </div>
      </div>
    </div>
  );
}
