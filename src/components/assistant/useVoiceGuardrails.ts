"use client";

import { useEffect, useState } from "react";

/**
 * Fetch the user's voice guardrails for the live assistant: the avoid-words list
 * (underlined as Voice findings) and an authenticity-first score (quiets the soft
 * reach nags for users who've told us they optimize for authenticity over reach).
 * One light fetch per editor mount; returns empty/0 until it lands, so the
 * assistant just runs without them in the meantime.
 *
 * Inversion note: settings store `optimization_authenticity` (0 = authentic …
 * 100 = optimized), but Tier-0 wants "how authenticity-first" (high = quiet the
 * reach nags). So we pass `100 - optimization_authenticity`.
 */
export function useVoiceGuardrails(voiceType: "post" | "reply" = "post") {
  const [avoidWords, setAvoidWords] = useState<string[]>([]);
  const [authenticity, setAuthenticity] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/voice/settings?voice_type=${voiceType}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (cancelled || !s) return;
        const words = Array.isArray(s?.guardrails?.avoid_words) ? s.guardrails.avoid_words : [];
        setAvoidWords(words.filter((w: unknown): w is string => typeof w === "string" && w.trim().length > 0));
        const opt = Number(s?.optimization_authenticity);
        if (Number.isFinite(opt)) setAuthenticity(Math.max(0, Math.min(100, 100 - opt)));
      })
      .catch(() => {
        // Non-fatal — the assistant runs fine without guardrails.
      });
    return () => {
      cancelled = true;
    };
  }, [voiceType]);

  return { avoidWords, authenticity };
}
