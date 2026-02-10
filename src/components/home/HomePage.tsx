"use client";

import { useState, useEffect } from "react";
import { QuickActionsBar } from "./QuickActionsBar";
// (removed) AnalyticsTabs — looked visually out of place on dashboard
import { ConsistencyTracker } from "./ConsistencyTracker";
import { ContentSidebar } from "./ContentSidebar";
import { InsightsHub } from "./InsightsHub";
import { CsvUploadDrawer } from "./CsvUploadDrawer";
import { SetupChecklist } from "./SetupChecklist";
// (removed) CapturedPost import — dashboard inspiration now uses inspiration_posts
import { UserAnalyticsData } from "@/types/analytics";
import { InspirationPost } from "@/types/inspiration";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD";
  status: "PENDING" | "GENERATED" | "APPROVED" | "REJECTED";
  content: Record<string, unknown>;
  edited_content: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string;
};

export function HomePage() {
  const [analyticsData, setAnalyticsData] = useState<UserAnalyticsData | null>(null);
  const [inspirationPosts, setInspirationPosts] = useState<InspirationPost[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [activityDays, setActivityDays] = useState<Array<{ date: string; posts: number; replies: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [xStatus, setXStatus] = useState<{ connected: boolean; username?: string } | null>(null);
  const [byoStatus, setByoStatus] = useState<{ configured: boolean } | null>(null);

  const fetchData = async () => {
    try {
      const [analyticsRes, inspirationRes, draftsRes, xRes, byoRes, activityRes] = await Promise.all([
        fetch("/api/analytics/csv"),
        fetch("/api/inspiration"),
        fetch("/api/drafts"),
        fetch("/api/x/status"),
        fetch("/api/x/byo/credentials"),
        fetch("/api/activity/consistency"),
      ]);

      const [analyticsJson, inspirationJson, draftsJson, xJson, byoJson, activityJson] = await Promise.all([
        analyticsRes.json(),
        inspirationRes.json(),
        draftsRes.json(),
        xRes.json(),
        byoRes.json(),
        activityRes.json(),
      ]);

      setAnalyticsData(analyticsJson.data || null);
      setInspirationPosts(Array.isArray(inspirationJson) ? inspirationJson : []);
      setDrafts(Array.isArray(draftsJson) ? draftsJson : []);
      setXStatus(xJson || null);
      setByoStatus(byoJson || null);
      setActivityDays(Array.isArray(activityJson?.days) ? activityJson.days : []);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUploadComplete = () => {
    fetch("/api/analytics/csv")
      .then((res) => res.json())
      .then((data) => setAnalyticsData(data.data || null))
      .catch(console.error);
  };

  // Draft counts (used in sidebar)
  const generatedDrafts = drafts.filter((d) => d.status === "GENERATED");
  const approvedDrafts = drafts.filter((d) => d.status === "APPROVED");
  const postedCount = analyticsData?.total_posts || 0;

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        {/* Header skeleton */}
        <div className="flex items-center justify-between">
          <div>
            <div className="h-7 skeleton w-32 mb-2" />
            <div className="h-4 skeleton w-48" />
          </div>
          <div className="flex gap-3">
            <div className="h-9 skeleton w-28" />
            <div className="h-9 skeleton w-28" />
          </div>
        </div>

        {/* Main layout skeleton */}
        <div className="flex gap-5">
          <div className="flex-1 space-y-4">
            <div className="h-40 skeleton" />
            <div className="h-12 skeleton" />
            <div className="h-36 skeleton" />
          </div>
          <div className="w-[360px] shrink-0">
            <div className="h-96 skeleton" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header with Quick Actions */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Your content command center
          </p>
        </div>
        <QuickActionsBar onUploadClick={() => setShowUploadDrawer(true)} />
      </div>

      {/* Main Layout: Left stacked items | Right sidebar */}
      <div className="flex gap-5 items-stretch">
        {/* Left */}
        <div className="flex-1 flex flex-col gap-4">
          <SetupChecklist
            xStatus={xStatus}
            byoStatus={byoStatus}
            csvStatus={{ uploaded_at: analyticsData?.uploaded_at, total_posts: analyticsData?.total_posts }}
            onUploadCsv={() => setShowUploadDrawer(true)}
          />

          <InsightsHub
            posts={analyticsData?.posts || []}
            uploadedAt={analyticsData?.uploaded_at}
            onUploadClick={() => setShowUploadDrawer(true)}
            compact
          />
          {/* removed: content bar looked out of place */}
          <ConsistencyTracker
            className="flex-1"
            activityDays={activityDays}
            posts={analyticsData?.posts || []}
            dateRange={analyticsData?.date_range}
          />
        </div>

        {/* Right: Content Sidebar with dropdown toggle */}
        <div className="w-[360px] shrink-0">
          <ContentSidebar
            drafts={drafts}
            posts={analyticsData?.posts || []}
            inspirationPosts={inspirationPosts}
            onUploadClick={() => setShowUploadDrawer(true)}
          />
        </div>
      </div>

      {/* CSV Upload Drawer */}
      <CsvUploadDrawer
        isOpen={showUploadDrawer}
        onClose={() => setShowUploadDrawer(false)}
        onUploadComplete={handleUploadComplete}
      />
    </div>
  );
}
