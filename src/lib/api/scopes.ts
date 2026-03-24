export const ALLOWED_SCOPES = [
  "drafts:read", "drafts:write", "drafts:generate",
  "publish:read", "publish:write",
  "analytics:read",
  "voice:read", "voice:write",
  "strategy:read", "strategy:write",
] as const;

export type ApiScope = (typeof ALLOWED_SCOPES)[number];
