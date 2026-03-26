"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface SubscriptionInfo {
  plan_id: string;
  plan_name: string;
  status: string;
  current_period_end: string | null;
  has_billing: boolean;
}

export function BillingTab() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch("/api/stripe/subscription")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setSub(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || "Failed to open billing portal");
      }
    } catch {
      alert("Failed to open billing portal");
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) {
    return <div className="text-[var(--color-text-muted)]">Loading billing info...</div>;
  }

  const statusVariant =
    sub?.status === "active"
      ? "success"
      : sub?.status === "trialing"
        ? "info"
        : sub?.status === "past_due"
          ? "warning"
          : "default";

  return (
    <div className="max-w-xl space-y-4">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Current Plan
          </h2>
          {sub && (
            <Badge variant={statusVariant as "success" | "warning" | "default"}>
              {sub.status}
            </Badge>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[var(--color-text-secondary)]">Plan</span>
            <span className="text-[var(--color-text-primary)] font-medium">
              {sub?.plan_name || "Free"}
            </span>
          </div>

          {sub?.current_period_end && (
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">
                {sub.status === "canceled" ? "Access until" : "Next billing date"}
              </span>
              <span className="text-[var(--color-text-primary)]">
                {new Date(sub.current_period_end).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
      </Card>

      <Card className="p-4 space-y-3">
        {sub?.plan_id === "free" ? (
          <>
            <p className="text-sm text-[var(--color-text-muted)]">
              Upgrade to Pro for X API sync, unlimited AI generations, scheduling, and more.
            </p>
            <a
              href="/pricing"
              className="inline-block px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black rounded text-sm font-medium transition"
            >
              View Plans
            </a>
          </>
        ) : sub?.has_billing ? (
          <>
            <p className="text-sm text-[var(--color-text-muted)]">
              Manage your subscription, update payment method, or cancel.
            </p>
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="px-4 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] rounded text-sm transition disabled:opacity-50"
            >
              {portalLoading ? "Opening..." : "Manage Billing"}
            </button>
          </>
        ) : (
          <p className="text-sm text-[var(--color-text-muted)]">
            No billing information on file.
          </p>
        )}
      </Card>
    </div>
  );
}
