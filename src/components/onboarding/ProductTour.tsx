"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TOUR_STEPS, TOUR_STORAGE_KEY } from "./tourSteps";
import { useTourPositioning } from "./useTourPositioning";
import { TourOverlay } from "./TourOverlay";
import { TourTooltip } from "./TourTooltip";

interface ProductTourProps {
  onComplete: () => void;
}

function getSavedStep(): number {
  if (typeof window === "undefined") return 0;
  const saved = sessionStorage.getItem(TOUR_STORAGE_KEY);
  if (saved !== null) {
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed < TOUR_STEPS.length) {
      return parsed;
    }
  }
  return 0;
}

export function ProductTour({ onComplete }: ProductTourProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [currentStep, setCurrentStep] = useState(getSavedStep);
  const [transitioning, setTransitioning] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const step = TOUR_STEPS[currentStep];

  // Navigate to the correct page for the current step if needed
  useEffect(() => {
    const stepNav = step.navigate;
    if (stepNav && pathname !== stepNav) {
      router.push(stepNav);
    }
    // Show tooltip after a brief delay to let the page render
    const timer = setTimeout(() => setShowTooltip(true), 400);
    return () => clearTimeout(timer);
  }, [step, pathname, router]);

  // Persist step to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(TOUR_STORAGE_KEY, String(currentStep));
  }, [currentStep]);

  const { targetRect, tooltipStyle, arrowPlacement } = useTourPositioning(
    step.target,
    step.placement
  );

  const goToStep = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= TOUR_STEPS.length) return;
      setShowTooltip(false);
      setTransitioning(true);

      const nextStep = TOUR_STEPS[nextIndex];
      const needsNavigation = nextStep.navigate && nextStep.navigate !== pathname;

      if (needsNavigation) {
        // Navigate first, then update step — the page will remount with the new step
        sessionStorage.setItem(TOUR_STORAGE_KEY, String(nextIndex));
        setCurrentStep(nextIndex);
        setTransitioning(false);
        router.push(nextStep.navigate!);
      } else {
        setTimeout(() => {
          setCurrentStep(nextIndex);
          setTransitioning(false);
          setTimeout(() => setShowTooltip(true), 50);
        }, 300);
      }
    },
    [pathname, router]
  );

  const next = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, goToStep]);

  const back = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  const finish = useCallback(async () => {
    sessionStorage.removeItem(TOUR_STORAGE_KEY);
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

  const skip = useCallback(() => {
    finish();
  }, [finish]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        skip();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        if (currentStep === TOUR_STEPS.length - 1) {
          finish();
        } else {
          next();
        }
      } else if (e.key === "ArrowLeft") {
        back();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, next, back, skip, finish]);

  // Don't render tour UI if we're on the wrong page (navigation in progress)
  if (step.navigate && pathname !== step.navigate) {
    return null;
  }

  return (
    <>
      {!step.interactive && (
        <TourOverlay targetRect={targetRect} transitioning={transitioning} />
      )}

      {showTooltip && (
        <TourTooltip
          key={step.id}
          step={step}
          currentIndex={currentStep}
          tooltipStyle={tooltipStyle}
          arrowPlacement={arrowPlacement}
          onNext={next}
          onBack={back}
          onSkip={skip}
          onFinish={finish}
        />
      )}
    </>
  );
}
