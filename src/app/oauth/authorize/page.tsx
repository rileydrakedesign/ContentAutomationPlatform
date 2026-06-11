import { redirect } from "next/navigation";
import { createAuthClient } from "@/lib/supabase/server";
import {
  getClient,
  isValidRedirectUri,
  resolveScopes,
  createAuthorizationCode,
} from "@/lib/oauth/server";

export const dynamic = "force-dynamic";

const SCOPE_LABELS: Record<string, string> = {
  "drafts:read": "Read your drafts",
  "drafts:write": "Create and edit drafts",
  "drafts:generate": "Generate posts and replies in your voice",
  "publish:read": "See your scheduled posts",
  "publish:write": "Publish and schedule posts to X",
  "analytics:read": "Read your analytics and tweets",
  "voice:read": "Read your voice settings",
  "voice:write": "Update your voice settings",
  "strategy:read": "Read your content strategy",
  "strategy:write": "Update your content strategy",
  "patterns:read": "Read your growth patterns",
  "patterns:write": "Enable/disable growth patterns",
  "inspiration:read": "Read your inspiration library",
  "inspiration:write": "Save inspiration posts",
  "niche:read": "Read your niche profile",
  "search:read": "Search recent tweets",
};

interface AuthorizeParams {
  client_id?: string;
  redirect_uri?: string;
  response_type?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  resource?: string;
}

function errorCard(title: string, detail: string) {
  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl p-6">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-2">{title}</h1>
        <p className="text-sm text-[var(--color-text-muted)]">{detail}</p>
      </div>
    </div>
  );
}

export default async function AuthorizePage({
  searchParams,
}: {
  searchParams: Promise<AuthorizeParams>;
}) {
  const params = await searchParams;
  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    code_challenge: codeChallenge,
    resource,
  } = params;

  // client_id + redirect_uri must validate BEFORE any redirect — redirecting
  // errors to an unverified URI would be an open redirect.
  if (!clientId || !redirectUri) {
    return errorCard("Invalid request", "Missing client_id or redirect_uri.");
  }
  const client = await getClient(clientId);
  if (!client) {
    return errorCard("Unknown client", "This client_id is not registered.");
  }
  if (!isValidRedirectUri(client, redirectUri)) {
    return errorCard(
      "Invalid redirect URI",
      "The redirect_uri does not match this client's registration."
    );
  }

  const fail = (error: string, description: string) => {
    const u = new URL(redirectUri);
    u.searchParams.set("error", error);
    u.searchParams.set("error_description", description);
    if (state) u.searchParams.set("state", state);
    redirect(u.toString());
  };

  if (params.response_type !== "code") {
    fail("unsupported_response_type", "Only response_type=code is supported");
  }
  if (!codeChallenge || (params.code_challenge_method ?? "S256") !== "S256") {
    fail("invalid_request", "PKCE with code_challenge_method=S256 is required");
  }

  const supabase = await createAuthClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const here = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]
    );
    redirect(`/login?next=${encodeURIComponent(`/oauth/authorize?${here}`)}`);
  }

  const scopes = resolveScopes(params.scope);
  const clientName = client.client_name || "An MCP client";

  async function decide(formData: FormData) {
    "use server";

    const decision = formData.get("decision");

    // Re-validate everything server-side — hidden fields are attacker input.
    const client = await getClient(clientId!);
    if (!client || !isValidRedirectUri(client, redirectUri!)) {
      throw new Error("Client validation failed");
    }

    const u = new URL(redirectUri!);
    if (state) u.searchParams.set("state", state);

    if (decision !== "approve") {
      u.searchParams.set("error", "access_denied");
      u.searchParams.set("error_description", "The user denied the request");
      redirect(u.toString());
    }

    const supabase = await createAuthClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      redirect(`/login?next=${encodeURIComponent("/oauth/authorize")}`);
    }

    const code = await createAuthorizationCode({
      clientId: clientId!,
      userId: user!.id,
      scopes,
      redirectUri: redirectUri!,
      codeChallenge: codeChallenge!,
      resource,
    });

    u.searchParams.set("code", code);
    redirect(u.toString());
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="w-full max-w-md bg-[var(--color-bg-surface)] border border-[var(--color-border-default)] rounded-xl p-6">
        <h1 className="text-xl font-semibold text-[var(--color-text-primary)] mb-1">
          Connect {clientName}
        </h1>
        <p className="text-sm text-[var(--color-text-muted)] mb-4">
          <span className="font-medium text-[var(--color-text-secondary)]">{clientName}</span>{" "}
          wants to access your Agents For X account ({user!.email}). Actions it
          takes will use your plan&apos;s credits.
        </p>

        <ul className="space-y-1.5 mb-6">
          {scopes.map((s) => (
            <li
              key={s}
              className="text-sm text-[var(--color-text-secondary)] flex items-start gap-2"
            >
              <span className="text-[var(--color-primary-400)] mt-0.5">✓</span>
              {SCOPE_LABELS[s] ?? s}
            </li>
          ))}
        </ul>

        <form action={decide} className="flex gap-3">
          <button
            type="submit"
            name="decision"
            value="deny"
            className="flex-1 py-2.5 bg-[var(--color-bg-elevated)] border border-[var(--color-border-default)] text-[var(--color-text-primary)] font-medium rounded-lg hover:bg-[var(--color-bg-hover)] transition"
          >
            Deny
          </button>
          <button
            type="submit"
            name="decision"
            value="approve"
            className="flex-1 py-2.5 bg-[var(--color-primary-500)] text-white font-medium rounded-lg hover:bg-[var(--color-primary-600)] transition"
          >
            Connect
          </button>
        </form>
      </div>
    </div>
  );
}
