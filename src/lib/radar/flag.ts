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

/**
 * Budget-exempt users: sweep units ignore their per-day read budget so the
 * queue can be exercised repeatedly. For local dev (unlimited sweeping while
 * building) and an explicit testing allowlist (env RADAR_UNLIMITED_USER_IDS,
 * comma-separated auth user ids) on deployed builds. NOT for general rollout —
 * this removes the COGS ceiling.
 */
export function isRadarUnlimitedUser(userId: string): boolean {
  if (process.env.NODE_ENV === "development") return true;
  const ids = (process.env.RADAR_UNLIMITED_USER_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return ids.includes(userId);
}
