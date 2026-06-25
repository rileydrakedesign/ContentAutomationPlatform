/**
 * Portable color palette for the assistant — shared by the dashboard UI and the
 * Chrome-extension content script. Hex (not CSS vars) on purpose: the extension
 * injects into X's pages where our design tokens don't exist, so one hex palette
 * is the only definition that works on every surface.
 *
 * Color = finding class. Underline *style* = severity. (UX §3)
 */

import type { FindingClass, Severity } from "./types";

export const CLASS_STYLE: Record<FindingClass, { color: string; label: string }> = {
  correctness: { color: "#F87171", label: "Correctness" }, // red
  clarity: { color: "#818CF8", label: "Clarity" }, // indigo
  voice: { color: "#A78BFA", label: "Voice" }, // violet
  reach: { color: "#FBBF24", label: "Reach" }, // amber
};

/** text-decoration-style per severity. */
export const SEVERITY_DECORATION: Record<Severity, "dotted" | "wavy" | "double"> = {
  suggestion: "dotted",
  warning: "wavy",
  problem: "double",
};

/** Score-band colors (orb, panel, badges). */
export const BAND_COLOR = {
  good: "#4ADE80",
  warning: "#FBBF24",
  danger: "#F87171",
} as const;

export const BADGE_COLOR = {
  good: "#4ADE80",
  caution: "#FBBF24",
  info: "#818CF8",
} as const;
