"use client";

import "prosemirror-view/style/prosemirror.css";
import { useEffect, useRef, useState } from "react";
import { EditorState } from "prosemirror-state";
import { EditorView } from "prosemirror-view";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";
import { EmojiPicker } from "./EmojiPicker";
import { CharCounter } from "./CharCounter";
import { schema, textToDoc, textToSlice, docToText, pmToOffset } from "./pm/model";
import { decorationsPlugin, decoKey, buildDecorations } from "./pm/decorations";
import type { Finding } from "@/lib/analysis/assistant";
import { SuggestionPopover } from "@/components/assistant/SuggestionPopover";

/**
 * Writing-assistant editor — ProseMirror-based (migrated off the textarea+overlay
 * technique for robustness). Underlines are real inline decorations, so they can
 * never drift out of alignment with the glyphs (no pixel-matching backdrop).
 *
 * The public API is unchanged (value/onChange string + findings + accept/dismiss),
 * so call sites didn't change. Internally: a minimal plain-text schema (newlines =
 * paragraphs), a decorations plugin fed from `findings`, and pos↔offset mapping
 * (pm/model.ts, unit-tested) so a finding's character span lands exactly.
 */
export function HighlightedTextarea({
  value,
  onChange,
  findings,
  onAccept,
  onDismiss,
  placeholder,
  minHeightClass = "min-h-[200px]",
  showFooter = true,
}: {
  value: string;
  onChange: (value: string) => void;
  findings: Finding[];
  onAccept?: (finding: Finding) => void;
  onDismiss?: (finding: Finding) => void;
  placeholder?: string;
  minHeightClass?: string;
  showFooter?: boolean;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track the text we last emitted so the value→doc sync doesn't echo/loop.
  const lastEmitted = useRef<string>(value);
  // Latest findings for the hover handler without re-creating the view.
  const findingsRef = useRef<Finding[]>(findings);
  findingsRef.current = findings;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [active, setActive] = useState<{ finding: Finding; top: number; left: number } | null>(null);
  // Mirror `active` into a ref: the mousemove handler is bound once in the
  // create-once effect, so reading the `active` state directly there would always
  // see the initial null and never close the popover on move-off (#7).
  const activeRef = useRef<typeof active>(null);
  activeRef.current = active;
  const [empty, setEmpty] = useState(value.length === 0);

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }
  function scheduleClose() {
    cancelClose();
    closeTimer.current = setTimeout(() => setActive(null), 140);
  }

  // ── Create the editor once. ───────────────────────────────────────────────
  useEffect(() => {
    if (!hostRef.current) return;

    const state = EditorState.create({
      doc: textToDoc(value),
      plugins: [
        history(),
        keymap({ "Mod-z": undo, "Mod-y": redo, "Shift-Mod-z": redo }),
        keymap(baseKeymap),
        decorationsPlugin(),
      ],
    });

    const view = new EditorView(hostRef.current, {
      state,
      attributes: { class: `afx-pm-editor ${minHeightClass}` },
      // Paste plain text through our model so multi-line drafts keep their line
      // breaks (newlines → paragraph breaks), instead of PM collapsing them (#4).
      clipboardTextParser: (clipText) => textToSlice(clipText),
      dispatchTransaction(tr) {
        const next = view.state.apply(tr);
        view.updateState(next);
        const text = docToText(next.doc);
        setEmpty(text.length === 0);
        if (text !== lastEmitted.current) {
          lastEmitted.current = text;
          onChangeRef.current(text);
        }
      },
      handleDOMEvents: {
        mousemove(v, e) {
          const found = hitTest(v, e);
          if (found) {
            cancelClose();
            setActive(found);
          } else if (activeRef.current) {
            scheduleClose();
          }
          return false;
        },
      },
    });
    viewRef.current = view;
    // Seed decorations.
    view.dispatch(view.state.tr.setMeta(decoKey, buildDecorations(view.state.doc, findingsRef.current)));

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync external value changes (Accept, emoji, generation seed). ─────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value === docToText(view.state.doc)) return;
    lastEmitted.current = value;
    const newDoc = textToDoc(value);
    const tr = view.state.tr.replaceWith(0, view.state.doc.content.size, newDoc.content);
    tr.setMeta("addToHistory", false);
    tr.setMeta(decoKey, buildDecorations(newDoc, findingsRef.current));
    view.dispatch(tr);
    setEmpty(value.length === 0);
  }, [value]);

  // ── Push new findings as decorations. ─────────────────────────────────────
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(view.state.tr.setMeta(decoKey, buildDecorations(view.state.doc, findings)));
  }, [findings]);

  useEffect(() => () => cancelClose(), []);

  function hitTest(view: EditorView, e: MouseEvent): { finding: Finding; top: number; left: number } | null {
    const posInfo = view.posAtCoords({ left: e.clientX, top: e.clientY });
    if (!posInfo) return null;
    const offset = pmToOffset(view.state.doc, posInfo.pos);
    const finding = findingsRef.current.find(
      (f) => f.span && offset >= f.span.start && offset < f.span.end
    );
    if (!finding || !finding.span) return null;
    const coords = view.coordsAtPos(Math.max(1, posInfo.pos));
    const wrapRect = wrapRef.current!.getBoundingClientRect();
    return { finding, top: coords.bottom - wrapRect.top + 6, left: coords.left - wrapRect.left };
  }

  function insertEmoji(emoji: string) {
    const view = viewRef.current;
    if (!view) return;
    view.focus();
    view.dispatch(view.state.tr.insertText(emoji));
  }

  return (
    <div className="space-y-1.5">
      <div ref={wrapRef} className="relative" onMouseLeave={scheduleClose}>
        {/* ProseMirror mounts here. */}
        <div ref={hostRef} />

        {empty && placeholder && (
          <div className="pointer-events-none absolute left-3 top-2 text-sm text-[var(--color-text-muted)]">
            {placeholder}
          </div>
        )}

        {active && (
          <div
            className="absolute z-20"
            style={{ top: active.top, left: Math.max(0, active.left) }}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
          >
            <SuggestionPopover
              finding={active.finding}
              onAccept={
                onAccept
                  ? () => {
                      onAccept(active.finding);
                      setActive(null);
                    }
                  : undefined
              }
              onDismiss={
                onDismiss
                  ? () => {
                      onDismiss(active.finding);
                      setActive(null);
                    }
                  : undefined
              }
            />
          </div>
        )}
      </div>

      {showFooter && (
        <div className="flex items-center justify-between">
          <EmojiPicker onPick={insertEmoji} />
          <CharCounter text={value} />
        </div>
      )}
    </div>
  );
}
