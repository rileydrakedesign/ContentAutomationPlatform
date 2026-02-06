"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils/formatting";

interface XConnectionStatus {
  connected: boolean;
  username?: string;
  userId?: string;
  lastSyncAt?: string;
  connectedAt?: string;
}

export function SettingsPage() {
  const searchParams = useSearchParams();
  const [xStatus, setXStatus] = useState<XConnectionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [savingKeys, setSavingKeys] = useState(false);
  const [byoConfigured, setByoConfigured] = useState<{
    configured: boolean;
    consumerKeyMasked?: string;
    updatedAt?: string;
  } | null>(null);
  const [consumerKey, setConsumerKey] = useState("");
  const [consumerSecret, setConsumerSecret] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Check for OAuth callback messages
  useEffect(() => {
    const success = searchParams.get("success");
    const error = searchParams.get("error");

    if (success === "connected") {
      setMessage({ type: "success", text: "X account connected successfully!" });
    } else if (error) {
      const errorMessages: Record<string, string> = {
        oauth_denied: "You denied the connection request",
        missing_params: "Missing OAuth parameters",
        invalid_state: "Invalid OAuth state - please try again",
        save_failed: "Failed to save connection",
        callback_failed: "OAuth callback failed",
        missing_byo_keys: "Add your X API key + secret first",
      };
      setMessage({ type: "error", text: errorMessages[error] || "Connection failed" });
    }
  }, [searchParams]);

  async function fetchXStatus() {
    try {
      const [xRes, byoRes] = await Promise.all([
        fetch("/api/x/status"),
        fetch("/api/x/byo/credentials"),
      ]);
      const [xData, byoData] = await Promise.all([xRes.json(), byoRes.json()]);
      setXStatus(xData);
      setByoConfigured(byoData);
    } catch (error) {
      console.error("Failed to fetch X status:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchXStatus();
  }, []);

  async function connectX() {
    setConnecting(true);
    setMessage(null);

    try {
      const res = await fetch("/api/x/byo/connect");
      const data = await res.json();

      if (data.url) {
        window.location.href = data.url;
      } else {
        setMessage({ type: "error", text: data.error || "Failed to initiate connection" });
        setConnecting(false);
      }
    } catch (error) {
      console.error("Failed to connect X:", error);
      setMessage({ type: "error", text: "Failed to connect" });
      setConnecting(false);
    }
  }

  async function disconnectX() {
    if (!confirm("Disconnect your X account? Your synced posts will remain.")) return;

    try {
      await fetch("/api/x/status", { method: "DELETE" });
      setXStatus({ connected: false });
      setMessage({ type: "success", text: "X account disconnected" });
    } catch (error) {
      console.error("Failed to disconnect X:", error);
      setMessage({ type: "error", text: "Failed to disconnect" });
    }
  }

  async function syncPosts() {
    setSyncing(true);
    setMessage(null);

    try {
      const res = await fetch("/api/x/sync", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message || "Posts synced!" });
        await fetchXStatus();
      } else {
        setMessage({ type: "error", text: data.error || "Sync failed" });
      }
    } catch (error) {
      console.error("Failed to sync:", error);
      setMessage({ type: "error", text: "Sync failed" });
    } finally {
      setSyncing(false);
    }
  }

  if (loading) {
    return <div className="text-slate-500">Loading settings...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-white">Settings</h1>
        <p className="text-slate-500 mt-1">Connect your X account and manage preferences</p>
      </div>

      {/* Status Messages */}
      {message && (
        <div
          className={`mb-4 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-teal-500/10 border border-teal-500/20 text-teal-400"
              : "bg-red-500/10 border border-red-500/20 text-red-400"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="max-w-xl space-y-4">
        {/* X API (BYO) */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">X API (Bring your own)</h2>
            {byoConfigured?.configured && <Badge variant="success">Saved</Badge>}
          </div>

          <p className="text-sm text-slate-500 mb-4">
            Paste your X app key + secret so publishing uses your own limits.
          </p>

          {byoConfigured?.configured && byoConfigured.consumerKeyMasked && (
            <div className="text-xs text-slate-500 mb-3">
              Current key: <span className="font-mono">{byoConfigured.consumerKeyMasked}</span>
              {byoConfigured.updatedAt && (
                <> · updated {formatRelativeTime(byoConfigured.updatedAt)}</>
              )}
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1">API key</label>
              <input
                value={consumerKey}
                onChange={(e) => setConsumerKey(e.target.value)}
                placeholder="Paste your X API key"
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-700"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">API secret</label>
              <input
                value={consumerSecret}
                onChange={(e) => setConsumerSecret(e.target.value)}
                placeholder="Paste your X API secret"
                type="password"
                className="w-full bg-slate-900 border border-slate-800 rounded-md px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:border-slate-700"
              />
            </div>
            <button
              onClick={async () => {
                setSavingKeys(true);
                setMessage(null);
                try {
                  const res = await fetch("/api/x/byo/credentials", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ consumerKey, consumerSecret }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    setConsumerKey("");
                    setConsumerSecret("");
                    setMessage({ type: "success", text: "X API credentials saved" });
                    await fetchXStatus();
                  } else {
                    setMessage({ type: "error", text: data.error || "Failed to save" });
                  }
                } catch {
                  setMessage({ type: "error", text: "Failed to save" });
                } finally {
                  setSavingKeys(false);
                }
              }}
              disabled={savingKeys || !consumerKey.trim() || !consumerSecret.trim()}
              className="w-full py-2.5 bg-slate-700 hover:bg-slate-600 disabled:bg-slate-800 disabled:text-slate-500 rounded text-sm transition"
            >
              {savingKeys ? "Saving..." : "Save API credentials"}
            </button>
          </div>
        </Card>

        {/* X Connection */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-white">X Account</h2>
            {xStatus?.connected && <Badge variant="success">Connected</Badge>}
          </div>

          {xStatus?.connected ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-slate-800 rounded-lg">
                <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center text-xl font-bold text-white">
                  {xStatus.username?.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-white font-medium">@{xStatus.username}</p>
                  <p className="text-sm text-slate-500">
                    Connected {xStatus.connectedAt && formatRelativeTime(xStatus.connectedAt)}
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  {xStatus.lastSyncAt
                    ? `Last synced ${formatRelativeTime(xStatus.lastSyncAt)}`
                    : "Never synced"}
                </span>
                <button
                  onClick={syncPosts}
                  disabled={syncing}
                  className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-700 rounded text-sm transition"
                >
                  {syncing ? "Syncing..." : "Sync Now"}
                </button>
              </div>

              <div className="pt-4 border-t border-slate-800">
                <button
                  onClick={disconnectX}
                  className="text-sm text-red-400 hover:text-red-300 transition"
                >
                  Disconnect X account
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-500">
                Connect your X account so we can publish and schedule posts on your behalf.
              </p>
              {!byoConfigured?.configured && (
                <p className="text-xs text-amber-400">
                  Add your X API key + secret above first.
                </p>
              )}

              <button
                onClick={connectX}
                disabled={connecting || !byoConfigured?.configured}
                className="w-full py-3 bg-white text-slate-900 font-medium rounded-lg hover:bg-slate-200 disabled:opacity-50 transition flex items-center justify-center gap-2"
              >
                {connecting ? (
                  "Connecting..."
                ) : (
                  <>
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                    Connect X Account
                  </>
                )}
              </button>
            </div>
          )}
        </Card>

        {/* How It Works */}
        <Card className="p-4">
          <h2 className="text-sm font-semibold text-white mb-4">How It Works</h2>
          <div className="space-y-3 text-sm text-slate-400">
            <div className="flex gap-3">
              <span className="text-amber-400">1.</span>
              <span>Connect your X account to sync your posts automatically</span>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-400">2.</span>
              <span>Your posts appear in the Library with engagement metrics</span>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-400">3.</span>
              <span>Promote top performers to use as inspiration for new content</span>
            </div>
            <div className="flex gap-3">
              <span className="text-amber-400">4.</span>
              <span>Use voice memos to draft new posts that match your style</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
