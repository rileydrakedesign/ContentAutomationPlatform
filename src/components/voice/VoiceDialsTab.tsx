"use client";

import { SliderDial } from "@/components/ui/SliderDial";
import { UserVoiceSettings } from "@/types/voice";

interface VoiceDialsTabProps {
  settings: UserVoiceSettings;
  onSettingsUpdate: (updates: Partial<UserVoiceSettings>) => Promise<void>;
}

export function VoiceDialsTab({ settings, onSettingsUpdate }: VoiceDialsTabProps) {
  return (
    <div className="space-y-8">
      <div className="bg-slate-900 border border-slate-800 rounded-lg p-6">
        <h3 className="text-lg font-medium text-white mb-2">Voice Dials</h3>
        <p className="text-sm text-slate-400 mb-6">
          Fine-tune how your generated content sounds. These sliders affect the
          tone and style of posts created from topics.
        </p>

        <div className="space-y-8">
          <SliderDial
            label="Optimization vs. Authenticity"
            leftLabel="Authentic"
            rightLabel="Optimized"
            value={settings.optimization_authenticity}
            onChange={(value) =>
              onSettingsUpdate({ optimization_authenticity: value })
            }
            description="Authentic: Write naturally, avoid engagement tricks. Optimized: Use proven hooks and CTAs."
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

      <div className="bg-slate-900/50 border border-slate-800/50 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-violet-500/10 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-4 h-4 text-violet-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <p className="text-sm text-slate-300">
              These dials work alongside your voice examples. The AI learns your
              style from examples and applies these adjustments on top.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
