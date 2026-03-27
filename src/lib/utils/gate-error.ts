export interface GateErrorInfo {
  isGateError: true;
  type: "plan_limit" | "ai_limit";
  message: string;
  feature?: string;
  currentPlan?: string;
  upgradeUrl: string;
}

/**
 * Parse an API response to detect plan/AI limit errors.
 * Returns structured info for UI display, or null if not a gate error.
 */
export function parseGateError(
  status: number,
  data: Record<string, unknown>
): GateErrorInfo | null {
  if (status === 403 && data.code === "PLAN_LIMIT") {
    return {
      isGateError: true,
      type: "plan_limit",
      message: `${String(data.feature || "This feature")} requires a Pro plan`,
      feature: data.feature as string | undefined,
      currentPlan: data.current_plan as string | undefined,
      upgradeUrl: (data.upgrade_url as string) || "/pricing",
    };
  }

  if (status === 429 && data.code === "AI_LIMIT") {
    return {
      isGateError: true,
      type: "ai_limit",
      message: "Daily AI generation limit reached. Upgrade for unlimited.",
      upgradeUrl: (data.upgrade_url as string) || "/pricing",
    };
  }

  return null;
}

/**
 * Handle a fetch response and return gate error info if applicable.
 * Returns null if the response is not a gate error.
 */
export async function handleGateError(
  res: Response
): Promise<GateErrorInfo | null> {
  if (res.status !== 403 && res.status !== 429) return null;

  try {
    const data = await res.json();
    return parseGateError(res.status, data);
  } catch {
    return null;
  }
}
