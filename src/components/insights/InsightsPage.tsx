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
import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import type { UserAnalyticsData } from "@/types/analytics";

export function InsightsPage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") || "overview";
  const { isFreePlan } = useSubscription();

  const [activeTab, setActiveTab] = useState(initialTab);

  const [analyticsData, setAnalyticsData] = useState<UserAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [tuningUp, setTuningUp] = useState(false);
  const [tuneupReport, setTuneupReport] = useState<VoiceReportData | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
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
    let pendingReport: VoiceReportData | null = null;
    try {
      const pending = sessionStorage.getItem("pending_voice_report");
      if (pending) {
        sessionStorage.removeItem("pending_voice_report");
        pendingReport = JSON.parse(pending) as VoiceReportData;
        setTuneupReport(pendingReport);
      }
    } catch {
      // Corrupt/unavailable storage — ignore.
    }

    // Load the latest persisted Voice Report (free, read-only) so it shows by
    // default without re-running the 5-credit tune-up. The cold-start handoff
    // above wins if present (it's the freshest).
    if (pendingReport) {
      setReportLoading(false);
    } else {
      fetch("/api/insights/report")
        .then(async (res) => (res.ok ? (await res.json()).report : null))
        .then((report) => {
          if (report) setTuneupReport(report as VoiceReportData);
        })
        .catch(() => {})
        .finally(() => setReportLoading(false));
    }
  }, []);

  const handleRunTuneup = async () => {
    // Surface the analyzing state + result where it now lives.
    setActiveTab("voice");
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
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-inverse)] text-[var(--color-text-inverse)] rounded-lg font-medium transition-colors duration-100 shrink-0"
        >
          {tuningUp ? (
            <>
              <span aria-hidden className="inline-block animate-[blink_1s_steps(1)_infinite]">▌</span>
              <span>Analyzing your voice…</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>{tuneupReport ? "Refresh Voice Tune-Up" : "Run Voice Tune-Up"}</span>
            </>
          )}
        </button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="voice">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[var(--color-accent-400)]" />
              Voice Report
            </span>
          </TabsTrigger>
          <TabsTrigger value="patterns">
            <span className="flex items-center gap-1.5">
              Patterns
              {isFreePlan && <Lock className="w-3 h-3 text-[var(--color-accent-400)]" />}
            </span>
          </TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="assistant">
            <span className="flex items-center gap-1.5">
              Assistant
              {isFreePlan && <Lock className="w-3 h-3 text-[var(--color-accent-400)]" />}
            </span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="voice">
          <div className="space-y-6">
            {tuneupError && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-[var(--color-danger-500)]/5 border border-[var(--color-danger-500)]/20">
                <span className="text-sm text-[var(--color-text-secondary)] flex-1">
                  {tuneupError.message}
                </span>
                {tuneupError.upgrade && (
                  <Link
                    href="/pricing"
                    className="text-xs font-semibold text-[var(--color-accent-400)] hover:text-[var(--color-accent-400)] transition shrink-0"
                  >
                    Upgrade
                  </Link>
                )}
              </div>
            )}
            {tuningUp && !tuneupReport && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-[var(--color-accent-500)]/5 border border-[var(--color-accent-500)]/20">
                <span aria-hidden className="inline-block animate-[blink_1s_steps(1)_infinite] text-[var(--color-accent-400)]">▌</span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Analyzing your voice… This usually takes 20–40 seconds.
                </span>
              </div>
            )}
            {reportLoading && !tuneupReport && !tuningUp && (
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)]">
                <span aria-hidden className="inline-block animate-[blink_1s_steps(1)_infinite] text-[var(--color-accent-400)]">▌</span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  Loading your latest Voice Report…
                </span>
              </div>
            )}
            {tuneupReport ? (
              <VoiceReport report={tuneupReport} />
            ) : (
              !reportLoading &&
              !tuningUp && (
                <div className="flex flex-col items-center justify-center text-center gap-3 py-16 px-6 rounded-xl border border-dashed border-[var(--color-border-default)] bg-[var(--color-bg-elevated)]/40">
                  <div className="w-11 h-11 rounded-xl bg-[var(--color-accent-500)]/10 flex items-center justify-center">
                    <Sparkles className="w-5 h-5 text-[var(--color-accent-400)]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                      No Voice Report yet
                    </h3>
                    <p className="text-sm text-[var(--color-text-muted)] mt-1 max-w-sm">
                      Run a Voice Tune-Up to analyze your niche, positioning, and
                      top-performing patterns — then see exactly how your content
                      sounds like you.
                    </p>
                  </div>
                  <button
                    onClick={handleRunTuneup}
                    disabled={tuningUp}
                    className="flex items-center gap-2 px-4 py-2 bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] disabled:bg-[var(--color-bg-hover)] disabled:text-[var(--color-text-inverse)] text-[var(--color-text-inverse)] rounded-lg text-sm font-medium transition-colors duration-100"
                  >
                    <Sparkles className="w-4 h-4" />
                    <span>Run Voice Tune-Up</span>
                  </button>
                </div>
              )
            )}
          </div>
        </TabsContent>

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
