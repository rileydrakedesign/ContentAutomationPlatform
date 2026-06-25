"use client";

import { BarChart3, Plus, X as XIcon } from "lucide-react";
import {
  type DraftPoll,
  POLL_DURATIONS,
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
  MAX_POLL_OPTION_LEN,
  DEFAULT_POLL_DURATION,
} from "@/lib/x-api/poll";

/**
 * Poll composer. When `poll` is null it renders the "Add poll" affordance;
 * otherwise it renders X-style option inputs (2–4, ≤25 chars each) and a
 * duration select. Passing null back to `onChange` removes the poll.
 *
 * `disabled` is set when media is already attached — X doesn't allow a poll and
 * media on the same post.
 */
export function PollEditor({
  poll,
  onChange,
  disabled = false,
}: {
  poll: DraftPoll | null;
  onChange: (poll: DraftPoll | null) => void;
  disabled?: boolean;
}) {
  if (!poll) {
    return (
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange({ options: ["", ""], durationMinutes: DEFAULT_POLL_DURATION })}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] disabled:opacity-50 transition-colors"
        title={disabled ? "Remove media to add a poll" : "Add a poll"}
      >
        <BarChart3 className="w-3.5 h-3.5" />
        Add poll
      </button>
    );
  }

  const options = poll.options.length >= MIN_POLL_OPTIONS ? poll.options : ["", ""];

  function setOption(i: number, value: string) {
    const next = [...options];
    next[i] = value;
    onChange({ ...poll!, options: next });
  }

  function addOption() {
    if (options.length >= MAX_POLL_OPTIONS) return;
    onChange({ ...poll!, options: [...options, ""] });
  }

  function removeOption(i: number) {
    if (options.length <= MIN_POLL_OPTIONS) return;
    onChange({ ...poll!, options: options.filter((_, idx) => idx !== i) });
  }

  return (
    <div className="rounded-xl border border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
          <BarChart3 className="w-3.5 h-3.5" />
          Poll
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-xs text-[var(--color-danger-400)] hover:text-[var(--color-danger-300)]"
        >
          Remove poll
        </button>
      </div>

      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={opt}
              maxLength={MAX_POLL_OPTION_LEN}
              onChange={(e) => setOption(i, e.target.value)}
              placeholder={`Choice ${i + 1}`}
              className="flex-1 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg px-3 py-1.5 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)]"
            />
            <span className="text-[10px] text-[var(--color-text-muted)] w-10 text-right tabular-nums">
              {opt.length}/{MAX_POLL_OPTION_LEN}
            </span>
            {options.length > MIN_POLL_OPTIONS && (
              <button
                type="button"
                onClick={() => removeOption(i)}
                className="p-1 rounded text-[var(--color-text-muted)] hover:text-[var(--color-danger-400)]"
                title="Remove choice"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3">
        {options.length < MAX_POLL_OPTIONS ? (
          <button
            type="button"
            onClick={addOption}
            className="inline-flex items-center gap-1 text-xs text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add choice
          </button>
        ) : (
          <span />
        )}

        <label className="flex items-center gap-2 text-xs text-[var(--color-text-secondary)]">
          Duration
          <select
            value={poll.durationMinutes}
            onChange={(e) => onChange({ ...poll, durationMinutes: Number(e.target.value) })}
            className="bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-lg px-2 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)]"
          >
            {POLL_DURATIONS.map((d) => (
              <option key={d.minutes} value={d.minutes}>
                {d.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
