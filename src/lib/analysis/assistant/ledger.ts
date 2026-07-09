/**
 * Session edit ledger — the assistant's memory of decisions made THIS editing
 * session. Every accepted suggestion is a settled decision; without this, each
 * L3 read is amnesiac: it re-flags the very text an accepted fix just inserted
 * (or proposes reverting it), the finding penalties re-stack, and the user
 * chases an oscillating score while drifting from their own message.
 *
 * Two enforcement layers use this module:
 *   - The prompt: the ledger rides along in the live-read request so the model
 *     is TOLD which edits are settled (advisory).
 *   - The client filter (`contradictsSettled`, applied via mergeReport's
 *     isHidden): incoming live findings that re-flag or revert a settled edit
 *     are hidden — the hard guarantee, independent of model compliance.
 *
 * A ledger entry binds only while its replacement text is still in the draft
 * verbatim (anchorLedger). Once the user rewrites that section themselves, the
 * post has evolved and the span is open for fresh suggestions again.
 *
 * Pure + client-safe (mirrors spans.ts).
 */

import type { Finding, FindingClass } from "./types";
import { resolveQuote } from "./spans";

/** An accepted suggestion: the writer deliberately replaced `before` with `after`. */
export interface AcceptedEdit {
  /** The span text the suggestion replaced (the finding's quote). */
  before: string;
  /** The replacement text now in the draft. */
  after: string;
  class: FindingClass;
  signal?: string;
}

/** A suggestion the writer explicitly dismissed — sent with reads so the model
 *  doesn't re-raise it (the persisted dismiss-keys only hide client-side). */
export interface DeclinedSuggestion {
  quote?: string;
  issue: string;
}

/** An AcceptedEdit whose replacement is currently anchored in the draft. */
export interface AnchoredEdit extends AcceptedEdit {
  start: number;
  end: number;
}

/** Below this many normalized chars, containment is too weak a revert signal
 *  (any fix containing the word "just" would match a "just"-removal edit). */
const REVERT_MIN_CHARS = 12;

function norm(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Resolve each ledger entry's replacement against the current text. Entries
 * whose `after` no longer appears verbatim are dropped: the user rewrote that
 * section, the decision no longer binds. (Deletions — empty `after` — can never
 * anchor and should not be ledgered by callers.)
 */
export function anchorLedger(text: string, ledger: AcceptedEdit[]): AnchoredEdit[] {
  const out: AnchoredEdit[] = [];
  for (const e of ledger) {
    if (!e.after) continue;
    const at = resolveQuote(text, e.after);
    if (at) out.push({ ...e, start: at.start, end: at.end });
  }
  return out;
}

/**
 * Does this incoming finding contradict a settled decision? Two tests:
 *   (a) same-class finding whose span overlaps the accepted replacement's
 *       current location — re-flagging a decision the writer just made;
 *   (b) a one-click fix that substantially restores the pre-accept text — a
 *       revert in new clothes, whatever span or class it claims.
 * Only LIVE findings are filtered: Tier-0 findings state deterministic facts
 * (an external link is an external link even inside an accepted rewrite).
 */
export function contradictsSettled(f: Finding, settled: AnchoredEdit[]): boolean {
  if (f.source !== "live" || settled.length === 0) return false;
  const fix = f.replacement ? norm(f.replacement) : "";
  for (const e of settled) {
    if (f.span && f.class === e.class && f.span.start < e.end && f.span.end > e.start) {
      return true;
    }
    if (fix) {
      const before = norm(e.before);
      if (
        fix === before ||
        (before.length >= REVERT_MIN_CHARS && fix.includes(before)) ||
        (fix.length >= REVERT_MIN_CHARS && before.includes(fix))
      ) {
        return true;
      }
    }
  }
  return false;
}
