"use client";

import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Fingerprint, Check, X } from "lucide-react";
import { UserVoiceSettings, VoiceType } from "@/types/voice";
import { deriveTraitCards, MIN_TRAIT_EXAMPLES, type TraitCard } from "@/lib/voice/trait-cards";

/**
 * "Here's the voice we learned" (PRD_CORE §4.3): the derived-traits front door
 * for voice construction. Each card is a plain-English trait read off the
 * user's top posts, with its evidence, and keep / not-me toggles that set the
 * existing UserVoiceSettings under the hood. Sliders live on in Advanced —
 * this panel is what the user actually touches.
 */
export function TraitCardsPanel({
  settings,
  exampleTexts,
  voiceType,
  onApplyPatch,
}: {
  settings: UserVoiceSettings;
  exampleTexts: string[];
  voiceType: VoiceType;
  onApplyPatch: (patch: Partial<UserVoiceSettings>) => void;
}) {
  const cards = useMemo(
    () => deriveTraitCards(settings, exampleTexts),
    [settings, exampleTexts]
  );

  return (
    <Card>
      <CardContent>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
            <Fingerprint className="w-4 h-4 text-[var(--color-primary-400)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
              The voice we learned
            </h3>
            <p className="text-xs text-[var(--color-text-muted)]">
              Derived from your top {voiceType === "reply" ? "replies" : "posts"} — keep what&apos;s
              you, drop what isn&apos;t
            </p>
          </div>
        </div>

        {cards.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">
            Not enough writing to learn from yet. Sync your X account or add at least{" "}
            {MIN_TRAIT_EXAMPLES} voice examples below, and your derived traits appear here.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cards.map((card) => (
              <TraitCardRow key={card.id} card={card} onApplyPatch={onApplyPatch} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TraitCardRow({
  card,
  onApplyPatch,
}: {
  card: TraitCard;
  onApplyPatch: (patch: Partial<UserVoiceSettings>) => void;
}) {
  return (
    <div
      className={`rounded-xl border px-3.5 py-3 transition-colors ${
        card.kept
          ? "border-[var(--color-primary-500)]/40 bg-[var(--color-primary-500)]/5"
          : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)]"
      }`}
    >
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{card.label}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{card.evidence.summary}</p>
      <div className="flex items-center gap-2 mt-2.5">
        <button
          onClick={() => onApplyPatch(card.keepPatch)}
          disabled={card.kept}
          className={`inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border transition-colors ${
            card.kept
              ? "border-[var(--color-primary-500)]/50 text-[var(--color-primary-400)] cursor-default"
              : "border-[var(--color-border-default)] text-[var(--color-text-secondary)] hover:border-[var(--color-primary-500)]/50 hover:text-[var(--color-primary-400)]"
          }`}
        >
          <Check className="w-3 h-3" />
          {card.kept ? "Kept" : "Keep"}
        </button>
        <button
          onClick={() => onApplyPatch(card.notMePatch)}
          className="inline-flex items-center gap-1 text-xs rounded-full px-2.5 py-1 border border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:border-[var(--color-danger-500)]/40 hover:text-[var(--color-danger-400)] transition-colors"
        >
          <X className="w-3 h-3" />
          Not me
        </button>
      </div>
    </div>
  );
}
