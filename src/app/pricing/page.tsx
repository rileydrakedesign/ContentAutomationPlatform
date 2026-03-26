"use client";

import { useState } from "react";
import { useAuth } from "@/components/auth/AuthProvider";
import { Check } from "lucide-react";

const plans = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Get started with CSV imports and basic AI",
    features: [
      "CSV & extension post imports",
      "5 AI generations per day",
      "Manual posting",
      "Basic analytics",
      "Voice configuration",
    ],
    cta: "Current Plan",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    description: "Full power for serious X creators",
    features: [
      "Everything in Free",
      "X API sync & analytics",
      "Unlimited AI generations",
      "Post scheduling",
      "Pattern extraction",
      "Insights chat",
      "Niche analysis",
    ],
    cta: "Upgrade to Pro",
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: 39,
    description: "For power users who want the edge",
    features: [
      "Everything in Pro",
      "Priority support",
      "Early access to new features",
    ],
    cta: "Upgrade to Business",
    highlighted: false,
  },
];

export default function PricingPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    if (planId === "free") return;

    setLoading(planId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to start checkout");
      }
    } catch {
      alert("Failed to start checkout");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-semibold text-[var(--color-text-primary)]">
          Choose Your Plan
        </h1>
        <p className="mt-2 text-[var(--color-text-muted)]">
          Start free, upgrade when you need more power
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`rounded-xl border p-6 flex flex-col ${
              plan.highlighted
                ? "border-[var(--color-primary-500)]/50 bg-[var(--color-primary-500)]/5 ring-1 ring-[var(--color-primary-500)]/20"
                : "border-[var(--color-border-default)] bg-[var(--color-bg-surface)]"
            }`}
          >
            {plan.highlighted && (
              <div className="text-xs font-medium text-[var(--color-primary-400)] mb-2 uppercase tracking-wide">
                Most Popular
              </div>
            )}

            <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
              {plan.name}
            </h2>

            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-[var(--color-text-primary)]">
                ${plan.price}
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">/mo</span>
            </div>

            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              {plan.description}
            </p>

            <ul className="mt-6 space-y-3 flex-1">
              {plan.features.map((feature) => (
                <li
                  key={feature}
                  className="flex items-start gap-2 text-sm text-[var(--color-text-secondary)]"
                >
                  <Check className="w-4 h-4 text-[var(--color-success-400)] mt-0.5 shrink-0" />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              onClick={() => handleSubscribe(plan.id)}
              disabled={plan.id === "free" || loading === plan.id}
              className={`mt-6 w-full py-2.5 rounded-lg text-sm font-medium transition ${
                plan.highlighted
                  ? "bg-[var(--color-primary-500)] hover:bg-[var(--color-primary-600)] text-white disabled:opacity-50"
                  : plan.id === "free"
                    ? "bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-default"
                    : "bg-[var(--color-bg-elevated)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] disabled:opacity-50"
              }`}
            >
              {loading === plan.id ? "Loading..." : plan.cta}
            </button>
          </div>
        ))}
      </div>

      {!user && (
        <p className="mt-8 text-center text-sm text-[var(--color-text-muted)]">
          You need to be logged in to subscribe.{" "}
          <a href="/login" className="text-[var(--color-primary-400)] hover:underline">
            Log in
          </a>
        </p>
      )}
    </div>
  );
}
