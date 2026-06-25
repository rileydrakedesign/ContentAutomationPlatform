/**
 * Span utilities — the anchoring layer that makes wrong-position underlines
 * structurally impossible (GRAMMARLY_PIVOT_UX.md §8).
 *
 * The LLM returns a verbatim `quote` for each finding, never character offsets.
 * We resolve offsets locally by searching for that quote. If the quote isn't
 * found verbatim → the finding keeps no span and degrades to a panel-only card.
 *
 * Also: resolve overlaps into non-overlapping render segments (higher-priority
 * class wins a contested character), and apply a single-finding replacement.
 *
 * Pure + client-safe.
 */

import type { Finding, FindingClass } from "./types";
import { FINDING_CLASS_META } from "./types";

/**
 * Find `quote` in `text` and return its offsets, or null if not present verbatim.
 * `hint` biases toward the occurrence nearest a known location (when the LLM also
 * returns an approximate index) so repeated phrases anchor to the intended one.
 */
export function resolveQuote(
  text: string,
  quote: string,
  hint?: number
): { start: number; end: number } | null {
  if (!quote) return null;
  // Collect all occurrences (phrases repeat — "just", a hashtag, a word).
  const occurrences: number[] = [];
  let from = 0;
  for (;;) {
    const idx = text.indexOf(quote, from);
    if (idx === -1) break;
    occurrences.push(idx);
    from = idx + Math.max(1, quote.length);
  }
  if (occurrences.length === 0) return null;

  let start = occurrences[0];
  if (typeof hint === "number" && occurrences.length > 1) {
    // Pick the occurrence whose start is closest to the hint.
    start = occurrences.reduce((best, idx) =>
      Math.abs(idx - hint) < Math.abs(best - hint) ? idx : best
    );
  }
  return { start, end: start + quote.length };
}

/**
 * Resolve every finding's span against the current text. A finding whose quote
 * can't be found verbatim loses its span (becomes a panel-only card) — never an
 * underline drawn at a guessed position. Findings already carrying valid offsets
 * (e.g. deterministic Tier-0) are re-validated against the text and dropped only
 * if the quote no longer matches there.
 */
export function resolveFindings(text: string, findings: Finding[]): Finding[] {
  return findings.map((f) => {
    if (!f.span) return f;
    const { quote, start } = f.span;
    // Trust an existing offset if the text still matches there exactly.
    if (
      typeof start === "number" &&
      text.slice(start, start + quote.length) === quote
    ) {
      return { ...f, span: { quote, start, end: start + quote.length } };
    }
    const resolved = resolveQuote(text, quote, start);
    if (!resolved) {
      // Couldn't anchor — strip the span, keep the card.
      const { span: _drop, ...rest } = f;
      void _drop;
      return rest;
    }
    return { ...f, span: { quote, ...resolved } };
  });
}

export interface RenderSegment {
  start: number;
  end: number;
  text: string;
  /** The finding decorating this segment, if any (highest-priority on overlap). */
  finding?: Finding;
}

function classPriority(c: FindingClass): number {
  return FINDING_CLASS_META[c].priority;
}

/**
 * Split `text` into contiguous, non-overlapping segments for the overlay backdrop.
 * Every character belongs to at most one finding — the highest-priority class
 * wins a contested character (correctness > voice > reach > clarity). Findings
 * without a span are ignored here (they live only in the panel).
 */
export function buildSegments(text: string, findings: Finding[]): RenderSegment[] {
  const n = text.length;
  if (n === 0) return [];

  // Per-character owner finding (or undefined). Apply lowest priority first so
  // higher priority overwrites on overlap.
  const owner: (Finding | undefined)[] = new Array(n).fill(undefined);
  const spanned = findings
    .filter((f) => f.span && f.span.end > f.span.start)
    .sort((a, b) => classPriority(a.class) - classPriority(b.class));

  for (const f of spanned) {
    const { start, end } = f.span!;
    for (let i = Math.max(0, start); i < Math.min(n, end); i++) {
      // Only overwrite if this finding is >= current owner priority.
      const cur = owner[i];
      if (!cur || classPriority(f.class) >= classPriority(cur.class)) {
        owner[i] = f;
      }
    }
  }

  // Coalesce runs of identical owner into segments.
  const segments: RenderSegment[] = [];
  let i = 0;
  while (i < n) {
    const cur = owner[i];
    let j = i + 1;
    while (j < n && owner[j] === cur) j++;
    segments.push({ start: i, end: j, text: text.slice(i, j), finding: cur });
    i = j;
  }
  return segments;
}

/**
 * Apply a finding's Accept: replace its span with `replacement`, or — if the
 * finding has no span — replace the whole text (a whole-post rewrite). Returns
 * the new text plus the delta so callers can fix up the caret.
 */
export function applyReplacement(
  text: string,
  finding: Finding
): { text: string; delta: number } {
  const replacement = finding.replacement ?? "";
  if (!finding.span) {
    return { text: replacement, delta: replacement.length - text.length };
  }
  const { start, end } = finding.span;
  const next = text.slice(0, start) + replacement + text.slice(end);
  return { text: next, delta: replacement.length - (end - start) };
}
