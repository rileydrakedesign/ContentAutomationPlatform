"use client";

import { useState, useEffect } from "react";
import { UserSettings } from "@/types/captured";

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [handles, setHandles] = useState<string[]>([]);
  const [newHandle, setNewHandle] = useState("");

  async function fetchSettings() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      setSettings(data);
      setHandles(data.x_handles || []);
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSettings();
  }, []);

  async function saveHandles() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ x_handles: handles }),
      });
      const data = await res.json();
      setSettings(data);
      setHandles(data.x_handles || []);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  }

  function addHandle() {
    const cleaned = newHandle.replace("@", "").trim();
    if (!cleaned) return;
    if (handles.includes(cleaned)) {
      setNewHandle("");
      return;
    }
    setHandles([...handles, cleaned]);
    setNewHandle("");
  }

  function removeHandle(handle: string) {
    setHandles(handles.filter((h) => h !== handle));
  }

  if (loading) {
    return <div className="text-zinc-500">Loading settings...</div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-white">Settings</h1>
        <p className="text-zinc-500 mt-1">Configure your Content Pipeline</p>
      </div>

      <div className="max-w-xl">
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-2">
            Your X Handle(s)
          </h2>
          <p className="text-sm text-zinc-500 mb-4">
            Posts from these handles will be automatically marked as &quot;Your post&quot;
            when captured from X.
          </p>

          <div className="space-y-3 mb-4">
            {handles.map((handle) => (
              <div
                key={handle}
                className="flex items-center justify-between px-3 py-2 bg-zinc-800 rounded"
              >
                <span className="text-white">@{handle}</span>
                <button
                  onClick={() => removeHandle(handle)}
                  className="text-sm text-zinc-500 hover:text-red-400 transition"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
                @
              </span>
              <input
                type="text"
                value={newHandle}
                onChange={(e) => setNewHandle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHandle();
                  }
                }}
                placeholder="username"
                className="w-full pl-8 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
              />
            </div>
            <button
              onClick={addHandle}
              className="px-4 py-2 bg-zinc-800 text-white rounded hover:bg-zinc-700 transition"
            >
              Add
            </button>
          </div>

          <button
            onClick={saveHandles}
            disabled={saving}
            className="px-4 py-2 bg-white text-zinc-900 font-medium rounded hover:bg-zinc-200 transition disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 mt-6">
          <h2 className="text-lg font-medium text-white mb-2">
            Chrome Extension
          </h2>
          <p className="text-sm text-zinc-500 mb-4">
            Install the Chrome extension to capture X posts while browsing.
          </p>

          <div className="bg-zinc-800 rounded p-4">
            <p className="text-sm text-zinc-400 mb-2">Installation steps:</p>
            <ol className="text-sm text-zinc-500 space-y-1 list-decimal list-inside">
              <li>Download the extension from the chrome-extension folder</li>
              <li>Go to chrome://extensions</li>
              <li>Enable &quot;Developer mode&quot;</li>
              <li>Click &quot;Load unpacked&quot; and select the dist folder</li>
              <li>Log in with your account in the extension popup</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
