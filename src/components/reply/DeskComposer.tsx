"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Sparkles } from "lucide-react";
import { HighlightedTextarea } from "@/components/compose/HighlightedTextarea";
import {
  AssistantScorePanel,
  AssistantSuggestionList,
} from "@/components/assistant/AssistantPanel";
import { useAssistant } from "@/components/assistant/useAssistant";
import { useVoiceGuardrails } from "@/components/assistant/useVoiceGuardrails";
import { parseGateError } from "@/lib/utils/gate-error";
import type { RadarTarget } from "./types";

/**
 * Writing-first: the composer is the main event. Generated options are
 * optional starting points that seed the editor; the live assistant runs
 * the same underline/score/accept-fix loop as the draft editor, against
 * the user's REPLY voice.
 */
export function DeskComposer({
  target,
  replyText,
  onChangeText,
}: {
  target: RadarTarget;
  replyText: string;
  onChangeText: (text: string) => void;
}) {
  const [options, setOptions] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // New target on the desk → old starting points no longer apply.
  useEffect(() => {
    setOptions([]);
    setGenerateError(null);
  }, [target.key]);

  const { avoidWords, authenticity } = useVoiceGuardrails("reply");
  const assistant = useAssistant({
    text: replyText,
    onChangeText,
    voiceType: "reply",
    avoidWords,
    authenticity,
    enabled: true,
    autoLiveRead: true,
  });

  async function generateReplies() {
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_text: target.text,
          author_handle: target.authorUsername || "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const gateErr = parseGateError(res.status, data);
        setGenerateError(gateErr ? gateErr.message : data.error || "Failed to generate replies");
        return;
      }
      const replies: string[] = (data.replies || []).map((r: { text?: string } | string) =>
        typeof r === "string" ? r : r.text || ""
      );
      setOptions(replies.filter(Boolean));
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : "Failed to generate replies");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="px-6 py-4 space-y-3">
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={generateReplies}
          loading={generating}
          icon={<Sparkles className="w-4 h-4 text-[var(--color-accent-400)]" />}
        >
          {options.length > 0 ? "More starting points" : "Suggest starting points"}
        </Button>
      </div>

      {options.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-[var(--color-text-muted)]">
            Starting points — pick one, then make it yours below.
          </p>
          <div className="grid grid-cols-1 gap-2">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => onChangeText(opt)}
                className={`text-left text-sm border px-[2ch] py-2 leading-6 transition-colors duration-100 ease-linear ${
                  replyText === opt
                    ? "border-[var(--color-accent-500)] bg-[rgba(224,75,36,0.12)] text-[var(--color-text-primary)]"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-default)]"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-center">
        <HighlightedTextarea
          value={replyText}
          onChange={onChangeText}
          findings={assistant.report.findings}
          onAccept={assistant.accept}
          onDismiss={assistant.dismiss}
          placeholder="Write your reply — the assistant checks voice and clarity as you type…"
          minHeightClass="min-h-[120px]"
        />
        <AssistantScorePanel
          report={assistant.report}
          hasContent={replyText.trim().length > 0}
          checking={assistant.checking}
          stale={assistant.stale}
          liveError={assistant.liveError}
          scoreUnavailable={assistant.scoreUnavailable}
        />
      </div>
      <AssistantSuggestionList
        report={assistant.report}
        hasContent={replyText.trim().length > 0}
        checking={assistant.checking}
        onAccept={assistant.accept}
        onDismiss={assistant.dismiss}
      />

      {generateError && <p className="text-sm text-[var(--color-danger-400)]">{generateError}</p>}
    </div>
  );
}
