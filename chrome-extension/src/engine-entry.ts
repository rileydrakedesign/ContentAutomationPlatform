/**
 * Extension engine entry — bundled by chrome-extension/build.js (esbuild) into
 * dist/assistant-engine.js. This makes the extension consume the SAME TypeScript
 * Tier-0 engine as the dashboard (src/lib/analysis/assistant), so there is one
 * source of truth and the two surfaces can never drift. (Replaces the old
 * hand-ported assistant-engine.js + its parity test.)
 *
 * The content-script UI (assistant-ui.js) reads window.AFXAssistant.
 */
import {
  runTier0 as tsRunTier0,
  CLASS_STYLE,
  SEVERITY_DECORATION,
  BAND_COLOR,
  scoreBand,
  type Tier0Input,
} from "@/lib/analysis/assistant";
import { weightedEngagement, opportunityTraction } from "@/lib/utils/engagement";

// The content-script UI calls runTier0(text, opts) and reads a flat
// { reach, charCount, overLimit } shape — adapt the TS engine's object signature
// to that so assistant-ui.js needs no changes.
function runTier0(text: string, opts: Omit<Tier0Input, "text"> = {}) {
  const r = tsRunTier0({ text, ...opts });
  return {
    findings: r.findings,
    badges: r.badges,
    chips: r.chips,
    reach: r.scores.reach,
    charCount: r.charInfo.weighted,
    overLimit: r.charInfo.isOverLimit,
  };
}

// Opportunity scoring (content.js pill) uses the same canonical functions the
// server ranks reply targets with (engagement.ts / search-mapping.ts
// tractionScore) — one formula, pill ordering === server ordering by
// construction. Guarded by the parity test in engagement.test.ts.
const AFXAssistant = {
  runTier0,
  CLASS_STYLE,
  SEVERITY_DECORATION,
  BAND_COLOR,
  scoreBand,
  weightedEngagement,
  opportunityTraction,
};

declare global {
  interface Window {
    AFXAssistant: typeof AFXAssistant;
  }
}

window.AFXAssistant = AFXAssistant;
