"use client";

import { UserVoiceSettings, VoiceType } from "@/types/voice";
import { VoiceDialsSection } from "./VoiceDialsSection";
import { GuardrailsSection } from "./GuardrailsSection";
import { ExamplesSection } from "./ExamplesSection";
import { SpecialNotesSection } from "./SpecialNotesSection";

interface VoiceSettingsDashboardProps {
  settings: UserVoiceSettings;
  voiceType: VoiceType;
  onSettingsUpdate: (updates: Partial<UserVoiceSettings>) => Promise<void>;
}

export function VoiceSettingsDashboard({
  settings,
  voiceType,
  onSettingsUpdate,
}: VoiceSettingsDashboardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left column */}
      <div className="space-y-6">
        <VoiceDialsSection
          settings={settings}
          onSettingsUpdate={onSettingsUpdate}
        />
        <GuardrailsSection
          settings={settings}
          onSettingsUpdate={onSettingsUpdate}
        />
      </div>

      {/* Right column */}
      <div className="space-y-6">
        <ExamplesSection voiceType={voiceType} />
        <SpecialNotesSection
          settings={settings}
          onSettingsUpdate={onSettingsUpdate}
        />
      </div>
    </div>
  );
}
