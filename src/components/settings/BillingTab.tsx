"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

interface SubscriptionInfo {
  plan_id: string;
  plan_name: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  has_billing: boolean;
}

interface CreditsInfo {
  plan: string;
  balance: number;
  allowance_remaining: number;
  pack_balance: number;
  monthly_allowance: number;
  resets_at: string | null;
  packs: { id: string; credits: number; price: number; available: boolean }[];
}

export function BillingTab() {
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);
  const [packLoading, setPackLoading] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/stripe/subscription")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setSub(data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));

    fetch("/api/settings/credits")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setCredits(data);
      })
      .catch(console.error);
  }, []);

  async function buyPack(packId: string) {
    setPackLoading(packId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
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
      setPackLoading(null);
    }
  }

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
                {sub.status === "canceled" || sub.cancel_at_period_end
                  ? "Access until"
                  : "Next billing date"}
              </span>
              <span className="text-[var(--color-text-primary)]">
                {new Date(sub.current_period_end).toLocaleDateString()}
              </span>
            </div>
          )}

          {sub?.cancel_at_period_end && sub.status !== "canceled" && sub.current_period_end && (
            <p className="text-xs text-[var(--color-warning-400)]">
              Your subscription will end on{" "}
              {new Date(sub.current_period_end).toLocaleDateString()}. Resume any time
              before then via Manage Billing.
            </p>
          )}
        </div>
      </Card>

      {credits && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Agent Credits
            </h2>
            <span className="text-lg font-semibold text-[var(--color-text-primary)]">
              {credits.balance.toLocaleString()}
            </span>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">
                Monthly allowance remaining
              </span>
              <span className="text-[var(--color-text-primary)]">
                {credits.allowance_remaining.toLocaleString()} /{" "}
                {credits.monthly_allowance.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Purchased credits</span>
              <span className="text-[var(--color-text-primary)]">
                {credits.pack_balance.toLocaleString()}
              </span>
            </div>
            {credits.resets_at && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--color-text-secondary)]">Allowance resets</span>
                <span className="text-[var(--color-text-primary)]">
                  {new Date(credits.resets_at).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>

          <p className="text-xs text-[var(--color-text-muted)] mt-3">
            Credits meter API &amp; MCP usage (generation, publishing, search,
            sync). In-app usage is not metered. Posts containing a link cost
            30 credits instead of 3.
          </p>

          {credits.packs.some((p) => p.available) && (
            <div className="flex gap-2 mt-4">
              {credits.packs
                .filter((p) => p.available)
                .map((p) => (
                  <button
                    key={p.id}
                    onClick={() => buyPack(p.id)}
                    disabled={packLoading !== null}
                    className="flex-1 px-3 py-2 bg-[var(--color-bg-tertiary)] hover:bg-[var(--color-bg-hover)] text-[var(--color-text-primary)] rounded text-xs transition disabled:opacity-50"
                  >
                    {packLoading === p.id
                      ? "Opening..."
                      : `+${p.credits.toLocaleString()} · $${p.price}`}
                  </button>
                ))}
            </div>
          )}
        </Card>
      )}

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

      <Card className="p-4">
        <p className="text-sm text-[var(--color-text-muted)]">
          Need help? DM{" "}
          <a
            href="https://x.com/AgentsForX"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--color-primary-400)] hover:underline"
          >
            @AgentsForX
          </a>{" "}
          on X for support.
        </p>
      </Card>
    </div>
  );
}
