"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Chrome,
  PlugZap,
  Sliders,
  Upload,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  Bookmark,
  PenSquare,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";

/* ------------------------------------------------------------------ */
/*  Step definitions                                                    */
/* ------------------------------------------------------------------ */

type StepId = "welcome" | "extension" | "connect" | "voice" | "ready";

interface Step {
  id: StepId;
  title: string;
  skippable: boolean;
}

const STEPS: Step[] = [
  { id: "welcome", title: "Welcome", skippable: false },
  { id: "extension", title: "Extension", skippable: true },
  { id: "connect", title: "Connect X", skippable: true },
  { id: "voice", title: "Voice", skippable: true },
  { id: "ready", title: "Ready", skippable: false },
];

/* ------------------------------------------------------------------ */
/*  OnboardingModal                                                     */
/* ------------------------------------------------------------------ */

export function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [hasAnalytics, setHasAnalytics] = useState<boolean | null>(null);
  const [tuningUp, setTuningUp] = useState(false);

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

  // Check whether the user has analytics data so the final step can offer
  // a guided first Voice Tune-Up instead of an empty profile.
  useEffect(() => {
    fetch("/api/analytics/csv")
      .then((res) => res.json())
      .then((data) =>
        setHasAnalytics(Boolean(data.data) && (data.data.posts?.length ?? 0) > 0)
      )
      .catch(() => setHasAnalytics(false));
  }, []);

  const next = useCallback(() => {
    if (isLast) return;
    setCurrentStep((s) => s + 1);
  }, [isLast]);

  const back = useCallback(() => {
    if (isFirst) return;
    setCurrentStep((s) => s - 1);
  }, [isFirst]);

  const finish = useCallback(async () => {
    try {
      const supabase = createClient();
      await supabase.auth.updateUser({
        data: { onboarding_completed: true },
      });
    } catch (e) {
      console.error("Failed to save onboarding status:", e);
    }
    onComplete();
  }, [onComplete]);

  /** Run the first Voice Tune-Up, then close the modal and open the Voice Report. */
  const runFirstTuneup = useCallback(async () => {
    setTuningUp(true);
    try {
      const res = await fetch("/api/insights/tuneup", { method: "POST" });
      if (!res.ok) {
        console.error("First Voice Tune-Up failed with status:", res.status);
      } else {
        // Hand the freshly generated Voice Report to the Insights page so it
        // renders immediately on arrival instead of being discarded.
        const data = await res.json();
        if (data?.report) {
          try {
            sessionStorage.setItem("pending_voice_report", JSON.stringify(data.report));
          } catch {
            // Storage full/unavailable — the tune-up still persisted its results.
          }
        }
      }
    } catch (e) {
      console.error("Failed to run first Voice Tune-Up:", e);
    } finally {
      setTuningUp(false);
      // Success or failure, land the user on Insights where the Voice Report lives.
      await finish();
      router.push("/insights");
    }
  }, [finish, router]);

  /** Close the modal and land in the editor, where the writing assistant is live. */
  const finishToEditor = useCallback(async () => {
    await finish();
    router.push("/create");
  }, [finish, router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--color-bg-base)]/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl mx-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-2xl shadow-[var(--shadow-xl)] overflow-hidden">
        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-6">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors duration-100 ${
                i <= currentStep
                  ? "bg-[var(--color-primary-500)]"
                  : "bg-[var(--color-bg-elevated)]"
              }`}
            />
          ))}
        </div>

        {/* Step labels */}
        <div className="flex justify-between px-6 mt-2 mb-6">
          {STEPS.map((s, i) => (
            <span
              key={s.id}
              className={`text-[10px] font-medium uppercase tracking-wider transition-colors duration-100 ${
                i <= currentStep
                  ? "text-[var(--color-accent-400)]"
                  : "text-[var(--color-text-muted)]"
              }`}
            >
              {s.title}
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="px-8 pb-4 min-h-[320px] flex flex-col">
          {step.id === "welcome" && <WelcomeStep />}
          {step.id === "extension" && <ExtensionStep />}
          {step.id === "connect" && <ConnectStep />}
          {step.id === "voice" && <VoiceStep />}
          {step.id === "ready" && <ReadyStep hasAnalytics={hasAnalytics} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-[var(--color-border-subtle)]">
          <div>
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={back}
                disabled={tuningUp}
                icon={<ArrowLeft className="w-3.5 h-3.5" />}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step.skippable && !isLast && (
              <Button variant="ghost" size="sm" onClick={next}>
                Skip
              </Button>
            )}
            {isLast ? (
              <>
                {hasAnalytics && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={runFirstTuneup}
                    disabled={tuningUp}
                    icon={
                      tuningUp ? (
                        <span aria-hidden className="inline-block animate-[blink_1s_steps(1)_infinite]">▌</span>
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )
                    }
                  >
                    {tuningUp ? "Tuning your voice…" : "Run a Voice Tune-Up first"}
                  </Button>
                )}
                <Button
                  variant="primary"
                  size="md"
                  glow
                  onClick={finishToEditor}
                  disabled={tuningUp}
                  icon={<PenSquare className="w-4 h-4" />}
                >
                  Write your first post
                </Button>
              </>
            ) : (
              <Button variant="primary" size="md" onClick={next} icon={<ArrowRight className="w-4 h-4" />} iconPosition="right">
                Continue
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Step content components                                             */
/* ------------------------------------------------------------------ */

function WelcomeStep() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-500)]/10 flex items-center justify-center mb-6">
        <Sparkles className="w-8 h-8 text-[var(--color-accent-400)]" />
      </div>
      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] text-heading">
        Welcome to Agents for X
      </h2>
      <p className="text-[var(--color-text-secondary)] mt-3 max-w-md leading-relaxed">
        You write, it coaches. As you type, the assistant shows you where a
        post drifts from your voice and where it&apos;ll lose to the algorithm
        — grounded in your own top posts. Let&apos;s get you set up in under 2
        minutes.
      </p>

      <div className="grid grid-cols-3 gap-4 mt-8 w-full max-w-lg">
        <FeatureCard
          icon={<PenSquare className="w-5 h-5" />}
          label="You write"
          desc="Your words, your posts"
        />
        <FeatureCard
          icon={<Sparkles className="w-5 h-5" />}
          label="It coaches"
          desc="Flags voice drift + reach risks live"
        />
        <FeatureCard
          icon={<Bookmark className="w-5 h-5" />}
          label="Grounded in you"
          desc="Learns from your top posts"
        />
      </div>
    </div>
  );
}

function ExtensionStep() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-500)]/10 flex items-center justify-center">
          <Chrome className="w-5 h-5 text-[var(--color-accent-400)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] text-heading">
            Install the Chrome Extension
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">Your writing assistant, right inside X</p>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed">
        The extension brings the writing assistant into X&apos;s own composer — so you can:
      </p>

      <div className="space-y-3 mt-4">
        <BulletItem
          icon={<Sparkles className="w-4 h-4" />}
          title="Write on-voice, inside X"
          desc="The assistant checks voice and reach as you type in X's own composer"
        />
        <BulletItem
          icon={<Bookmark className="w-4 h-4" />}
          title="Save inspiration posts"
          desc="Click the bookmark icon on any post to save it to your library"
        />
        <BulletItem
          icon={<MessageSquare className="w-4 h-4" />}
          title="Reply in your voice"
          desc="Check your replies before you send — or grab an in-voice option as a starting point"
        />
      </div>

      <div className="mt-auto pt-6">
        <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Install from Chrome Web Store or load manually:
          </p>
          <ol className="text-xs text-[var(--color-text-secondary)] space-y-1.5 list-decimal list-inside">
            <li>Go to <span className="font-mono text-[var(--color-accent-400)]">chrome://extensions</span></li>
            <li>Enable &quot;Developer mode&quot; (top right)</li>
            <li>Click &quot;Load unpacked&quot; and select the <span className="font-mono">chrome-extension/dist</span> folder</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function ConnectStep() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-accent-500)]/10 flex items-center justify-center">
          <PlugZap className="w-5 h-5 text-[var(--color-accent-400)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] text-heading">
            Connect Your X Account
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">Required for publishing</p>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed">
        Connecting your X account lets you publish posts and schedule content directly from the dashboard.
        We use OAuth so we never see your password.
      </p>

      <div className="space-y-3 mt-6">
        <BulletItem
          icon={<CheckCircle2 className="w-4 h-4 text-[var(--color-success-400)]" />}
          title="Publish & schedule"
          desc="Post drafts or schedule them for the best time"
        />
        <BulletItem
          icon={<CheckCircle2 className="w-4 h-4 text-[var(--color-success-400)]" />}
          title="Sync your timeline"
          desc="Import your recent posts to fuel niche analysis and voice tuning"
        />
      </div>

      <div className="mt-auto pt-6">
        <Button
          variant="outline"
          onClick={() => window.open("/settings", "_blank")}
          icon={<PlugZap className="w-4 h-4" />}
        >
          Open Settings to Connect
        </Button>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          You can also do this later from Settings.
        </p>
      </div>
    </div>
  );
}

function VoiceStep() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-success-500)]/10 flex items-center justify-center">
          <Sliders className="w-5 h-5 text-[var(--color-success-400)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] text-heading">
            Tune Your Voice
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">So your posts sound like you, not generic AI</p>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed">
        Your voice profile is what the assistant coaches you against. It
        combines your voice examples, your proven patterns, and your
        positioning — so as you write, it can tell exactly where a post
        drifts from how <em>you</em> actually sound.
      </p>

      <div className="space-y-3 mt-6">
        <BulletItem
          icon={<CheckCircle2 className="w-4 h-4 text-[var(--color-success-400)]" />}
          title="Add example posts"
          desc="Paste 3-5 of your best posts so the AI can study your style"
        />
        <BulletItem
          icon={<CheckCircle2 className="w-4 h-4 text-[var(--color-success-400)]" />}
          title="Tune the dials"
          desc="Adjust tone, energy, and stance to define how you sound"
        />
        <BulletItem
          icon={<Upload className="w-4 h-4 text-[var(--color-text-muted)]" />}
          title="Or upload a CSV"
          desc="Export your X analytics to auto-populate examples and extract your proven patterns"
        />
      </div>

      <div className="mt-auto pt-6">
        <Button
          variant="outline"
          onClick={() => window.open("/voice", "_blank")}
          icon={<Sliders className="w-4 h-4" />}
        >
          Open Voice Settings
        </Button>
        <p className="text-xs text-[var(--color-text-muted)] mt-2">
          You can refine your voice anytime from the Voice page.
        </p>
      </div>
    </div>
  );
}

function ReadyStep({ hasAnalytics }: { hasAnalytics: boolean | null }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-success-500)]/10 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-8 h-8 text-[var(--color-success-400)]" />
      </div>
      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] text-heading">
        You&apos;re all set
      </h2>
      {hasAnalytics ? (
        <p className="text-[var(--color-text-secondary)] mt-3 max-w-md leading-relaxed">
          The assistant is live in the editor — write your first post and
          watch it check voice and reach as you type. Your analytics are in,
          so you can also run a quick Voice Tune-Up first to sharpen its read
          on your voice.
        </p>
      ) : (
        <p className="text-[var(--color-text-secondary)] mt-3 max-w-md leading-relaxed">
          The assistant is live in the editor — write your first post and
          watch it check voice and reach as you type. Upload your X analytics
          CSV anytime to ground it in your own top posts.
        </p>
      )}

      <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-sm text-left">
        <QuickLink label="Open X" desc="Start engaging" href="https://x.com" external />
        <QuickLink label="Voice Settings" desc="Tune your voice" href="/voice" />
        <QuickLink label="Open the Editor" desc="Write with the assistant" href="/create" />
        <QuickLink label="Upload CSV" desc="Import analytics" href="/" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared sub-components                                               */
/* ------------------------------------------------------------------ */

function FeatureCard({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="flex flex-col items-center p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
      <div className="text-[var(--color-accent-400)] mb-2">{icon}</div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
    </div>
  );
}

function BulletItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-[var(--color-accent-400)] shrink-0">{icon}</div>
      <div>
        <p className="text-sm font-medium text-[var(--color-text-primary)]">{title}</p>
        <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
      </div>
    </div>
  );
}

function QuickLink({
  label,
  desc,
  href,
  external,
}: {
  label: string;
  desc: string;
  href: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noopener noreferrer" : undefined}
      className="p-3 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] hover:border-[var(--color-border-strong)] transition-colors"
    >
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
      <p className="text-xs text-[var(--color-text-muted)]">{desc}</p>
    </a>
  );
}
