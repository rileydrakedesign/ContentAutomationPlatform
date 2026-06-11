export type PlanId = "free" | "pro";

export interface PlanConfig {
  id: PlanId;
  name: string;
  price: number; // monthly USD
  stripePriceId: string | null; // null for free
  features: string[];
  limits: {
    aiGenerationsPerDay: number;
    xApiSync: boolean;
    scheduling: boolean;
    patternExtraction: boolean;
    insightsChat: boolean;
    // Agent surface (v1 API + MCP) metering — in-app UI usage is not metered.
    monthlyCredits: number;
    apiRateLimit: number; // requests/min per API key
    apiPublishPerDay: number; // abuse backstop on top of credits
    apiGeneratePerDay: number;
  };
}

export const PLANS: Record<PlanId, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    price: 0,
    stripePriceId: null,
    features: [
      "CSV & extension post imports",
      "5 AI generations per day",
      "Manual posting",
      "Basic analytics",
    ],
    limits: {
      aiGenerationsPerDay: 5,
      xApiSync: false,
      scheduling: false,
      patternExtraction: false,
      insightsChat: false,
      monthlyCredits: 100,
      apiRateLimit: 20,
      apiPublishPerDay: 5,
      apiGeneratePerDay: 20,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 29,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "",
    features: [
      "Everything in Free",
      "X API sync & analytics",
      "Unlimited AI generations",
      "Post scheduling",
      "Pattern extraction",
      "Insights chat",
      "Support via @AgentsForX DM",
    ],
    limits: {
      aiGenerationsPerDay: Infinity,
      xApiSync: true,
      scheduling: true,
      patternExtraction: true,
      insightsChat: true,
      monthlyCredits: 2000,
      apiRateLimit: 60,
      apiPublishPerDay: 200,
      apiGeneratePerDay: 1000,
    },
  },
};

export interface UserSubscription {
  plan_id: PlanId;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
  current_period_end: string | null;
  cancel_at_period_end: boolean;
}

export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId);
}

/** Whether a subscription should currently grant paid-tier access. */
export function isSubscriptionActive(sub: UserSubscription): boolean {
  if (sub.status === "active" || sub.status === "trialing") return true;
  // Grace through period end on past_due (failed renewal, recoverable) and
  // canceled (user/admin cancellation that takes effect at period end).
  if (
    (sub.status === "past_due" || sub.status === "canceled") &&
    sub.current_period_end &&
    new Date(sub.current_period_end) > new Date()
  ) {
    return true;
  }
  return false;
}
