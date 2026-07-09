/**
 * Writing-assistant engine — public surface.
 *
 * One engine, three skins (dashboard modal, X post box, X reply box). Everything
 * here is pure + client-safe so the identical code runs in a React client
 * component and ported into the Chrome-extension content script.
 *
 * See GRAMMARLY_PIVOT_PLAN.md / GRAMMARLY_PIVOT_UX.md.
 */

export * from "./types";
export { runTier0, type Tier0Input } from "./tier0";
export {
  resolveQuote,
  resolveFindings,
  buildSegments,
  applyReplacement,
  type RenderSegment,
} from "./spans";
export {
  composeScores,
  resemblanceToGrade,
  scoreBand,
  gradeBand,
  type ComposeScoresInput,
} from "./score";
export {
  mergeReport,
  type AssistantScores,
  type AssistantFindings,
} from "./merge";
export {
  anchorLedger,
  contradictsSettled,
  type AcceptedEdit,
  type AnchoredEdit,
  type DeclinedSuggestion,
} from "./ledger";
export {
  CLASS_STYLE,
  SEVERITY_DECORATION,
  BAND_COLOR,
  BADGE_COLOR,
} from "./palette";
