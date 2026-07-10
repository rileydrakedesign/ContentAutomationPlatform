/**
 * Derived voice traits (PRD_CORE §4.3): the voice is DERIVED, not configured.
 *
 * Reads the user's real writing corpus — their engagement-selected voice
 * examples (top posts/replies) — and renders what it finds as 5–8 plain-English
 * trait cards ("You keep it short and punchy", "You never use hashtags"), each
 * with evidence and a keep / not-me toggle. Toggles map onto the EXISTING
 * `UserVoiceSettings` dials and modes — no schema change, and the assembled
 * prompt (prompt-assembler.ts) picks the result up unchanged. The 0–100
 * sliders stay available backstage (Advanced) for users who want them; these
 * cards are the front door.
 *
 * Everything here is deterministic and unit-tested: a trait must point at
 * measurable evidence in the corpus ("0 of 24 posts use emojis"), never a
 * black-box vibe.
 */
import type { UserVoiceSettings, VoiceGuardrails } from "@/types/voice";

export interface TraitEvidence {
  /** Plain-words measurement backing the trait, e.g. "avg 14 words per post". */
  summary: string;
}

export interface TraitCard {
  id: string;
  /** Plain-English trait, second person: "You keep it short and punchy". */
  label: string;
  evidence: TraitEvidence;
  /**
   * Whether current settings already express this trait (the card renders as
   * "kept"). Toggling keep applies `keepPatch`; "not me" applies `notMePatch`.
   */
  kept: boolean;
  keepPatch: Partial<UserVoiceSettings>;
  notMePatch: Partial<UserVoiceSettings>;
}

interface CorpusStats {
  count: number;
  avgWords: number;
  emojiPostRate: number; // share of posts containing any emoji
  questionRate: number; // share of posts containing "?"
  exclaimRate: number; // share of posts containing "!"
  contractionRate: number; // share of posts using contractions
  opinionRate: number; // share of posts with first-person opinion markers
  hashtagPostRate: number; // share of posts containing #tag
}

const EMOJI_RE = /\p{Extended_Pictographic}/u;
const CONTRACTION_RE = /\b\w+'(s|t|re|ve|ll|d|m)\b/i;
const OPINION_RE =
  /\b(i think|i believe|imo|imho|honestly|hot take|unpopular opinion|i'd argue|my take|overrated|underrated|wrong|should|stop doing)\b/i;
const HASHTAG_RE = /(^|\s)#\w+/;

export const MIN_TRAIT_EXAMPLES = 3;

function computeStats(texts: string[]): CorpusStats {
  const count = texts.length;
  const share = (pred: (t: string) => boolean) =>
    count === 0 ? 0 : texts.filter(pred).length / count;
  const totalWords = texts.reduce(
    (sum, t) => sum + t.split(/\s+/).filter(Boolean).length,
    0
  );
  return {
    count,
    avgWords: count === 0 ? 0 : totalWords / count,
    emojiPostRate: share((t) => EMOJI_RE.test(t)),
    questionRate: share((t) => t.includes("?")),
    exclaimRate: share((t) => t.includes("!")),
    contractionRate: share((t) => CONTRACTION_RE.test(t)),
    opinionRate: share((t) => OPINION_RE.test(t)),
    hashtagPostRate: share((t) => HASHTAG_RE.test(t)),
  };
}

/** A dial matches a target when within tolerance — sliders are coarse signals. */
function dialMatches(current: number, target: number, tolerance = 15): boolean {
  return Math.abs(current - target) <= tolerance;
}

function patchApplied(settings: UserVoiceSettings, patch: Partial<UserVoiceSettings>): boolean {
  return Object.entries(patch).every(([key, value]) => {
    const current = settings[key as keyof UserVoiceSettings];
    if (typeof value === "number" && typeof current === "number") {
      return dialMatches(current, value);
    }
    if (key === "guardrails") {
      const want = (value as VoiceGuardrails).custom_rules || [];
      const have = (current as VoiceGuardrails)?.custom_rules || [];
      return want.every((r) => have.includes(r));
    }
    return current === value;
  });
}

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/**
 * Derive trait cards from the corpus + current settings. Returns [] when the
 * corpus is too thin to say anything honest (< MIN_TRAIT_EXAMPLES) — the UI
 * shows the connect/derive empty state instead.
 */
export function deriveTraitCards(
  settings: UserVoiceSettings,
  exampleTexts: string[]
): TraitCard[] {
  const texts = exampleTexts.map((t) => (t || "").trim()).filter(Boolean);
  if (texts.length < MIN_TRAIT_EXAMPLES) return [];
  const stats = computeStats(texts);
  const n = stats.count;
  const cards: TraitCard[] = [];

  const push = (
    id: string,
    label: string,
    evidence: string,
    keepPatch: Partial<UserVoiceSettings>,
    notMePatch: Partial<UserVoiceSettings>
  ) => {
    cards.push({
      id,
      label,
      evidence: { summary: evidence },
      kept: patchApplied(settings, keepPatch),
      keepPatch,
      notMePatch,
    });
  };

  // Length
  if (stats.avgWords < 22) {
    push(
      "length-short",
      "You keep it short and punchy",
      `avg ${Math.round(stats.avgWords)} words across your ${n} top posts`,
      { length_mode: "short" },
      { length_mode: "medium" }
    );
  } else {
    push(
      "length-room",
      "You give your takes room to breathe",
      `avg ${Math.round(stats.avgWords)} words across your ${n} top posts`,
      { length_mode: "medium" },
      { length_mode: "short" }
    );
  }

  // Emoji
  if (stats.emojiPostRate < 0.15) {
    push(
      "emoji-off",
      "You almost never use emojis",
      `${Math.round(stats.emojiPostRate * n)} of ${n} top posts contain an emoji`,
      { emoji_mode: "off" },
      { emoji_mode: "on" }
    );
  } else {
    push(
      "emoji-on",
      "Emojis are part of your voice",
      `${pct(stats.emojiPostRate)} of your top posts use them`,
      { emoji_mode: "on" },
      { emoji_mode: "off" }
    );
  }

  // Questions
  if (stats.questionRate >= 0.3) {
    push(
      "questions",
      "You pull people in with questions",
      `${pct(stats.questionRate)} of your top posts ask one`,
      { question_rate: "medium" },
      { question_rate: "low" }
    );
  } else {
    push(
      "statements",
      "You make statements, not questions",
      `only ${pct(stats.questionRate)} of your top posts ask one`,
      { question_rate: "low" },
      { question_rate: "medium" }
    );
  }

  // Register (contractions as a casualness signal)
  if (stats.contractionRate >= 0.5) {
    push(
      "casual",
      "You write casual and conversational",
      `${pct(stats.contractionRate)} of your top posts use contractions`,
      { tone_formal_casual: 75 },
      { tone_formal_casual: 40 }
    );
  } else {
    push(
      "polished",
      "You keep it polished",
      `only ${pct(stats.contractionRate)} of your top posts use contractions`,
      { tone_formal_casual: 35 },
      { tone_formal_casual: 60 }
    );
  }

  // Stance
  if (stats.opinionRate >= 0.25) {
    push(
      "takes-sides",
      "You take sides",
      `${pct(stats.opinionRate)} of your top posts stake out an opinion`,
      { stance_neutral_opinionated: 72, disagreement_mode: "allow_nuance" },
      { stance_neutral_opinionated: 45, disagreement_mode: "avoid" }
    );
  }

  // Energy
  if (stats.exclaimRate >= 0.25 || (stats.avgWords < 15 && stats.exclaimRate >= 0.1)) {
    push(
      "punchy",
      "High energy, exclamation and all",
      `${pct(stats.exclaimRate)} of your top posts carry an exclamation`,
      { energy_calm_punchy: 72 },
      { energy_calm_punchy: 45 }
    );
  } else if (stats.exclaimRate < 0.1) {
    push(
      "measured",
      "Calm, measured delivery",
      `${pct(stats.exclaimRate)} of your top posts use exclamations`,
      { energy_calm_punchy: 40 },
      { energy_calm_punchy: 60 }
    );
  }

  // Hashtags → guardrail custom rule (the assembler already honors custom_rules)
  if (stats.hashtagPostRate === 0) {
    const rule = "Never use hashtags";
    const withRule = (g: VoiceGuardrails): VoiceGuardrails => ({
      ...g,
      custom_rules: g.custom_rules.includes(rule)
        ? g.custom_rules
        : [...g.custom_rules, rule],
    });
    const withoutRule = (g: VoiceGuardrails): VoiceGuardrails => ({
      ...g,
      custom_rules: g.custom_rules.filter((r) => r !== rule),
    });
    push(
      "no-hashtags",
      "You never use hashtags",
      `0 of ${n} top posts contain one`,
      { guardrails: withRule(settings.guardrails) },
      { guardrails: withoutRule(settings.guardrails) }
    );
  }

  return cards.slice(0, 8);
}
