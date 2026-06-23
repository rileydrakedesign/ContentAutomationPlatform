import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAuthClient, createAdminClient } from "@/lib/supabase/server";
import { requireFeature } from "@/lib/stripe/gate";
import { corsHeaders } from "@/lib/cors";
import { getClientForAgency, type AgencyClient } from "./clients";

interface AgencyContext {
  userId: string;
  authClient: SupabaseClient;
}

/**
 * Gate: authenticated + on a plan with multiAccount (Agency tier). Returns a
 * NextResponse on failure, otherwise the agency context.
 */
export async function requireAgency(): Promise<NextResponse | AgencyContext> {
  const authClient = await createAuthClient();
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();
  if (!user || error) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401, headers: corsHeaders });
  }
  const gate = await requireFeature(user.id, "multiAccount");
  if (gate) return gate;
  return { userId: user.id, authClient: authClient as unknown as SupabaseClient };
}

interface ClientContext extends AgencyContext {
  client: AgencyClient;
  /** Service-role client for the client's isolated data island (keyed by client.id). */
  admin: SupabaseClient;
}

/**
 * Gate + ownership: requires the Agency tier AND that the agency owns this
 * client (ownership confirmed via the agency_clients RLS policy). Returns an
 * admin client for the client's data island only after ownership is proven.
 */
export async function requireClient(clientId: string): Promise<NextResponse | ClientContext> {
  const ctx = await requireAgency();
  if (ctx instanceof NextResponse) return ctx;

  const client = await getClientForAgency(ctx.authClient, clientId);
  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404, headers: corsHeaders });
  }
  return { ...ctx, client, admin: createAdminClient() };
}
