"use client";

import { useEffect, useRef, useState } from "react";
import { Smile } from "lucide-react";

/**
 * Dependency-free emoji picker: a small popover with a curated set of common
 * emoji, grouped by category. Calls `onPick` with the chosen emoji so the parent
 * can insert it at the textarea cursor. Closes on outside click or Escape.
 */

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: [
      "😀","😃","😄","😁","😆","😅","😂","🤣","🙂","🙃","😉","😊","😇","🥰","😍","😘",
      "😋","😛","😜","🤪","🤨","🧐","🤓","😎","🥳","😏","😌","😔","🤔","🤗","🤭","😴",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍","👎","👌","🤌","✌️","🤞","🤟","🤘","👈","👉","👆","👇","👋","🙌","👏","🙏",
      "💪","🫶","🤝","✍️","🫡","🤙",
    ],
  },
  {
    label: "Hearts",
    emojis: ["❤️","🧡","💛","💚","💙","💜","🖤","🤍","💯","💢","💥","💫","✨","🔥","⭐","🌟"],
  },
  {
    label: "Objects",
    emojis: [
      "🚀","📈","📉","📊","💡","🔑","🎯","🛠️","⚙️","🧠","💰","💸","🏆","🎉","🎁","📌",
      "🔗","📝","✅","❌","⚠️","🚨","⏰","🔒","🔓","👀","💬","📢",
    ],
  },
  {
    label: "Symbols",
    emojis: ["➡️","⬅️","⬆️","⬇️","🔁","♻️","❓","❗","➕","➖","✔️","🆕","🆓","🔝"],
  },
];

export function EmojiPicker({ onPick }: { onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors"
        title="Insert emoji"
        aria-expanded={open}
      >
        <Smile className="w-4 h-4" />
      </button>

      {open && (
        <div
          className="absolute z-20 bottom-full mb-2 left-0 w-72 max-h-72 overflow-y-auto rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] p-3 shadow-lg"
          role="dialog"
          aria-label="Emoji picker"
        >
          {EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-3 last:mb-0">
              <p className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)] mb-1.5">
                {group.label}
              </p>
              <div className="grid grid-cols-8 gap-0.5">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onPick(emoji);
                      setOpen(false);
                    }}
                    className="text-lg leading-none p-1 rounded hover:bg-[var(--color-bg-hover)] transition-colors"
                    title={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
