"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Clock, X } from "lucide-react";
import { SkipReasonPicker } from "./SkipReasonPicker";
import { formatAge, type RadarTarget, type SkipReason } from "./types";

// GALLEY registration marks: the one selected object per view gets crop
// marks, like the card under review on a paste-up board.
function RegMarks() {
  const base =
    "pointer-events-none absolute w-[9px] h-[9px] border-[var(--color-text-muted)] z-10";
  return (
    <>
      <span aria-hidden className={`${base} -top-[5px] -left-[5px] border-t border-l`} />
      <span aria-hidden className={`${base} -top-[5px] -right-[5px] border-t border-r`} />
      <span aria-hidden className={`${base} -bottom-[5px] -left-[5px] border-b border-l`} />
      <span aria-hidden className={`${base} -bottom-[5px] -right-[5px] border-b border-r`} />
    </>
  );
}

// Slot for the outcome loop (pillar ③): replied rows accrete engage-back /
// profile-click badges here once attribution lands.
function OutcomeBadges({ target }: { target: RadarTarget }) {
  void target;
  return (
    <span className="text-xs text-[var(--color-text-muted)]" title="Reply outcomes attach here once analytics sync catches up">
      <span className="text-[var(--color-text-muted)]">[</span> outcomes soon{" "}
      <span className="text-[var(--color-text-muted)]">]</span>
    </span>
  );
}

/**
 * One card in the queue rail. The row itself is the single primary action —
 * click opens the target on the desk (PRODUCT_FOCUS §5: one card, one
 * action). Snooze/skip are quiet secondaries; skip demands a reason.
 */
export function QueueRow({
  target,
  selected,
  onSelect,
  onSnooze,
  onUnsnooze,
  onSkip,
}: {
  target: RadarTarget;
  selected: boolean;
  onSelect: (t: RadarTarget) => void;
  onSnooze: (t: RadarTarget) => void;
  onUnsnooze: (t: RadarTarget) => void;
  onSkip: (t: RadarTarget, reason: SkipReason) => void;
}) {
  const [pickingSkip, setPickingSkip] = useState(false);
  const age = formatAge(target.postedAt);

  return (
    <div
      role="option"
      aria-selected={selected}
      onClick={() => onSelect(target)}
      className={`relative px-4 py-3 space-y-1.5 cursor-pointer transition-colors duration-100 ease-linear ${
        selected
          ? "bg-[var(--color-bg-hover)]"
          : "hover:bg-[var(--color-bg-elevated)]"
      }`}
    >
      {selected && <RegMarks />}

      <div className="flex items-baseline gap-[1ch] min-w-0">
        <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">
          {target.authorName || "@" + (target.authorUsername || "unknown")}
        </span>
        {target.authorUsername && (
          <span className="text-xs text-[var(--color-text-muted)] truncate">
            @{target.authorUsername}
          </span>
        )}
        {age && (
          <span className="ml-auto text-xs text-[var(--color-text-muted)] whitespace-nowrap shrink-0">
            {age}
          </span>
        )}
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] line-clamp-2">{target.text}</p>

      {pickingSkip ? (
        <SkipReasonPicker
          onPick={(reason) => {
            setPickingSkip(false);
            onSkip(target, reason);
          }}
          onCancel={() => setPickingSkip(false)}
        />
      ) : (
        <div className="flex items-center gap-[2ch] min-w-0">
          {target.reasons[0] && (
            <Badge variant="success" size="sm" className="truncate">
              {target.reasons[0]}
            </Badge>
          )}
          <Badge variant="default" size="sm">
            {target.watchLabel ?? "hunt"}
          </Badge>

          <span
            className="ml-auto flex items-center gap-[1ch] shrink-0"
            onClick={(e) => e.stopPropagation()}
          >
            {target.state === "replied" ? (
              <OutcomeBadges target={target} />
            ) : (
              <>
                {target.state === "new" ? (
                  <button
                    onClick={() => onSnooze(target)}
                    title="Snooze — keep for later"
                    aria-label="Snooze"
                    className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors duration-100"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                ) : (
                  <button
                    onClick={() => onUnsnooze(target)}
                    title="Back to new"
                    aria-label="Unsnooze"
                    className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors duration-100"
                  >
                    <Clock className="w-3.5 h-3.5" />
                  </button>
                )}
                <button
                  onClick={() => setPickingSkip(true)}
                  title="Skip — with a reason, it teaches the radar"
                  aria-label="Skip"
                  className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent-400)] transition-colors duration-100"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
