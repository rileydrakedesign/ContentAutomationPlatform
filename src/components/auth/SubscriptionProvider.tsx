"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { useAuth } from "./AuthProvider";
import type { PlanId } from "@/types/subscription";

interface SubscriptionUsage {
  used: number;
  limit: number | null;
  remaining: number | null;
  unlimited: boolean;
}

interface SubscriptionState {
  plan_id: PlanId;
  plan_name: string;
  status: string;
  current_period_end: string | null;
  has_billing: boolean;
  limits: {
    aiGenerationsPerDay: number;
    xApiSync: boolean;
    scheduling: boolean;
    patternExtraction: boolean;
    insightsChat: boolean;
  };
  usage: SubscriptionUsage;
}

interface SubscriptionContextType {
  subscription: SubscriptionState | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  canUseFeature: (feature: string) => boolean;
  isFreePlan: boolean;
  isPaidPlan: boolean;
  aiLimitReached: boolean;
}

const defaultContext: SubscriptionContextType = {
  subscription: null,
  loading: true,
  error: null,
  refetch: async () => {},
  canUseFeature: () => false,
  isFreePlan: true,
  isPaidPlan: false,
  aiLimitReached: false,
};

const SubscriptionContext = createContext<SubscriptionContextType>(defaultContext);

export function useSubscription() {
  return useContext(SubscriptionContext);
}

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const res = await fetch("/api/stripe/subscription");
      if (!res.ok) throw new Error("Failed to fetch subscription");
      const data = await res.json();
      setSubscription(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  // Refetch on window focus (catches returning from Stripe checkout)
  useEffect(() => {
    function handleFocus() {
      if (user) fetchSubscription();
    }
    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [user, fetchSubscription]);

  const canUseFeature = useCallback(
    (feature: string): boolean => {
      if (!subscription) return false;
      const val = subscription.limits[feature as keyof typeof subscription.limits];
      if (typeof val === "boolean") return val;
      if (typeof val === "number") return val > 0;
      return false;
    },
    [subscription]
  );

  const isFreePlan = !subscription || subscription.plan_id === "free";
  const isPaidPlan = !!subscription && subscription.plan_id !== "free";
  const aiLimitReached =
    !!subscription &&
    !subscription.usage.unlimited &&
    subscription.usage.remaining !== null &&
    subscription.usage.remaining <= 0;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        error,
        refetch: fetchSubscription,
        canUseFeature,
        isFreePlan,
        isPaidPlan,
        aiLimitReached,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}
