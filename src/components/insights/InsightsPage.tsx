"use client";

import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { PerformanceTab } from "./PerformanceTab";
import { PatternsTab } from "./PatternsTab";
import { SuggestionsTab } from "./SuggestionsTab";
import { BestTimesSection } from "./BestTimesSection";
import { AssistantTab } from "./AssistantTab";

export function InsightsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Insights</h1>
        <p className="text-slate-500 mt-1">
          Analytics, patterns, and actionable suggestions
        </p>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patterns">Patterns</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="assistant">Assistant</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
            <BestTimesSection />
            <PerformanceTab />
          </div>
        </TabsContent>

        <TabsContent value="patterns">
          <PatternsTab />
        </TabsContent>

        <TabsContent value="actions">
          <SuggestionsTab />
        </TabsContent>

        <TabsContent value="assistant">
          <AssistantTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
