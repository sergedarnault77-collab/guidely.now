import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";

const SYNC_MODE_KEY = "guidely-sync-mode";

type SyncMode = "local" | "cloud";

interface CloudStatus {
  convexUrlPresent: boolean;
  convexReachable: boolean;
  checking: boolean;
  lastCheckedAt: Date | null;
  recheck: () => void;
  syncMode: SyncMode;
  setSyncMode: (mode: SyncMode) => void;
  isCloudEnabled: boolean; // convenience: syncMode === "cloud" && convexReachable
}

const CloudStatusContext = createContext<CloudStatus>({
  convexUrlPresent: false,
  convexReachable: false,
  checking: true,
  lastCheckedAt: null,
  recheck: () => {},
  syncMode: "local",
  setSyncMode: () => {},
  isCloudEnabled: false,
});

const convexUrl = (import.meta as { env?: { VITE_CONVEX_URL?: string } }).env?.VITE_CONVEX_URL?.trim();
const convexUrlConfigured = Boolean(convexUrl);

function loadSyncMode(): SyncMode {
  try {
    const stored = localStorage.getItem(SYNC_MODE_KEY);
    if (stored === "cloud" || stored === "local") return stored;
  } catch {}
  return "local"; // default is always local
}

function saveSyncMode(mode: SyncMode) {
  try {
    localStorage.setItem(SYNC_MODE_KEY, mode);
  } catch {}
}

export function CloudStatusProvider({ children }: { children: ReactNode }) {
  const [convexUrlPresent, setConvexUrlPresent] = useState(convexUrlConfigured);
  const [convexReachable, setConvexReachable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [syncMode, setSyncModeState] = useState<SyncMode>(loadSyncMode);

  const setSyncMode = useCallback((mode: SyncMode) => {
    setSyncModeState(mode);
    saveSyncMode(mode);
  }, []);

  const check = useCallback(async () => {
    setConvexUrlPresent(convexUrlConfigured);

    // In local mode (or with no URL), do not touch Convex at all.
    if (!convexUrlConfigured || syncMode !== "cloud") {
      setChecking(false);
      setConvexReachable(false);
      setLastCheckedAt(new Date());
      return;
    }

    setChecking(true);
    try {
      // Ping the Convex version endpoint with a 4s timeout
      const pingUrl = convexUrl!.replace(
        /\.cloud\.convex\.cloud$/,
        ".convex.cloud/version"
      );
      const res = await fetch(pingUrl, {
        method: "GET",
        signal: AbortSignal.timeout(4000),
      });
      setConvexReachable(res.ok);
    } catch {
      setConvexReachable(false);
    } finally {
      setChecking(false);
      setLastCheckedAt(new Date());
    }
  }, [syncMode]);

  useEffect(() => {
    check();
  }, [check]);

  const isCloudEnabled = syncMode === "cloud" && convexReachable;

  return (
    <CloudStatusContext.Provider
      value={{
        convexUrlPresent,
        convexReachable,
        checking,
        lastCheckedAt,
        recheck: check,
        syncMode,
        setSyncMode,
        isCloudEnabled,
      }}
    >
      {children}
    </CloudStatusContext.Provider>
  );
}

export function useCloudStatus(): CloudStatus {
  return useContext(CloudStatusContext);
}
