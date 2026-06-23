/**
 * Agency multi-account (Gap #2). An agency user owns N **client profiles**, each
 * a fully isolated voice data-island: the client's voice settings, examples,
 * patterns, niche, analytics, and drafts live in the existing per-user tables
 * keyed by the client's id (`agency_clients.id`) — so clients' voices can never
 * bleed, and the entire single-account engine (assembler, voice-check, tune-up)
 * is reused unchanged.
 *
 * Security: the agency's JWT is NOT the client's id, so client data is only ever
 * touched through the service-role admin client AFTER `getClientForAgency`
 * confirms ownership (which itself relies on the agency_clients RLS policy).
 * The existing single-account routes and their RLS are never modified.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export interface AgencyClient {
  id: string;
  client_name: string;
  client_handle: string | null;
  approval_required: boolean;
  white_label: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const CLIENT_COLUMNS =
  "id, client_name, client_handle, approval_required, white_label, created_at, updated_at";

export async function listAgencyClients(
  authClient: SupabaseClient,
  agencyUserId: string
): Promise<AgencyClient[]> {
  const { data } = await authClient
    .from("agency_clients")
    .select(CLIENT_COLUMNS)
    .eq("agency_user_id", agencyUserId)
    .order("created_at", { ascending: true });
  return (data as AgencyClient[]) ?? [];
}

export async function createAgencyClient(
  authClient: SupabaseClient,
  agencyUserId: string,
  input: { client_name: string; client_handle?: string | null; approval_required?: boolean }
): Promise<AgencyClient | null> {
  const handle = (input.client_handle || "").replace(/^@/, "").trim() || null;
  const { data, error } = await authClient
    .from("agency_clients")
    .insert({
      agency_user_id: agencyUserId,
      client_name: input.client_name.trim(),
      client_handle: handle,
      approval_required: input.approval_required ?? false,
    })
    .select(CLIENT_COLUMNS)
    .single();
  if (error) throw error;
  return (data as AgencyClient) ?? null;
}

/**
 * The ownership choke point. Returns the client row ONLY if the agency owns it
 * (enforced by the agency_clients RLS policy on the auth-scoped client). Every
 * client-scoped data operation must call this first.
 */
export async function getClientForAgency(
  authClient: SupabaseClient,
  clientId: string
): Promise<AgencyClient | null> {
  const { data } = await authClient
    .from("agency_clients")
    .select(CLIENT_COLUMNS)
    .eq("id", clientId)
    .maybeSingle();
  return (data as AgencyClient) ?? null;
}

export async function updateAgencyClient(
  authClient: SupabaseClient,
  clientId: string,
  fields: Partial<Pick<AgencyClient, "client_name" | "client_handle" | "approval_required" | "white_label">>
): Promise<AgencyClient | null> {
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (fields.client_name !== undefined) patch.client_name = fields.client_name.trim();
  if (fields.client_handle !== undefined)
    patch.client_handle = (fields.client_handle || "").replace(/^@/, "").trim() || null;
  if (fields.approval_required !== undefined) patch.approval_required = fields.approval_required;
  if (fields.white_label !== undefined) patch.white_label = fields.white_label;

  const { data } = await authClient
    .from("agency_clients")
    .update(patch)
    .eq("id", clientId)
    .select(CLIENT_COLUMNS)
    .maybeSingle();
  return (data as AgencyClient) ?? null;
}

/**
 * Delete the client and purge its isolated data island (admin client — the data
 * is keyed by the client id, not the agency's auth id). Caller must have
 * verified ownership via getClientForAgency first.
 */
export async function deleteAgencyClientData(
  authClient: SupabaseClient,
  admin: SupabaseClient,
  clientId: string
): Promise<void> {
  const ISLAND_TABLES = [
    "user_voice_settings",
    "user_voice_examples",
    "extracted_patterns",
    "user_niche_profile",
    "user_analytics",
    "content_strategy",
    "voice_check_results",
    "generation_feedback",
    "drafts",
  ];
  for (const table of ISLAND_TABLES) {
    await admin.from(table).delete().eq("user_id", clientId);
  }
  await authClient.from("agency_clients").delete().eq("id", clientId);
}
