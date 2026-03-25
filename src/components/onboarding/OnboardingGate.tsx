"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { OnboardingModal } from "./OnboardingModal";

/**
 * Wraps app content and shows the onboarding modal for new users
 * who haven't completed the walkthrough yet.
 *
 * Checks `user.user_metadata.onboarding_completed` from Supabase auth.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (loading || !user) {
      setChecked(true);
      return;
    }

    const completed = user.user_metadata?.onboarding_completed === true;
    setShowOnboarding(!completed);
    setChecked(true);
  }, [user, loading]);

  const handleComplete = () => {
    setShowOnboarding(false);
  };

  // Don't render anything until we've checked onboarding status
  if (!checked) return null;

  return (
    <>
      {children}
      {showOnboarding && user && <OnboardingModal onComplete={handleComplete} />}
    </>
  );
}
