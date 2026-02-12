import { useCloudStatus } from "@/lib/cloud-status";

export type CloudState = "local" | "offline" | "loading" | "online";

/**
 * Returns a single derived cloud state:
 *   "local"   — syncMode is "local" OR no VITE_CONVEX_URL configured
 *   "offline" — cloud mode but Convex is not reachable
 *   "loading" — still checking connectivity
 *   "online"  — cloud mode and Convex is reachable
 */
export function useCloudState(): CloudState {
  const { syncMode, convexUrlPresent, convexReachable, checking } = useCloudStatus();

  // If user chose local mode or there's no Convex URL, always "local"
  if (syncMode === "local" || !convexUrlPresent) {
    return "local";
  }

  // Cloud mode from here on — check connectivity
  if (checking) {
    return "loading";
  }

  if (!convexReachable) {
    return "offline";
  }

  return "online";
}
