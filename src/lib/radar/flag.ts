/**
 * Radar beta gate. Pre-scale rollout: sweeps run per-user on user tokens for
 * an allowlist (env RADAR_BETA_USER_IDS, comma-separated auth user ids), and
 * for everyone in local development. Platform absorbs the read COGS in beta
 * (~$15/user/month ceiling via per-unit budgets) — the numbers we're after are
 * reads-per-delivered-card and queue act-rate, not revenue.
 */
export function isRadarBetaUser(userId: string): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const ids = (process.env.RADAR_BETA_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}
