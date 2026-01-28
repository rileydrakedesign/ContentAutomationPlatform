"use client";

import { UserVoiceSettings, LengthMode, DirectnessMode, HumorMode, EmojiMode, QuestionRate, DisagreementMode } from "@/types/voice";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";

interface ControlsTabProps {
  settings: UserVoiceSettings;
  onSettingsUpdate: (updates: Partial<UserVoiceSettings>) => Promise<void>;
}

interface ControlKnobProps {
  label: string;
  description: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}

function ControlKnob({ label, description, options, value, onChange }: ControlKnobProps) {
  return (
    <div className="py-4 border-b border-slate-800 last:border-0">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-white">{label}</h4>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        <div className="flex gap-1 bg-slate-800/50 p-1 rounded-lg">
          {options.map((option) => (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`px-3 py-1.5 rounded-md text-sm transition ${
                value === option.value
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-white hover:bg-slate-700/50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ControlsTab({ settings, onSettingsUpdate }: ControlsTabProps) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <CardHeader className="mb-4">
          <CardTitle>Voice Controls</CardTitle>
          <CardDescription>
            Adjust how your replies sound. These settings are applied to every generated reply.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ControlKnob
            label="Length"
            description="How long should replies typically be?"
            options={[
              { value: "short", label: "Short" },
              { value: "medium", label: "Medium" },
            ]}
            value={settings.length_mode}
            onChange={(v) => onSettingsUpdate({ length_mode: v as LengthMode })}
          />

          <ControlKnob
            label="Directness"
            description="How assertive should the tone be?"
            options={[
              { value: "soft", label: "Soft" },
              { value: "neutral", label: "Neutral" },
              { value: "blunt", label: "Blunt" },
            ]}
            value={settings.directness_mode}
            onChange={(v) => onSettingsUpdate({ directness_mode: v as DirectnessMode })}
          />

          <ControlKnob
            label="Humor"
            description="Should replies include wit or humor?"
            options={[
              { value: "off", label: "Off" },
              { value: "light", label: "Light" },
            ]}
            value={settings.humor_mode}
            onChange={(v) => onSettingsUpdate({ humor_mode: v as HumorMode })}
          />

          <ControlKnob
            label="Emoji"
            description="Should emojis be used?"
            options={[
              { value: "off", label: "Off" },
              { value: "on", label: "On" },
            ]}
            value={settings.emoji_mode}
            onChange={(v) => onSettingsUpdate({ emoji_mode: v as EmojiMode })}
          />

          <ControlKnob
            label="Question Rate"
            description="How often to ask questions in replies?"
            options={[
              { value: "low", label: "Low" },
              { value: "medium", label: "Medium" },
            ]}
            value={settings.question_rate}
            onChange={(v) => onSettingsUpdate({ question_rate: v as QuestionRate })}
          />

          <ControlKnob
            label="Disagreement"
            description="How to handle disagreeing with the original post?"
            options={[
              { value: "avoid", label: "Avoid" },
              { value: "allow_nuance", label: "Allow Nuance" },
            ]}
            value={settings.disagreement_mode}
            onChange={(v) => onSettingsUpdate({ disagreement_mode: v as DisagreementMode })}
          />
        </CardContent>
      </Card>

      <Card className="p-4">
        <CardHeader className="mb-4">
          <CardTitle>Token Budgets</CardTitle>
          <CardDescription>
            Control how many examples are included in prompts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white">Voice Examples Budget</label>
              <span className="text-sm text-slate-400">{settings.max_example_tokens} tokens</span>
            </div>
            <input
              type="range"
              min={500}
              max={3000}
              step={100}
              value={settings.max_example_tokens}
              onChange={(e) => onSettingsUpdate({ max_example_tokens: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-xs text-slate-500 mt-1">
              Higher values include more examples but increase API costs.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-white">Inspiration Budget</label>
              <span className="text-sm text-slate-400">{settings.max_inspiration_tokens} tokens</span>
            </div>
            <input
              type="range"
              min={0}
              max={1500}
              step={100}
              value={settings.max_inspiration_tokens}
              onChange={(e) => onSettingsUpdate({ max_inspiration_tokens: parseInt(e.target.value) })}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <p className="text-xs text-slate-500 mt-1">
              Set to 0 to exclude inspiration from prompts.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="p-4">
        <CardHeader className="mb-4">
          <CardTitle>Auto Refresh</CardTitle>
          <CardDescription>
            Automatically update your top examples on a schedule.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-sm font-medium text-white">Weekly Auto-Refresh</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                Automatically refresh top examples every week.
              </p>
            </div>
            <button
              onClick={() => onSettingsUpdate({ auto_refresh_enabled: !settings.auto_refresh_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.auto_refresh_enabled ? "bg-amber-500" : "bg-slate-700"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.auto_refresh_enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
