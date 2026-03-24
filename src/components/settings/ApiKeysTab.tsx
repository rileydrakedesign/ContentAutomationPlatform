"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatRelativeTime } from "@/lib/utils/formatting";
import { ALLOWED_SCOPES } from "@/lib/api/scopes";
import { Key, Copy, Check, Plus } from "lucide-react";

interface ApiKey {
  id: string;
  key_prefix: string;
  name: string;
  scopes: string[];
  rate_limit: number;
  last_used_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

const SCOPE_GROUPS: Record<string, string[]> = {
  Drafts: ["drafts:read", "drafts:write", "drafts:generate"],
  Publishing: ["publish:read", "publish:write"],
  Analytics: ["analytics:read"],
  Voice: ["voice:read", "voice:write"],
  Strategy: ["strategy:read", "strategy:write"],
};

export function ApiKeysTab() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKeyRaw, setNewKeyRaw] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formScopes, setFormScopes] = useState<string[]>([]);

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/api-keys");
      if (res.ok) {
        setKeys(await res.json());
      }
    } catch (err) {
      console.error("Failed to fetch API keys:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  async function createKey() {
    if (!formName.trim() || formScopes.length === 0) return;
    setCreating(true);

    try {
      const res = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: formName.trim(), scopes: formScopes }),
      });

      if (res.ok) {
        const data = await res.json();
        setNewKeyRaw(data.key);
        setShowCreateForm(false);
        setFormName("");
        setFormScopes([]);
        await fetchKeys();
      }
    } catch (err) {
      console.error("Failed to create API key:", err);
    } finally {
      setCreating(false);
    }
  }

  async function revokeKey(id: string) {
    if (!confirm("Revoke this API key? This cannot be undone.")) return;

    try {
      const res = await fetch(`/api/settings/api-keys/${id}`, { method: "DELETE" });
      if (res.ok) {
        await fetchKeys();
      }
    } catch (err) {
      console.error("Failed to revoke key:", err);
    }
  }

  function toggleScope(scope: string) {
    setFormScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  }

  function selectAllScopes() {
    setFormScopes([...ALLOWED_SCOPES]);
  }

  function deselectAllScopes() {
    setFormScopes([]);
  }

  async function copyKey() {
    if (!newKeyRaw) return;
    await navigator.clipboard.writeText(newKeyRaw);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return <div className="text-[var(--color-text-muted)]">Loading API keys...</div>;
  }

  return (
    <div className="max-w-xl space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">API Keys</h2>
          <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
            Create keys to access your content via the API
          </p>
        </div>
        {!showCreateForm && !newKeyRaw && (
          <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={() => setShowCreateForm(true)}>
            Create Key
          </Button>
        )}
      </div>

      {/* One-time key display */}
      {newKeyRaw && (
        <Card className="border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/5">
          <CardContent>
            <div className="flex items-start gap-2 mb-3">
              <Key className="w-4 h-4 text-[var(--color-warning-400)] mt-0.5 shrink-0" />
              <p className="text-sm text-[var(--color-warning-400)]">
                Copy this key now — it won&apos;t be shown again.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <code className="flex-1 p-2.5 bg-[var(--color-bg-base)] rounded-lg text-xs font-mono text-[var(--color-text-primary)] break-all border border-[var(--color-border-default)]">
                {newKeyRaw}
              </code>
              <Button size="sm" variant="secondary" onClick={copyKey}>
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </Button>
            </div>
            <div className="mt-3 flex justify-end">
              <Button size="sm" variant="ghost" onClick={() => setNewKeyRaw(null)}>
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create form */}
      {showCreateForm && (
        <Card>
          <CardContent className="space-y-4">
            <Input
              label="Key Name"
              placeholder="My agent key"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
            />

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-[var(--color-text-secondary)]">
                  Scopes
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={selectAllScopes}
                    className="text-xs text-[var(--color-primary-400)] hover:text-[var(--color-primary-300)] cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-xs text-[var(--color-text-muted)]">·</span>
                  <button
                    type="button"
                    onClick={deselectAllScopes}
                    className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(SCOPE_GROUPS).map(([group, scopes]) => (
                  <div key={group}>
                    <p className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5 uppercase tracking-wide">
                      {group}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {scopes.map((scope) => (
                        <label
                          key={scope}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs cursor-pointer transition-all border ${
                            formScopes.includes(scope)
                              ? "bg-[var(--color-primary-500)]/10 border-[var(--color-primary-500)]/30 text-[var(--color-primary-400)]"
                              : "bg-[var(--color-bg-elevated)] border-[var(--color-border-default)] text-[var(--color-text-muted)] hover:border-[var(--color-border-strong)]"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={formScopes.includes(scope)}
                            onChange={() => toggleScope(scope)}
                            className="sr-only"
                          />
                          {scope}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setShowCreateForm(false);
                  setFormName("");
                  setFormScopes([]);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={createKey}
                loading={creating}
                disabled={!formName.trim() || formScopes.length === 0}
              >
                Create Key
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Key list */}
      {keys.length === 0 && !showCreateForm && !newKeyRaw ? (
        <Card>
          <CardContent>
            <div className="text-center py-6">
              <Key className="w-8 h-8 text-[var(--color-text-muted)] mx-auto mb-2" />
              <p className="text-sm text-[var(--color-text-muted)]">
                No API keys yet. Create one to enable agent access.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        keys.map((key) => {
          const isRevoked = !!key.revoked_at;
          return (
            <Card
              key={key.id}
              className={isRevoked ? "opacity-50" : ""}
            >
              <CardContent>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--color-text-primary)]">
                      {key.name}
                    </span>
                    {isRevoked && <Badge variant="danger" size="sm">Revoked</Badge>}
                  </div>
                  {!isRevoked && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => revokeKey(key.id)}
                    >
                      Revoke
                    </Button>
                  )}
                </div>

                <code className="text-xs font-mono text-[var(--color-text-muted)]">
                  {key.key_prefix}...
                </code>

                <div className="flex flex-wrap gap-1.5 mt-2">
                  {key.scopes.map((scope) => (
                    <Badge key={scope} variant="default" size="sm">
                      {scope}
                    </Badge>
                  ))}
                </div>

                <div className="flex gap-4 mt-3 text-xs text-[var(--color-text-muted)]">
                  <span>Created {formatRelativeTime(key.created_at)}</span>
                  {key.last_used_at && (
                    <span>Last used {formatRelativeTime(key.last_used_at)}</span>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })
      )}
    </div>
  );
}
