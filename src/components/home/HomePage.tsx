"use client";

import { useState, useEffect } from "react";
import { QuickActionsBar } from "./QuickActionsBar";
import { ConsistencyTracker } from "./ConsistencyTracker";
import { ContentSidebar } from "./ContentSidebar";
import { InsightsHub } from "./InsightsHub";
import { BoostOpportunitiesCard } from "./BoostOpportunitiesCard";
import { VoiceHealthCard, RetuneBanner } from "./VoiceHealthCard";
import { NextBestAction } from "./NextBestAction";
import { FirstRunAnalysis } from "./FirstRunAnalysis";
import { OutcomeAttributionCard } from "./OutcomeAttributionCard";
import { CsvUploadDrawer } from "./CsvUploadDrawer";
import { SetupChecklist } from "./SetupChecklist";
import { FreePlanBanner } from "./FreePlanBanner";
// (removed) CapturedPost import — dashboard inspiration now uses inspiration_posts
import { UserAnalyticsData } from "@/types/analytics";
import { InspirationPost } from "@/types/inspiration";
import { apiFetch } from "@/lib/utils/apiFetch";

type Draft = {
  id: string;
  type: "X_POST" | "X_THREAD";
  status: "DRAFT" | "POSTED" | "SCHEDULED" | "REJECTED";
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

  const fetchData = async () => {
    try {
      // allSettled so one failing endpoint doesn't blank the whole dashboard
      // (apiFetch still redirects to /login on 401)
      const [analyticsRes, inspirationRes, draftsRes, xRes, activityRes] =
        await Promise.allSettled([
          apiFetch<{ data: UserAnalyticsData | null }>("/api/analytics/csv"),
          apiFetch<InspirationPost[]>("/api/inspiration"),
          apiFetch<Draft[]>("/api/drafts"),
          apiFetch<{ connected: boolean; username?: string }>("/api/x/status"),
          apiFetch<{ days?: Array<{ date: string; posts: number; replies: number }> }>(
            "/api/activity/consistency"
          ),
        ]);

      setAnalyticsData(
        analyticsRes.status === "fulfilled" ? analyticsRes.value.data || null : null
      );
      setInspirationPosts(
        inspirationRes.status === "fulfilled" && Array.isArray(inspirationRes.value)
          ? inspirationRes.value
          : []
      );
      setDrafts(
        draftsRes.status === "fulfilled" && Array.isArray(draftsRes.value)
          ? draftsRes.value
          : []
      );
      setXStatus(xRes.status === "fulfilled" ? xRes.value || null : null);
      setActivityDays(
        activityRes.status === "fulfilled" && Array.isArray(activityRes.value?.days)
          ? activityRes.value.days
          : []
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUploadComplete = () => {
    apiFetch<{ data: UserAnalyticsData | null }>("/api/analytics/csv")
      .then((json) => setAnalyticsData(json.data || null))
      .catch(console.error);
  };

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
        <div className="grid grid-cols-[1fr_360px] gap-5">
          <div className="space-y-4">
            <div className="h-40 skeleton" />
            <div className="h-12 skeleton" />
            <div className="h-36 skeleton" />
          </div>
          <div>
            <div className="h-96 skeleton" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      {/* Header with Quick Actions */}
      <div data-tour="dashboard-header" className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
            Dashboard
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mt-1">
            Tune your voice, then write posts that sound like you — checked for voice and reach as you type
          </p>
        </div>
        <QuickActionsBar onUploadClick={() => setShowUploadDrawer(true)} />
      </div>

      {/* Free Plan Banner */}
      <FreePlanBanner />

      {/* First-session analysis right after connecting X */}
      <FirstRunAnalysis onComplete={fetchData} onUploadClick={() => setShowUploadDrawer(true)} />

      {/* Re-tune recommendation banner */}
      <RetuneBanner />

      {/* Single highest-priority next step in the loop */}
      <div className="mb-5">
        <NextBestAction drafts={drafts} xConnected={Boolean(xStatus?.connected)} />
      </div>

      {/* Main Layout: Left stacked items | Right sidebar */}
      <div className="grid grid-cols-[1fr_360px] gap-5">
        {/* Left */}
        <div className="flex flex-col gap-4">
          <div data-tour="setup-checklist">
            <SetupChecklist
              xStatus={xStatus}
              csvStatus={{ uploaded_at: analyticsData?.uploaded_at, total_posts: analyticsData?.total_posts }}
              onUploadCsv={() => setShowUploadDrawer(true)}
            />
          </div>

          <VoiceHealthCard />

          <OutcomeAttributionCard />

          <BoostOpportunitiesCard days={7} limit={3} />

          <InsightsHub
            posts={analyticsData?.posts || []}
            uploadedAt={analyticsData?.uploaded_at}
            onUploadClick={() => setShowUploadDrawer(true)}
            compact
          />
          {/* removed: content bar looked out of place */}
          <ConsistencyTracker
            activityDays={activityDays}
            posts={analyticsData?.posts || []}
            dateRange={analyticsData?.date_range}
          />
        </div>

        {/* Right: Content Sidebar — height capped to left column */}
        <div className="relative">
          <div className="absolute inset-0">
            <ContentSidebar
              drafts={drafts}
              posts={analyticsData?.posts || []}
              inspirationPosts={inspirationPosts}
              onUploadClick={() => setShowUploadDrawer(true)}
            />
          </div>
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
