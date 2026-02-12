"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { PerformanceTab } from "./PerformanceTab";
import { PatternsTab } from "./PatternsTab";
import { SuggestionsTab } from "./SuggestionsTab";
import { AssistantTab } from "./AssistantTab";
import { GrowthTrendChart } from "./overview/GrowthTrendChart";
import { BestDayIndicator } from "./overview/BestDayIndicator";
import { EngagementFunnel } from "./overview/EngagementFunnel";
import { PostLengthSweetSpot } from "./overview/PostLengthSweetSpot";
import { CsvUploadDrawer } from "@/components/home/CsvUploadDrawer";
import type { UserAnalyticsData } from "@/types/analytics";

export function InsightsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";

  const [analyticsData, setAnalyticsData] = useState<UserAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);

  useEffect(() => {
    fetch("/api/analytics/csv")
      .then((res) => res.json())
      .then((data) => setAnalyticsData(data.data || null))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUploadComplete = () => {
    fetch("/api/analytics/csv")
      .then((res) => res.json())
      .then((data) => setAnalyticsData(data.data || null))
      .catch(console.error);
  };

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
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
              <div className="lg:col-span-3">
                <GrowthTrendChart posts={analyticsData?.posts || []} />
              </div>
              <div className="lg:col-span-1">
                <BestDayIndicator posts={analyticsData?.posts || []} />
              </div>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <EngagementFunnel posts={analyticsData?.posts || []} />
              <PostLengthSweetSpot posts={analyticsData?.posts || []} />
            </div>
            <PerformanceTab
              posts={analyticsData?.posts || []}
              uploadedAt={analyticsData?.uploaded_at}
              onUploadClick={() => setShowUploadDrawer(true)}
              loading={loading}
            />
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

      <CsvUploadDrawer
        isOpen={showUploadDrawer}
        onClose={() => setShowUploadDrawer(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
