"use client";

import { useCallback, useState } from "react";
import { parseGateError } from "@/lib/utils/gate-error";

export interface VoiceCheckResult {
  score: number;
  matches: string[];
  deviations: string[];
  suggested_edit: string;
}

/**
 * Shared client logic for the ambient voice-check (POST /api/voice/check — the
 * same `runVoiceCheck` core that powers MCP `check_draft`). Both the optional
 * VoiceCheckPanel button and the draft editor's check-gated publish use this so
 * there is one client path, one result shape, one credit cost.
 */
export function useVoiceCheck(voiceType: "post" | "reply" = "post") {
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<VoiceCheckResult | null>(null);
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const check = useCallback(
    async (text: string): Promise<VoiceCheckResult | null> => {
      if (!text.trim()) return null;
      setChecking(true);
      setError(null);
      setResult(null);
      try {
        const res = await fetch("/api/voice/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voice_type: voiceType }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const gateErr = parseGateError(res.status, data);
          setError(gateErr ? gateErr.message : data.error || "Failed to check voice match");
          return null;
        }
        const r = data as VoiceCheckResult;
        setResult(r);
        setCheckedText(text);
        return r;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to check voice match");
        return null;
      } finally {
        setChecking(false);
      }
    },
    [voiceType]
  );

  // Caller applied the suggested edit — keep the result but mark it current.
  const markChecked = useCallback((text: string) => setCheckedText(text), []);

  return { checking, result, checkedText, error, check, markChecked };
}
