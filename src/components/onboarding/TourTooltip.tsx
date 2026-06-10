"use client";

import { Button } from "@/components/ui/Button";
import { ArrowLeft, ArrowRight, ExternalLink, Sparkles, X } from "lucide-react";
import type { TourStep } from "./tourSteps";
import { TOUR_STEPS } from "./tourSteps";

interface TourTooltipProps {
  step: TourStep;
  currentIndex: number;
  tooltipStyle: React.CSSProperties;
  arrowPlacement: "top" | "bottom" | "left" | "right";
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  onFinish: () => void;
}

export function TourTooltip({
  step,
  currentIndex,
  tooltipStyle,
  arrowPlacement,
  onNext,
  onBack,
  onSkip,
  onFinish,
}: TourTooltipProps) {
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === TOUR_STEPS.length - 1;
  const Icon = step.icon;

  // Interactive steps: pin to bottom-right corner so user can interact with the page
  const positionStyle: React.CSSProperties = step.interactive
    ? {
        position: "fixed",
        bottom: 24,
        right: 24,
        zIndex: 50,
        width: 340,
      }
    : {
        ...tooltipStyle,
        zIndex: 50,
        width: 340,
      };

  return (
    <div className="animate-scale-in" style={positionStyle}>
      {/* Arrow — only show on non-interactive steps */}
      {!step.interactive && <Arrow placement={arrowPlacement} />}

      <div className="rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] shadow-[var(--shadow-xl)] overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-3 flex items-start gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: `color-mix(in srgb, ${step.iconBg} 15%, transparent)` }}
          >
            <Icon className="w-4.5 h-4.5" style={{ color: step.iconColor }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight">
              {step.title}
            </h3>
            <p className="text-xs text-[var(--color-text-secondary)] mt-1 leading-relaxed">
              {step.description}
            </p>
          </div>
          <button
            onClick={onSkip}
            className="shrink-0 p-1 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors"
            title="Skip tour"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* External action button (optional — opens new tab) */}
        {step.externalAction && (
          <div className="px-5 pb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(step.externalAction!.href, "_blank")}
              icon={<ExternalLink className="w-3.5 h-3.5" />}
            >
              {step.externalAction.label}
            </Button>
            <p className="text-[10px] text-[var(--color-text-muted)] mt-1.5">
              Opens in a new tab. You can also do this later.
            </p>
          </div>
        )}

        {/* Footer: progress dots + nav buttons */}
        <div className="px-5 py-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between">
          {/* Progress dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-200 ${
                  i === currentIndex
                    ? "bg-[var(--color-primary-500)] w-4 rounded-full"
                    : i < currentIndex
                    ? "bg-[var(--color-primary-400)]/50"
                    : "bg-[var(--color-bg-elevated)]"
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onBack}
                icon={<ArrowLeft className="w-3 h-3" />}
              >
                Back
              </Button>
            )}
            {step.skippable && !isLast && (
              <Button variant="ghost" size="sm" onClick={onNext}>
                Skip
              </Button>
            )}
            {isLast ? (
              <Button
                variant="primary"
                size="sm"
                glow
                onClick={onFinish}
                icon={<Sparkles className="w-3.5 h-3.5" />}
              >
                Get Started
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={onNext}
                icon={<ArrowRight className="w-3 h-3" />}
                iconPosition="right"
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Arrow({ placement }: { placement: "top" | "bottom" | "left" | "right" }) {
  const base =
    "absolute w-2.5 h-2.5 bg-[var(--color-bg-surface)] border-[var(--color-border-default)] rotate-45";

  switch (placement) {
    case "top":
      return (
        <div
          className={`${base} border-t border-l`}
          style={{ top: -5, left: 24 }}
        />
      );
    case "bottom":
      return (
        <div
          className={`${base} border-b border-r`}
          style={{ bottom: -5, left: 24 }}
        />
      );
    case "left":
      return (
        <div
          className={`${base} border-t border-l`}
          style={{ left: -5, top: 20 }}
        />
      );
    case "right":
      return (
        <div
          className={`${base} border-b border-r`}
          style={{ right: -5, top: 20 }}
        />
      );
  }
}
