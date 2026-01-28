"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { PatternControlsTab } from "./PatternControlsTab";
import { NicheAccountsTab } from "./NicheAccountsTab";
import { VoiceSection } from "./VoiceSection";
import { VoiceTypeSelector } from "./shared/VoiceTypeSelector";
import { VoiceType } from "@/types/voice";

export function VoicePage() {
  const [activeTab, setActiveTab] = useState<string>("voice");
  const [voiceType, setVoiceType] = useState<VoiceType>("reply");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Voice & Patterns</h1>
        <p className="text-slate-500 mt-1">
          Control how generated content sounds and which patterns to apply.
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        {/* Main navigation */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Voice type selector - only visible on voice tab */}
            {activeTab === "voice" && (
              <VoiceTypeSelector value={voiceType} onChange={setVoiceType} />
            )}

            {/* Tab navigation */}
            <TabsList>
              <TabsTrigger value="voice">
                {voiceType === "post" ? "Post Voice" : "Reply Voice"}
              </TabsTrigger>
              <TabsTrigger value="patterns">Patterns</TabsTrigger>
              <TabsTrigger value="niche">Niche Accounts</TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Voice tab content */}
        <TabsContent value="voice">
          <VoiceSection voiceType={voiceType} />
        </TabsContent>

        {/* Patterns tab content */}
        <TabsContent value="patterns">
          <PatternControlsTab />
        </TabsContent>

        {/* Niche accounts tab content */}
        <TabsContent value="niche">
          <NicheAccountsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
