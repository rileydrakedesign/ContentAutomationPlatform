"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { VoiceReport, type VoiceReportData } from "@/components/insights/VoiceReport";
import { VoiceCheckResult } from "@/components/create/VoiceCheckResult";
import type { VoiceCheckResult as VoiceCheckResultData } from "@/components/create/useVoiceCheck";
import { parseGateError } from "@/lib/utils/gate-error";
import { usePersistentState } from "@/hooks/usePersistentState";
import {
  Users,
  Plus,
  Upload,
  Sparkles,
  AudioLines,
  ShieldCheck,
  Pencil,
  Trash2,
  Check,
  Tag,
  AtSign,
  ChevronRight,
} from "lucide-react";

interface AgencyClient {
  id: string;
  client_name: string;
  client_handle: string | null;
  approval_required: boolean;
  white_label: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface CsvSummary {
  data?: unknown;
  summary?: { imported?: number; posts?: number; [key: string]: unknown } | string | null;
}

/** Friendly message for a non-OK response — plan-gate aware. */
async function readError(res: Response, fallback: string): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  const gate = parseGateError(res.status, data);
  if (gate) return gate.message;
  return (data.error as string) || fallback;
}

function handleLabel(handle: string | null): string | null {
  if (!handle) return null;
  return handle.startsWith("@") ? handle : `@${handle}`;
}

export function AgencyClientsPage() {
  const [clients, setClients] = useState<AgencyClient[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  // Persist which client the agency was viewing across navigation (#8);
  // re-validated against the freshly-loaded list below (falls back if removed).
  const [selectedId, setSelectedId] = usePersistentState<string | null>("agency:selectedId", null);

  // Add-client form
  const [newName, setNewName] = useState("");
  const [newHandle, setNewHandle] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  async function loadClients(selectAfter?: string) {
    setLoadingList(true);
    setListError(null);
    try {
      const res = await fetch("/api/agency/clients");
      if (!res.ok) {
        setListError(await readError(res, "Failed to load clients"));
        return;
      }
      const data = (await res.json()) as { clients?: AgencyClient[] };
      const list = Array.isArray(data.clients) ? data.clients : [];
      setClients(list);
      if (selectAfter) {
        setSelectedId(selectAfter);
      } else if (list.length > 0 && !list.some((c) => c.id === selectedId)) {
        setSelectedId((prev) => prev ?? list[0].id);
      }
    } catch (err) {
      setListError(err instanceof Error ? err.message : "Failed to load clients");
    } finally {
      setLoadingList(false);
    }
  }

  useEffect(() => {
    loadClients();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addClient() {
    if (!newName.trim()) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch("/api/agency/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_name: newName.trim(),
          client_handle: newHandle.trim() || undefined,
        }),
      });
      if (!res.ok) {
        setAddError(await readError(res, "Failed to add client"));
        return;
      }
      const data = (await res.json()) as { client?: AgencyClient };
      setNewName("");
      setNewHandle("");
      await loadClients(data.client?.id);
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add client");
    } finally {
      setAdding(false);
    }
  }

  /** Update one client in local state after a PATCH so the roster stays in sync. */
  function upsertClient(updated: AgencyClient) {
    setClients((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

  async function removeClient(id: string) {
    setClients((prev) => prev.filter((c) => c.id !== id));
    setSelectedId((prev) => {
      if (prev !== id) return prev;
      const remaining = clients.filter((c) => c.id !== id);
      return remaining.length > 0 ? remaining[0].id : null;
    });
  }

  const selected = clients.find((c) => c.id === selectedId) || null;

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-heading text-2xl font-semibold text-[var(--color-text-primary)]">
          Clients
        </h1>
        <p className="text-[var(--color-text-secondary)] text-sm mt-1">
          Tune and manage an isolated voice for each client — their voices never bleed.
        </p>
      </div>

      {listError && (
        <Card className="border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5">
          <CardContent className="py-3">
            <p className="text-sm text-[var(--color-danger-400)]">{listError}</p>
          </CardContent>
        </Card>
      )}

      {/* Empty state — no clients yet */}
      {!loadingList && clients.length === 0 && !listError ? (
        <EmptyState
          name={newName}
          handle={newHandle}
          adding={adding}
          error={addError}
          onName={setNewName}
          onHandle={setNewHandle}
          onAdd={addClient}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
          {/* Roster */}
          <div className="space-y-4">
            <Roster
              clients={clients}
              loading={loadingList}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />
            <AddClientForm
              name={newName}
              handle={newHandle}
              adding={adding}
              error={addError}
              onName={setNewName}
              onHandle={setNewHandle}
              onAdd={addClient}
            />
          </div>

          {/* Detail pane */}
          <div>
            {selected ? (
              <ClientDetail
                key={selected.id}
                client={selected}
                onPatched={upsertClient}
                onDeleted={removeClient}
              />
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-sm text-[var(--color-text-muted)]">
                    Select a client to tune their isolated voice.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------- */
/* Roster                                                                       */
/* ---------------------------------------------------------------------------- */

function Roster({
  clients,
  loading,
  selectedId,
  onSelect,
}: {
  clients: AgencyClient[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-1.5">
        <div className="flex items-center gap-2 mb-2 px-1">
          <Users className="w-4 h-4 text-[var(--color-primary-400)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Roster</h3>
          <span className="text-xs text-[var(--color-text-muted)] ml-auto">{clients.length}</span>
        </div>

        {loading && clients.length === 0 ? (
          <div className="space-y-2">
            <div className="h-12 skeleton rounded-xl" />
            <div className="h-12 skeleton rounded-xl" />
          </div>
        ) : (
          clients.map((c) => {
            const isActive = c.id === selectedId;
            return (
              <button
                key={c.id}
                onClick={() => onSelect(c.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-colors ${
                  isActive
                    ? "border-[var(--color-primary-500)] bg-[var(--color-primary-500)]/10"
                    : "border-[var(--color-border-subtle)] bg-[var(--color-bg-elevated)] hover:border-[var(--color-border-default)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                      {c.client_name}
                    </p>
                    {handleLabel(c.client_handle) && (
                      <p className="text-xs text-[var(--color-text-muted)] truncate">
                        {handleLabel(c.client_handle)}
                      </p>
                    )}
                  </div>
                  {c.approval_required && (
                    <Badge variant="warning" size="sm">
                      Approval
                    </Badge>
                  )}
                  <ChevronRight
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-[var(--color-primary-400)]" : "text-[var(--color-text-muted)]"
                    }`}
                  />
                </div>
              </button>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------------------- */
/* Add-client form (roster + empty state share it)                             */
/* ---------------------------------------------------------------------------- */

function AddClientForm({
  name,
  handle,
  adding,
  error,
  onName,
  onHandle,
  onAdd,
}: {
  name: string;
  handle: string;
  adding: boolean;
  error: string | null;
  onName: (v: string) => void;
  onHandle: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-2.5">
        <div className="flex items-center gap-2">
          <Plus className="w-4 h-4 text-[var(--color-success-400)]" />
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Add client</h3>
        </div>
        <input
          value={name}
          onChange={(e) => onName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAdd()}
          placeholder="Client name"
          className="w-full h-9 px-3 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-500)]"
        />
        <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3">
          <AtSign className="w-4 h-4 text-[var(--color-text-muted)]" />
          <input
            value={handle}
            onChange={(e) => onHandle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onAdd()}
            placeholder="handle (optional)"
            className="flex-1 bg-transparent py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none"
          />
        </div>
        {error && <p className="text-xs text-[var(--color-danger-400)]">{error}</p>}
        <Button
          onClick={onAdd}
          loading={adding}
          disabled={!name.trim()}
          fullWidth
          size="sm"
          icon={<Plus className="w-4 h-4" />}
        >
          Add client
        </Button>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------------------- */
/* Empty state                                                                  */
/* ---------------------------------------------------------------------------- */

function EmptyState({
  name,
  handle,
  adding,
  error,
  onName,
  onHandle,
  onAdd,
}: {
  name: string;
  handle: string;
  adding: boolean;
  error: string | null;
  onName: (v: string) => void;
  onHandle: (v: string) => void;
  onAdd: () => void;
}) {
  return (
    <Card>
      <CardContent className="max-w-xl mx-auto py-8 space-y-5 text-center">
        <div className="w-12 h-12 rounded-xl bg-[var(--color-primary-500)]/10 flex items-center justify-center mx-auto">
          <Users className="w-6 h-6 text-[var(--color-primary-400)]" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-heading text-lg font-semibold text-[var(--color-text-primary)]">
            Add your first client
          </h2>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Each client gets a fully isolated voice — their own niche, patterns, and examples.
            Import their X analytics, run a tune-up, and write in their voice. One client&apos;s
            voice never bleeds into another&apos;s.
          </p>
        </div>
        <div className="text-left">
          <AddClientForm
            name={name}
            handle={handle}
            adding={adding}
            error={error}
            onName={onName}
            onHandle={onHandle}
            onAdd={onAdd}
          />
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------------------------------------------------------------------- */
/* Detail pane                                                                  */
/* ---------------------------------------------------------------------------- */

function ClientDetail({
  client,
  onPatched,
  onDeleted,
}: {
  client: AgencyClient;
  onPatched: (c: AgencyClient) => void;
  onDeleted: (id: string) => void;
}) {
  // Header edit
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(client.client_name);
  const [editHandle, setEditHandle] = useState(client.client_handle || "");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [headerBusy, setHeaderBusy] = useState(false);
  const [headerError, setHeaderError] = useState<string | null>(null);

  // CSV import
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvSummary, setCsvSummary] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  // Tune-up — persist the loaded report per client so it survives navigation (#8).
  const [tuneBusy, setTuneBusy] = useState(false);
  const [report, setReport] = usePersistentState<VoiceReportData | null>(
    `agency:report:${client.id}`,
    null
  );
  const [tuneError, setTuneError] = useState<string | null>(null);

  // Voice check
  const [checkText, setCheckText] = useState("");
  const [checkedText, setCheckedText] = useState<string | null>(null);
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkResult, setCheckResult] = useState<VoiceCheckResultData | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);

  // White-label
  const [brandName, setBrandName] = useState(
    typeof client.white_label?.brand_name === "string"
      ? (client.white_label.brand_name as string)
      : ""
  );
  const [brandBusy, setBrandBusy] = useState(false);
  const [brandSaved, setBrandSaved] = useState(false);

  async function patch(body: Record<string, unknown>): Promise<AgencyClient | null> {
    const res = await fetch(`/api/agency/clients/${client.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await readError(res, "Update failed"));
    const data = (await res.json()) as { client?: AgencyClient };
    if (data.client) onPatched(data.client);
    return data.client ?? null;
  }

  async function saveHeader() {
    setHeaderBusy(true);
    setHeaderError(null);
    try {
      await patch({
        client_name: editName.trim() || client.client_name,
        client_handle: editHandle.trim() || null,
      });
      setEditing(false);
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setHeaderBusy(false);
    }
  }

  async function toggleApproval() {
    setHeaderError(null);
    try {
      await patch({ approval_required: !client.approval_required });
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function deleteClient() {
    setHeaderBusy(true);
    setHeaderError(null);
    try {
      const res = await fetch(`/api/agency/clients/${client.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, "Delete failed"));
      onDeleted(client.id);
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : "Delete failed");
      setHeaderBusy(false);
    }
  }

  async function uploadCsv(file: File) {
    setCsvBusy(true);
    setCsvError(null);
    setCsvSummary(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/agency/clients/${client.id}/csv`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        setCsvError(await readError(res, "CSV import failed"));
        return;
      }
      const data = (await res.json()) as CsvSummary;
      setCsvSummary(summarizeCsv(data));
    } catch (err) {
      setCsvError(err instanceof Error ? err.message : "CSV import failed");
    } finally {
      setCsvBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function runTuneup() {
    setTuneBusy(true);
    setTuneError(null);
    try {
      const res = await fetch(`/api/agency/clients/${client.id}/tuneup`, { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        report?: VoiceReportData;
        error?: string;
      };
      if (!res.ok) {
        const gate = parseGateError(res.status, data as Record<string, unknown>);
        setTuneError(gate ? gate.message : data.error || "Tune-up failed");
        return;
      }
      if (data.report) {
        setReport(data.report);
      } else if (data.error) {
        setTuneError(data.error);
      } else {
        setTuneError("Tune-up returned no report. Import this client's CSV first.");
      }
    } catch (err) {
      setTuneError(err instanceof Error ? err.message : "Tune-up failed");
    } finally {
      setTuneBusy(false);
    }
  }

  async function runCheck() {
    if (!checkText.trim()) return;
    setCheckBusy(true);
    setCheckError(null);
    try {
      const res = await fetch(`/api/agency/clients/${client.id}/check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: checkText, voice_type: "post" }),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const gate = parseGateError(res.status, data);
        setCheckError(gate ? gate.message : (data.error as string) || "Voice check failed");
        return;
      }
      setCheckResult(data as unknown as VoiceCheckResultData);
      setCheckedText(checkText);
    } catch (err) {
      setCheckError(err instanceof Error ? err.message : "Voice check failed");
    } finally {
      setCheckBusy(false);
    }
  }

  async function saveBrand() {
    setBrandBusy(true);
    setBrandSaved(false);
    try {
      await patch({ white_label: { ...client.white_label, brand_name: brandName.trim() } });
      setBrandSaved(true);
      setTimeout(() => setBrandSaved(false), 2000);
    } catch (err) {
      setHeaderError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBrandBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card selected>
        <CardContent className="space-y-3">
          {editing ? (
            <div className="space-y-2.5">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Client name"
                className="w-full h-9 px-3 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] focus:outline-none focus:border-[var(--color-primary-500)]"
              />
              <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-elevated)] px-3">
                <AtSign className="w-4 h-4 text-[var(--color-text-muted)]" />
                <input
                  value={editHandle}
                  onChange={(e) => setEditHandle(e.target.value)}
                  placeholder="handle (optional)"
                  className="flex-1 bg-transparent py-2 text-sm text-[var(--color-text-primary)] focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={saveHeader}
                  loading={headerBusy}
                  icon={<Check className="w-4 h-4" />}
                >
                  Save
                </Button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditName(client.client_name);
                    setEditHandle(client.client_handle || "");
                  }}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                >
                  cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-heading text-lg font-semibold text-[var(--color-text-primary)] truncate">
                  {client.client_name}
                </h2>
                {handleLabel(client.client_handle) && (
                  <p className="text-sm text-[var(--color-text-muted)]">
                    {handleLabel(client.client_handle)}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 rounded-lg hover:bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
                  title="Rename"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="p-2 rounded-lg hover:bg-[var(--color-danger-500)]/10 text-[var(--color-text-muted)] hover:text-[var(--color-danger-400)] transition-colors"
                  title="Delete client"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Approval toggle */}
          <div className="flex items-center justify-between pt-2 border-t border-[var(--color-border-subtle)]">
            <div>
              <p className="text-sm font-medium text-[var(--color-text-primary)]">
                Approval required
              </p>
              <p className="text-xs text-[var(--color-text-muted)]">
                Hold this client&apos;s posts for review before they publish.
              </p>
            </div>
            <button
              onClick={toggleApproval}
              role="switch"
              aria-checked={client.approval_required}
              className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${
                client.approval_required
                  ? "bg-[var(--color-primary-500)]"
                  : "bg-[var(--color-bg-hover)] border border-[var(--color-border-default)]"
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                  client.approval_required ? "translate-x-5" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>

          {headerError && <p className="text-xs text-[var(--color-danger-400)]">{headerError}</p>}

          {confirmDelete && (
            <div className="rounded-xl border border-[var(--color-danger-500)]/30 bg-[var(--color-danger-500)]/5 p-3 space-y-2">
              <p className="text-sm text-[var(--color-text-primary)]">
                Delete <span className="font-semibold">{client.client_name}</span> and their
                isolated voice? This can&apos;t be undone.
              </p>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="danger" onClick={deleteClient} loading={headerBusy}>
                  Delete
                </Button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]"
                >
                  cancel
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Isolation note */}
      <div className="flex items-start gap-2.5 rounded-xl border border-[var(--color-success-500)]/25 bg-[var(--color-success-500)]/5 px-4 py-3">
        <ShieldCheck className="w-4 h-4 text-[var(--color-success-400)] shrink-0 mt-0.5" />
        <p className="text-xs text-[var(--color-text-secondary)]">
          <span className="font-semibold text-[var(--color-text-primary)]">
            Fully isolated voice.
          </span>{" "}
          Everything below — the imported analytics, the tune-up, the patterns, and the voice
          check — applies only to <span className="font-medium">{client.client_name}</span>. No
          other client&apos;s voice is mixed in.
        </p>
      </div>

      {/* Onboard voice — CSV + tune-up */}
      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
              <Upload className="w-4 h-4 text-[var(--color-primary-400)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Onboard this client&apos;s voice
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Import their X analytics, then tune their isolated voice.
              </p>
            </div>
          </div>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) uploadCsv(file);
            }}
          />

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => fileRef.current?.click()}
              loading={csvBusy}
              icon={<Upload className="w-4 h-4" />}
            >
              Import this client&apos;s X analytics CSV
            </Button>
            <Button
              size="sm"
              onClick={runTuneup}
              loading={tuneBusy}
              icon={<Sparkles className="w-4 h-4" />}
            >
              {tuneBusy ? "Tuning voice…" : "Run Voice Tune-Up"}
            </Button>
          </div>

          {csvSummary && (
            <div className="flex items-center gap-2 rounded-xl border border-[var(--color-success-500)]/25 bg-[var(--color-success-500)]/5 px-3 py-2">
              <Check className="w-4 h-4 text-[var(--color-success-400)] shrink-0" />
              <p className="text-xs text-[var(--color-text-secondary)]">{csvSummary}</p>
            </div>
          )}
          {csvError && <p className="text-xs text-[var(--color-danger-400)]">{csvError}</p>}

          {tuneError && (
            <div className="rounded-xl border border-[var(--color-warning-500)]/30 bg-[var(--color-warning-500)]/5 px-3 py-2.5">
              <p className="text-xs text-[var(--color-text-secondary)]">
                {tuneError}{" "}
                <span className="text-[var(--color-text-muted)]">
                  Import this client&apos;s analytics CSV above, then run the tune-up again.
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Per-client Voice Report */}
      {report && <VoiceReport report={report} />}

      {/* Voice check in this client's voice */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-primary-500)]/10 flex items-center justify-center">
              <AudioLines className="w-4 h-4 text-[var(--color-primary-400)]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
                Voice-check in {client.client_name}&apos;s voice
              </h3>
              <p className="text-xs text-[var(--color-text-muted)]">
                Score a draft against this client&apos;s tuned voice — not yours.
              </p>
            </div>
          </div>

          <textarea
            value={checkText}
            onChange={(e) => setCheckText(e.target.value)}
            placeholder={`Paste a draft to score against ${client.client_name}'s voice…`}
            className="w-full min-h-[110px] bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-xl px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-500)] resize-y"
          />

          {checkError && <p className="text-xs text-[var(--color-danger-400)]">{checkError}</p>}

          <Button
            size="sm"
            onClick={runCheck}
            loading={checkBusy}
            disabled={!checkText.trim()}
            icon={<AudioLines className="w-4 h-4" />}
          >
            Voice check
          </Button>

          {checkResult && (
            <VoiceCheckResult
              result={checkResult}
              currentText={checkText}
              checkedText={checkedText}
              onApplyEdit={setCheckText}
            />
          )}
        </CardContent>
      </Card>

      {/* White-label */}
      <Card>
        <CardContent className="space-y-2.5">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-[var(--color-accent-400)]" />
            <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">White-label</h3>
          </div>
          <p className="text-xs text-[var(--color-text-muted)]">
            Brand this client&apos;s shared Voice Report with their own name instead of yours.
          </p>
          <div className="flex items-center gap-2">
            <input
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && saveBrand()}
              placeholder="Brand name"
              className="flex-1 h-9 px-3 text-sm bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] rounded-lg text-[var(--color-text-primary)] placeholder:text-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-primary-500)]"
            />
            <Button
              size="sm"
              variant="secondary"
              onClick={saveBrand}
              loading={brandBusy}
              icon={brandSaved ? <Check className="w-4 h-4 text-[var(--color-success-400)]" /> : undefined}
            >
              {brandSaved ? "Saved" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Coerce the CSV endpoint's loosely-typed summary into a one-line message. */
function summarizeCsv(data: CsvSummary): string {
  const s = data.summary;
  if (typeof s === "string" && s.trim()) return s;
  if (s && typeof s === "object") {
    const n = s.imported ?? s.posts;
    if (typeof n === "number") return `Imported ${n} posts.`;
    const entries = Object.entries(s)
      .filter(([, v]) => typeof v === "number" || typeof v === "string")
      .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`);
    if (entries.length > 0) return entries.join(" · ");
  }
  return "CSV imported.";
}
