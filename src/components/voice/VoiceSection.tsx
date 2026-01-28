"use client";

import { useState, useEffect } from "react";
import { UserVoiceSettings, VoiceType, DEFAULT_VOICE_SETTINGS } from "@/types/voice";
import { ViewToggle, ViewMode } from "./shared/ViewToggle";
import { VoiceSettingsDashboard } from "./settings/VoiceSettingsDashboard";
import { VoiceEditorView } from "./editor/VoiceEditorView";

interface VoiceSectionProps {
  voiceType: VoiceType;
}

export function VoiceSection({ voiceType }: VoiceSectionProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("settings");
  const [settings, setSettings] = useState<UserVoiceSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/voice/settings?type=${voiceType}`);
      if (!res.ok) {
        throw new Error("Failed to fetch voice settings");
      }

      const data = await res.json();
      setSettings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, [voiceType]);

  const handleSettingsUpdate = async (updates: Partial<UserVoiceSettings>) => {
    try {
      const res = await fetch("/api/voice/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_type: voiceType, ...updates }),
      });

      if (!res.ok) throw new Error("Failed to update settings");

      const updated = await res.json();
      setSettings(updated);
    } catch (err) {
      console.error("Failed to update settings:", err);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-10 bg-slate-800 rounded w-48"></div>
        <div className="h-64 bg-slate-800 rounded"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchSettings}
          className="mt-2 text-sm text-red-400 hover:text-red-300 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const effectiveSettings = settings || {
    ...DEFAULT_VOICE_SETTINGS,
    id: "",
    user_id: "",
    voice_type: voiceType,
    created_at: "",
    updated_at: "",
  } as UserVoiceSettings;

  return (
    <div className="space-y-6">
      {/* View toggle */}
      <div className="flex items-center justify-between">
        <ViewToggle value={viewMode} onChange={setViewMode} />
      </div>

      {/* Content */}
      {viewMode === "settings" ? (
        <VoiceSettingsDashboard
          settings={effectiveSettings}
          voiceType={voiceType}
          onSettingsUpdate={handleSettingsUpdate}
        />
      ) : (
        <VoiceEditorView
          settings={effectiveSettings}
          voiceType={voiceType}
          onSettingsUpdate={handleSettingsUpdate}
        />
      )}
    </div>
  );
}
