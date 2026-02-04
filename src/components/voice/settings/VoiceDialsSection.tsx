"use client";

import { SliderDial } from "@/components/ui/SliderDial";
import { UserVoiceSettings } from "@/types/voice";

interface VoiceDialsSectionProps {
  settings: UserVoiceSettings;
  onSettingsUpdate: (updates: Partial<UserVoiceSettings>) => Promise<void>;
}

export function VoiceDialsSection({ settings, onSettingsUpdate }: VoiceDialsSectionProps) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-4">
      <h3 className="text-sm font-semibold text-white mb-1">Voice Dials</h3>
      <p className="text-xs text-slate-500 mb-4">
        Fine-tune how your generated content sounds.
      </p>

      <div className="space-y-4">
        <SliderDial
          label="Optimization vs. Authenticity"
          leftLabel="Authentic"
          rightLabel="Optimized"
          value={settings.optimization_authenticity}
          onChange={(value) =>
            onSettingsUpdate({ optimization_authenticity: value })
          }
          description="Authentic: Write naturally. Optimized: Use proven hooks and CTAs."
        />

        <SliderDial
          label="Tone"
          leftLabel="Formal"
          rightLabel="Casual"
          value={settings.tone_formal_casual}
          onChange={(value) =>
            onSettingsUpdate({ tone_formal_casual: value })
          }
          description="Formal: Professional language. Casual: Conversational and friendly."
        />

        <SliderDial
          label="Energy"
          leftLabel="Calm"
          rightLabel="Punchy"
          value={settings.energy_calm_punchy}
          onChange={(value) =>
            onSettingsUpdate({ energy_calm_punchy: value })
          }
          description="Calm: Thoughtful pacing. Punchy: Short sentences, high energy."
        />

        <SliderDial
          label="Stance"
          leftLabel="Neutral"
          rightLabel="Opinionated"
          value={settings.stance_neutral_opinionated}
          onChange={(value) =>
            onSettingsUpdate({ stance_neutral_opinionated: value })
          }
          description="Neutral: Balanced perspectives. Opinionated: Bold, strong stances."
        />
      </div>
    </div>
  );
}
