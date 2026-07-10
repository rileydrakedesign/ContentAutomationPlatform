"use client";

import { HighlightedTextarea } from "@/components/compose/HighlightedTextarea";
import { AssistantScorePanel, AssistantSuggestionList } from "@/components/assistant/AssistantPanel";
import { useAssistant } from "@/components/assistant/useAssistant";

/**
 * One tweet of a thread with the writing assistant live (Grammarly-for-tweets).
 *
 * Every tweet gets Tier-0 underlines and the L2 score (`enabled: true`); only the
 * FOCUSED tweet auto-runs the L3 LLM live-read (`autoLiveRead: focused`) so a
 * six-tweet thread doesn't fan out six LLM reads at once. The focused tweet also
 * shows the compact score panel inline beside its editor (the CreatePage grid
 * pattern, reply-page-narrow 200px column) and the suggestion list full-width
 * below; unfocused tweets keep just the decorated textarea + char counter.
 *
 * Chrome (drag handles, move/remove buttons, "Tweet N" headers) stays in the
 * parents — this component is only the editing surface. Voice guardrails are
 * fetched ONCE in each parent (useVoiceGuardrails) and passed down as props so
 * we don't hit /api/voice/settings per tweet.
 */
export function ThreadTweetEditor({
  text,
  onChangeText,
  index,
  total,
  focused,
  onFocus,
  avoidWords,
  authenticity,
  placeholder,
  minHeightClass = "min-h-[100px]",
}: {
  text: string;
  onChangeText: (next: string) => void;
  index: number;
  total: number;
  focused: boolean;
  onFocus: () => void;
  avoidWords: string[];
  authenticity: number;
  placeholder?: string;
  minHeightClass?: string;
}) {
  const assistant = useAssistant({
    text,
    onChangeText,
    voiceType: "post",
    isThread: true,
    avoidWords,
    authenticity,
    enabled: true,
    autoLiveRead: focused,
  });

  const hasContent = text.trim().length > 0;

  // Char counter (standard 280 limit) comes from HighlightedTextarea's footer.
  const editor = (
    <HighlightedTextarea
      value={text}
      onChange={onChangeText}
      findings={assistant.report.findings}
      onAccept={assistant.accept}
      onDismiss={assistant.dismiss}
      placeholder={placeholder}
      minHeightClass={minHeightClass}
    />
  );

  // Unfocused: just the decorated textarea + counter (underlines still visible).
  if (!focused) {
    return <div onFocus={onFocus}>{editor}</div>;
  }

  const hasSuggestions = assistant.report.findings.length + assistant.report.chips.length > 0;

  return (
    <div className="space-y-3" onFocus={onFocus}>
      {/* Editor + holistic score share one row; suggestions flow below. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_200px] lg:items-center">
        {editor}
        <AssistantScorePanel
          report={assistant.report}
          hasContent={hasContent}
          checking={assistant.checking}
          stale={assistant.stale}
          liveError={assistant.liveError}
          scoreUnavailable={assistant.scoreUnavailable}
        />
      </div>
      {hasContent && hasSuggestions && (
        <p className="text-[11px] font-medium text-[var(--color-text-muted)]">
          Suggestions — Tweet {index + 1} of {total}
        </p>
      )}
      <AssistantSuggestionList
        report={assistant.report}
        hasContent={hasContent}
        checking={assistant.checking}
        onAccept={assistant.accept}
        onDismiss={assistant.dismiss}
      />
    </div>
  );
}
