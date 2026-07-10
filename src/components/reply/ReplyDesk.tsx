"use client";

import { useEffect, useRef } from "react";
import { Button, IconButton } from "@/components/ui/Button";
import { ArrowLeft, Copy, Send } from "lucide-react";
import { usePersistentState } from "@/hooks/usePersistentState";
import { DeskHeader } from "./DeskHeader";
import { DeskComposer } from "./DeskComposer";
import { useHandoff } from "./useHandoff";
import type { RadarTarget } from "./types";

/**
 * The right pane: the reply desk for the selected target. Full post +
 * why-reasons up top, the assistant composer in the middle, and the pure
 * handoff actions at the bottom — replies never publish via the API
 * (PRD R2.5); the user posts with their own final keystroke.
 */
export function ReplyDesk({
  target,
  queueCount,
  onHandedOff,
  onBack,
  focusNonce,
}: {
  target: RadarTarget | null;
  queueCount: number;
  onHandedOff: (t: RadarTarget) => void;
  onBack: () => void;
  focusNonce: number;
}) {
  // The in-progress reply survives navigation; a different target on the
  // desk starts a fresh draft.
  const [replyText, setReplyText] = usePersistentState("radar:draft", "");
  const [draftKey, setDraftKey] = usePersistentState<string | null>("radar:draftKey", null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (target && target.key !== draftKey) {
      setDraftKey(target.key);
      setReplyText("");
    }
  }, [target, draftKey, setDraftKey, setReplyText]);

  // Keyboard "r"/Enter from the rail lands the caret in the editor.
  useEffect(() => {
    if (focusNonce === 0) return;
    bodyRef.current
      ?.querySelector<HTMLElement>('[contenteditable="true"], textarea')
      ?.focus();
  }, [focusNonce]);

  const { posting, handoffError, replyOnX, copyAndOpen } = useHandoff({ onHandedOff });

  if (!target) {
    return (
      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="text-center space-y-2">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-text-muted)]">
            The desk is clear
          </p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Pick a card from the queue to start writing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div ref={bodyRef} className="flex flex-col min-h-0 h-full">
      {/* < lg: the rail is hidden while the desk is open — give it a way back. */}
      <div className="lg:hidden flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border-default)]">
        <IconButton
          icon={<ArrowLeft className="w-4 h-4" />}
          aria-label="Back to queue"
          onClick={onBack}
        />
        <span className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          Queue ({queueCount})
        </span>
      </div>

      <DeskHeader target={target} />
      <DeskComposer target={target} replyText={replyText} onChangeText={setReplyText} />

      <div className="px-6 py-4 border-t border-[var(--color-border-default)]">
        {handoffError && (
          <p className="text-sm text-[var(--color-danger-400)] mb-2">{handoffError}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => replyOnX(target, replyText)}
            loading={posting}
            disabled={posting || !replyText.trim()}
            icon={<Send className="w-4 h-4" />}
          >
            {posting ? "Opening X…" : "Reply on X"}
          </Button>
          <Button
            variant="secondary"
            onClick={() => copyAndOpen(target, replyText)}
            disabled={posting || !replyText.trim()}
            icon={<Copy className="w-4 h-4" />}
          >
            Copy & open post
          </Button>
          <span className="ml-auto text-xs text-[var(--color-text-muted)] hidden sm:block">
            You post it on X — replies never publish via the API.
          </span>
        </div>
      </div>
    </div>
  );
}
