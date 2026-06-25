"use client";

import { useRef } from "react";
import { EmojiPicker } from "./EmojiPicker";
import { CharCounter } from "./CharCounter";

/**
 * Shared composer textarea: an X-styled textarea with an emoji picker that
 * inserts at the cursor and an X-accurate character counter. Used by the post
 * and thread editors so every compose surface has the same affordances.
 */
export function ComposeTextarea({
  value,
  onChange,
  placeholder,
  minHeightClass = "min-h-[120px]",
  rows,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Tailwind min-height class for the textarea. */
  minHeightClass?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function insertEmoji(emoji: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + emoji + value.slice(end);
    onChange(next);
    // Restore the caret just after the inserted emoji on the next frame (after
    // React re-renders the controlled value).
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + emoji.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="space-y-1.5">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className={`w-full bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg px-3 py-2 text-sm text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)] focus:ring-1 focus:ring-[var(--color-primary-500)] transition ${minHeightClass}`}
      />
      <div className="flex items-center justify-between">
        <EmojiPicker onPick={insertEmoji} />
        <CharCounter text={value} />
      </div>
    </div>
  );
}
