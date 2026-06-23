/**
 * The ambient-tuner publish gate: a draft may only ship once its voice-check
 * score has been surfaced *for the exact text being shipped*. Editing after a
 * check invalidates it, so the user always sees a score that matches what goes
 * out. Pure + shared so the rule is testable and identical wherever publish is
 * gated (currently the draft editor).
 */
export interface VoiceCheckState {
  /** A voice-check result exists (score was surfaced). */
  hasResult: boolean;
  /** The exact text the surfaced result was computed against. */
  checkedText: string | null;
  /** The current text the user is about to ship. */
  currentText: string;
}

export function isVoiceCheckSurfaced({
  hasResult,
  checkedText,
  currentText,
}: VoiceCheckState): boolean {
  const text = currentText.trim();
  if (!hasResult || text.length === 0) return false;
  return checkedText === currentText;
}
