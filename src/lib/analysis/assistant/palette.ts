/**
 * Portable color palette for the assistant — shared by the dashboard UI and the
 * Chrome-extension content script. Hex (not CSS vars) on purpose: the extension
 * injects into X's pages where our design tokens don't exist, so one hex palette
 * is the only definition that works on every surface.
 *
 * Color = finding class. Underline *style* = severity. (UX §3)
 */

import type { FindingClass, Severity } from "./types";

// GALLEY palette (hex, not CSS vars — shared with the extension content script).
export const CLASS_STYLE: Record<FindingClass, { color: string; label: string }> = {
  correctness: { color: "#E04B24", label: "Correctness" }, // rubric
  clarity: { color: "#A6A193", label: "Clarity" }, // paper
  voice: { color: "#93AC7C", label: "Voice" }, // sap
  reach: { color: "#D9A441", label: "Reach" }, // ochre
};

/** text-decoration-style per severity. Clean underlines only (no squiggly/wavy):
 *  a quiet dotted line for soft suggestions, a solid line for things to fix. */
export const SEVERITY_DECORATION: Record<Severity, "dotted" | "solid"> = {
  suggestion: "dotted",
  warning: "solid",
  problem: "solid",
};

/** Score-band colors (orb, panel, badges) — GALLEY: sap / ochre / rubric. */
export const BAND_COLOR = {
  good: "#93AC7C",
  warning: "#D9A441",
  danger: "#E04B24",
} as const;

export const BADGE_COLOR = {
  good: "#93AC7C",
  caution: "#D9A441",
  info: "#A6A193",
} as const;
