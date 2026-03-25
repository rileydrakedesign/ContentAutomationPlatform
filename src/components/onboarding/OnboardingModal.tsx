"use client";

import { useState, useCallback } from "react";
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
  const [currentStep, setCurrentStep] = useState(0);

  const step = STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === STEPS.length - 1;

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl mx-4 bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-2xl shadow-[var(--shadow-xl)] overflow-hidden">
        {/* Progress bar */}
        <div className="flex gap-1 px-6 pt-6">
          {STEPS.map((s, i) => (
            <div
              key={s.id}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
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
              className={`text-[10px] font-medium uppercase tracking-wider transition-colors ${
                i <= currentStep
                  ? "text-[var(--color-primary-400)]"
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
          {step.id === "ready" && <ReadyStep />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-8 py-5 border-t border-[var(--color-border-subtle)]">
          <div>
            {!isFirst && (
              <Button variant="ghost" size="sm" onClick={back} icon={<ArrowLeft className="w-3.5 h-3.5" />}>
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
              <Button variant="primary" size="md" glow onClick={finish} icon={<Sparkles className="w-4 h-4" />}>
                Go to Dashboard
              </Button>
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
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-primary-500)]/10 flex items-center justify-center mb-6">
        <Sparkles className="w-8 h-8 text-[var(--color-primary-400)]" />
      </div>
      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] text-heading">
        Welcome to Agents for X
      </h2>
      <p className="text-[var(--color-text-secondary)] mt-3 max-w-md leading-relaxed">
        Your AI-powered growth assistant that lives inside your X timeline.
        Let&apos;s get you set up in under 2 minutes.
      </p>

      <div className="grid grid-cols-3 gap-4 mt-8 w-full max-w-lg">
        <FeatureCard
          icon={<Bookmark className="w-5 h-5" />}
          label="Save posts"
          desc="One-click from X"
        />
        <FeatureCard
          icon={<MessageSquare className="w-5 h-5" />}
          label="AI replies"
          desc="In your voice"
        />
        <FeatureCard
          icon={<Sparkles className="w-5 h-5" />}
          label="Grow faster"
          desc="Data-driven"
        />
      </div>
    </div>
  );
}

function ExtensionStep() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-[var(--color-primary-500)]/10 flex items-center justify-center">
          <Chrome className="w-5 h-5 text-[var(--color-primary-400)]" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[var(--color-text-primary)] text-heading">
            Install the Chrome Extension
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">This is where the magic happens</p>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed">
        The extension adds buttons directly to your X timeline so you can:
      </p>

      <div className="space-y-3 mt-4">
        <BulletItem
          icon={<Bookmark className="w-4 h-4" />}
          title="Save inspiration posts"
          desc="Click the bookmark icon on any post to save it to your library"
        />
        <BulletItem
          icon={<MessageSquare className="w-4 h-4" />}
          title="Generate AI replies"
          desc="Choose a tone (helpful, controversial, insightful...) and get 3 reply options"
        />
        <BulletItem
          icon={<Sparkles className="w-4 h-4" />}
          title="Score opportunities"
          desc="See which posts are worth engaging with based on metrics and timing"
        />
      </div>

      <div className="mt-auto pt-6">
        <div className="p-4 rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)]">
          <p className="text-xs text-[var(--color-text-muted)] mb-3">
            Install from Chrome Web Store or load manually:
          </p>
          <ol className="text-xs text-[var(--color-text-secondary)] space-y-1.5 list-decimal list-inside">
            <li>Go to <span className="font-mono text-[var(--color-primary-400)]">chrome://extensions</span></li>
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
          desc="Import your recent posts so the AI can learn your voice"
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
            Configure Your Voice
          </h2>
          <p className="text-xs text-[var(--color-text-muted)]">So AI output sounds like you</p>
        </div>
      </div>

      <p className="text-sm text-[var(--color-text-secondary)] mt-4 leading-relaxed">
        The voice system is what makes replies and drafts sound like <em>you</em> instead of generic AI.
        The more examples you add, the better it gets.
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
          desc="Adjust tone, energy, and stance to fine-tune the output"
        />
        <BulletItem
          icon={<Upload className="w-4 h-4 text-[var(--color-text-muted)]" />}
          title="Or upload a CSV"
          desc="Export your X analytics and upload it to auto-populate examples"
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

function ReadyStep() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-success-500)]/10 flex items-center justify-center mb-6">
        <CheckCircle2 className="w-8 h-8 text-[var(--color-success-400)]" />
      </div>
      <h2 className="text-2xl font-semibold text-[var(--color-text-primary)] text-heading">
        You&apos;re all set
      </h2>
      <p className="text-[var(--color-text-secondary)] mt-3 max-w-md leading-relaxed">
        Head to X, start saving posts and generating replies. The more you use it,
        the better it gets at matching your voice.
      </p>

      <div className="grid grid-cols-2 gap-3 mt-8 w-full max-w-sm text-left">
        <QuickLink label="Open X" desc="Start engaging" href="https://x.com" external />
        <QuickLink label="Voice Settings" desc="Refine your style" href="/voice" />
        <QuickLink label="Create Drafts" desc="Write new posts" href="/create" />
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
      <div className="text-[var(--color-primary-400)] mb-2">{icon}</div>
      <p className="text-sm font-medium text-[var(--color-text-primary)]">{label}</p>
      <p className="text-xs text-[var(--color-text-muted)] mt-0.5">{desc}</p>
    </div>
  );
}

function BulletItem({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-[var(--color-primary-400)] shrink-0">{icon}</div>
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
