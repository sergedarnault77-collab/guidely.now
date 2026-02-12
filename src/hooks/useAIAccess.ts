import { useCloudStatus } from "@/lib/cloud-status";
import { useCloudState } from "@/hooks/useCloudState";
import { usePlan } from "@/lib/subscription";

export type AIAccessReason = "enable-cloud" | "cloud-offline" | "upgrade" | null;

export interface AIAccessResult {
  enabled: boolean;
  reason: AIAccessReason;
}

/**
 * 3-tier AI feature gating:
 * 1. syncMode must be "cloud"
 * 2. cloudState must be "online"
 * 3. isPro must be true
 *
 * Returns { enabled, reason } where reason explains why AI is locked (if at all)
 */
export function useAIAccess(): AIAccessResult {
  const { syncMode } = useCloudStatus();
  const cloudState = useCloudState(); // local | loading | offline | online
  const { isPro } = usePlan();

  const enabled =
    syncMode === "cloud" &&
    cloudState === "online" &&
    isPro === true;

  return {
    enabled,
    reason:
      syncMode !== "cloud"
        ? "enable-cloud"
        : cloudState !== "online"
          ? "cloud-offline"
          : !isPro
            ? "upgrade"
            : null,
  };
}
