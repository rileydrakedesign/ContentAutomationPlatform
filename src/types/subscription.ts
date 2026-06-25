export type PlanId = "free" | "pro" | "agent" | "agency";

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
    // Writing assistant ("Grammarly for tweets") — the always-on live editor
    // (Tier-0 deterministic + L2 embedding scores + L3 LLM explanations). This is
    // a SUBSCRIPTION ENTITLEMENT gate (requireFeature), never a metered quota:
    // the live loop can't tick a credit on every pause. Currently granted to every
    // plan (table-stakes); flip free → false to make it a paid feature.
    writingAssistant: boolean;
    // Agency tier: manage isolated per-client voice profiles (multi-account).
    multiAccount: boolean;
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
      writingAssistant: true,
      multiAccount: false,
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
      writingAssistant: true,
      multiAccount: false,
      monthlyCredits: 2000,
      apiRateLimit: 60,
      apiPublishPerDay: 200,
      apiGeneratePerDay: 1000,
    },
  },
  // Heavy-automation tier. Hidden everywhere until
  // NEXT_PUBLIC_STRIPE_AGENT_PRICE_ID is set (see isPlanAvailable).
  agent: {
    id: "agent",
    name: "Agent",
    price: 79,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_AGENT_PRICE_ID || "",
    features: [
      "Everything in Pro",
      "7,500 agent credits per month",
      "Higher API rate limits & daily caps",
      "Built for MCP & automation workloads",
    ],
    limits: {
      aiGenerationsPerDay: Infinity,
      xApiSync: true,
      scheduling: true,
      patternExtraction: true,
      insightsChat: true,
      writingAssistant: true,
      multiAccount: false,
      monthlyCredits: 7500,
      apiRateLimit: 120,
      apiPublishPerDay: 600,
      apiGeneratePerDay: 3000,
    },
  },
  // Agency tier. Manage isolated per-client voice profiles. Hidden everywhere
  // until NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID is set (see isPlanAvailable).
  agency: {
    id: "agency",
    name: "Agency",
    price: 199,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_AGENCY_PRICE_ID || "",
    features: [
      "Everything in Pro",
      "Unlimited isolated client voice profiles",
      "Per-client Voice Report & voice-check",
      "Client approval workflow",
      "White-label sharing",
    ],
    limits: {
      aiGenerationsPerDay: Infinity,
      xApiSync: true,
      scheduling: true,
      patternExtraction: true,
      insightsChat: true,
      writingAssistant: true,
      multiAccount: true,
      monthlyCredits: 7500,
      apiRateLimit: 120,
      apiPublishPerDay: 600,
      apiGeneratePerDay: 3000,
    },
  },
};

/** Plans that can actually be purchased/shown. The agent tier is feature-
 *  flagged by the presence of its Stripe price ID. */
export function isPlanAvailable(planId: PlanId): boolean {
  if (planId === "agent") return !!PLANS.agent.stripePriceId;
  if (planId === "agency") return !!PLANS.agency.stripePriceId;
  return true;
}

/** One-time credit top-up packs, consumed after the monthly allowance.
 *  Pricing locked in MCP_PROD_READINESS_PLAN.md §B2 — every pack's $/credit
 *  stays above the URL-post COGS floor so volume discounts can't go negative. */
export const CREDIT_PACKS = {
  credits_500: {
    id: "credits_500",
    credits: 500,
    price: 6,
    stripePriceId: process.env.STRIPE_PRICE_CREDITS_500 || "",
  },
  credits_2000: {
    id: "credits_2000",
    credits: 2000,
    price: 20,
    stripePriceId: process.env.STRIPE_PRICE_CREDITS_2000 || "",
  },
  credits_10000: {
    id: "credits_10000",
    credits: 10000,
    price: 80,
    stripePriceId: process.env.STRIPE_PRICE_CREDITS_10000 || "",
  },
} as const;

export type CreditPackId = keyof typeof CREDIT_PACKS;

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
