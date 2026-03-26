export type PlanId = "free" | "pro" | "business";

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
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    price: 19,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || "",
    features: [
      "Everything in Free",
      "X API sync & analytics",
      "Unlimited AI generations",
      "Post scheduling",
      "Pattern extraction",
      "Insights chat",
    ],
    limits: {
      aiGenerationsPerDay: Infinity,
      xApiSync: true,
      scheduling: true,
      patternExtraction: true,
      insightsChat: true,
    },
  },
  business: {
    id: "business",
    name: "Business",
    price: 39,
    stripePriceId: process.env.NEXT_PUBLIC_STRIPE_BUSINESS_PRICE_ID || "",
    features: [
      "Everything in Pro",
      "Priority support",
      "Early access to new features",
    ],
    limits: {
      aiGenerationsPerDay: Infinity,
      xApiSync: true,
      scheduling: true,
      patternExtraction: true,
      insightsChat: true,
    },
  },
};

export interface UserSubscription {
  plan_id: PlanId;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: "active" | "canceled" | "past_due" | "trialing" | "incomplete";
  current_period_end: string | null;
}

export function getPlanByPriceId(priceId: string): PlanConfig | undefined {
  return Object.values(PLANS).find((p) => p.stripePriceId === priceId);
}
