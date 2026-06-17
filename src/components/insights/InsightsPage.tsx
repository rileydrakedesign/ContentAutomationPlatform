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
import { VoiceReport, type VoiceReportData } from "./VoiceReport";
import { useSubscription } from "@/components/auth/SubscriptionProvider";
import { parseGateError } from "@/lib/utils/gate-error";
import { Lock, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import type { UserAnalyticsData } from "@/types/analytics";

export function InsightsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const { isFreePlan } = useSubscription();

  const [analyticsData, setAnalyticsData] = useState<UserAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [tuningUp, setTuningUp] = useState(false);
  const [tuneupReport, setTuneupReport] = useState<VoiceReportData | null>(null);
  const [tuneupError, setTuneupError] = useState<{ message: string; upgrade?: boolean } | null>(
    null
  );

  useEffect(() => {
    fetch("/api/analytics/csv")
      .then((res) => res.json())
      .then((data) => setAnalyticsData(data.data || null))
      .catch(console.error)
      .finally(() => setLoading(false));

    // A Voice Report handed off by the onboarding first tune-up — render it
    // immediately instead of making the user re-run.
    try {
      const pending = sessionStorage.getItem("pending_voice_report");
      if (pending) {
        sessionStorage.removeItem("pending_voice_report");
        setTuneupReport(JSON.parse(pending) as VoiceReportData);
      }
    } catch {
      // Corrupt/unavailable storage — ignore.
    }
  }, []);

  const handleRunTuneup = async () => {
    setTuningUp(true);
    setTuneupError(null);
    try {
      const res = await fetch("/api/insights/tuneup", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setTuneupReport(data.report || null);
      } else {
        const gateErr = parseGateError(res.status, data);
        if (gateErr) {
          setTuneupError({ message: gateErr.message, upgrade: true });
        } else {
          setTuneupError({ message: data.error || "Voice tune-up failed. Please try again." });
        }
      }
    } catch (error) {
      console.error("Failed to run voice tune-up:", error);
      setTuneupError({ message: "Voice tune-up failed. Please try again." });
    } finally {
      setTuningUp(false);
    }
  };

  const handleUploadComplete = () => {
    fetch("/api/analytics/csv")
      .then((res) => res.json())
      .then((data) => setAnalyticsData(data.data || null))
      .catch(console.error);
  };

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-[var(--color-text-primary)]">Insights</h1>
          <p className="text-[var(--color-text-muted)] mt-1">
            Analytics, patterns, and actionable suggestions
          </p>
        </div>
        <button
          onClick={handleRunTuneup}
          disabled={tuningUp}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-muted)] text-white rounded-lg font-medium transition-colors shrink-0"
        >
          {tuningUp ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Analyzing your voice…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Run Voice Tune-Up</span>
            </>
          )}
        </button>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="patterns">
            <span className="flex items-center gap-1.5">
              Patterns
              {isFreePlan && <Lock className="w-3 h-3 text-[var(--color-primary-400)]" />}
            </span>
          </TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="assistant">
            <span className="flex items-center gap-1.5">
              Assistant
              {isFreePlan && <Lock className="w-3 h-3 text-[var(--color-primary-400)]" />}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="space-y-6">
            {tuneupError && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-[var(--color-danger-500)]/5 border border-[var(--color-danger-500)]/20">
                <span className="text-sm text-[var(--color-text-secondary)] flex-1">
                  {tuneupError.message}
                </span>
                {tuneupError.upgrade && (
                  <Link
                    href="/pricing"
                    className="text-xs font-semibold text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] transition shrink-0"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
            )}
            {tuningUp && !tuneupReport && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-[var(--color-primary-500)]/5 border border-[var(--color-primary-500)]/20">
                <Loader2 className="w-4 h-4 animate-spin text-[var(--color-primary-400)]" />
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Analyzing your voice… This usually takes 20–40 seconds.
                </span>
              </div>
            )}
            {tuneupReport && <VoiceReport report={tuneupReport} />}
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
