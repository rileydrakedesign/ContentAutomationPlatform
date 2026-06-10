"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { ProductTour } from "./ProductTour";

/**
 * Wraps app content and shows the onboarding modal for new users
 * who haven't completed the walkthrough yet.
 *
 * Checks `user.user_metadata.onboarding_completed` from Supabase auth.
 */
export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const [dismissed, setDismissed] = useState(false);

  // Derived during render — no effect needed
  const completed = user?.user_metadata?.onboarding_completed === true;
  const showOnboarding = !loading && !!user && !completed && !dismissed;

  return (
    <>
      {children}
      {showOnboarding && <ProductTour onComplete={() => setDismissed(true)} />}
    </>
  );
}
