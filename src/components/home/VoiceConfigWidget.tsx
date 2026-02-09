"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/Card";
import { UserVoiceSettings } from "@/types/voice";
import { Check, AlertCircle, Settings } from "lucide-react";

interface VoiceConfigWidgetProps {
  settings: UserVoiceSettings | null;
  loading?: boolean;
}

export function VoiceConfigWidget({ settings, loading }: VoiceConfigWidgetProps) {
  if (loading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 skeleton rounded-lg" />
            <div className="flex-1">
              <div className="h-4 skeleton w-24 mb-1" />
              <div className="h-3 skeleton w-32" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isConfigured = settings !== null;

  const getModelLabel = (model: string) => {
    switch (model) {
      case "openai":
        return "GPT-4";
      case "claude":
        return "Claude";
      case "grok":
        return "Grok";
      default:
        return model;
    }
  };

  const getDirectnessLabel = (mode: string) => {
    switch (mode) {
      case "soft":
        return "Soft";
      case "neutral":
        return "Neutral";
      case "blunt":
        return "Blunt";
      default:
        return mode;
    }
  };

  const getLengthLabel = (mode: string) => {
    switch (mode) {
      case "short":
        return "Short";
      case "medium":
        return "Medium";
      default:
        return mode;
    }
  };

  const getHumorLabel = (mode: string) => {
    switch (mode) {
      case "off":
        return "No humor";
      case "light":
        return "Light humor";
      default:
        return mode;
    }
  };

  return (
    <Link href="/voice">
      <Card className="hover:border-[var(--color-border-strong)] transition-all cursor-pointer">
        <CardContent className="py-4">
          <div className="flex items-center gap-3">
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isConfigured
                  ? "bg-emerald-400/10"
                  : "bg-amber-400/10"
              }`}
            >
              {isConfigured ? (
                <Check className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-amber-400" />
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[var(--color-text-primary)]">
                  Voice
                </span>
                {isConfigured ? (
                  <span className="text-xs text-emerald-400">Configured</span>
                ) : (
                  <span className="text-xs text-amber-400">Not configured</span>
                )}
              </div>

              {isConfigured && settings && (
                <p className="text-xs text-[var(--color-text-muted)] truncate mt-0.5">
                  {getModelLabel(settings.ai_model)} · {getDirectnessLabel(settings.directness_mode)} · {getLengthLabel(settings.length_mode)} · {getHumorLabel(settings.humor_mode)}
                </p>
              )}

              {!isConfigured && (
                <p className="text-xs text-[var(--color-text-muted)]">
                  Set up your voice settings for better drafts
                </p>
              )}
            </div>

            <Settings className="w-4 h-4 text-[var(--color-text-muted)]" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
