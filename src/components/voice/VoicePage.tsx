"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { PatternControlsTab } from "./PatternControlsTab";
import { NicheAccountsTab } from "./NicheAccountsTab";
import { VoiceSection } from "./VoiceSection";
import { Mic2, Layers, Users } from "lucide-react";

export function VoicePage() {
  const [activeTab, setActiveTab] = useState<string>("voice");

  return (
    <div className="animate-fade-in">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)]">
                Voice & Patterns
              </h1>
              <p className="text-[var(--color-text-secondary)] text-sm mt-1">
                Configure how AI generates content in your unique voice
              </p>
            </div>
            <TabsList>
              <TabsTrigger value="voice" icon={<Mic2 className="w-4 h-4" />}>
                Voice
              </TabsTrigger>
              <TabsTrigger value="patterns" icon={<Layers className="w-4 h-4" />}>
                Patterns
              </TabsTrigger>
              <TabsTrigger value="niche" icon={<Users className="w-4 h-4" />}>
                Niche Accounts
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="voice">
          <VoiceSection />
        </TabsContent>

        <TabsContent value="patterns">
          <PatternControlsTab />
        </TabsContent>

        <TabsContent value="niche">
          <NicheAccountsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
