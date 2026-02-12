import { Link } from "@tanstack/react-router";
import { useCloudStatus } from "@/lib/cloud-status";
import { useCloudState } from "@/hooks/useCloudState";
import { usePlan } from "@/lib/subscription";
import { useSession } from "@/lib/auth-client";

type Props = { compact?: boolean };

export function SyncStatusPill({ compact = false }: Props) {
  const { syncMode, setSyncMode } = useCloudStatus();
  const cloudState = useCloudState();
  const { isPro } = usePlan();
  const { data: session } = useSession();
  const isAuthed = Boolean(session);

  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-all duration-200";
  const subtle =
    "border-gray-200/60 dark:border-gray-700/50 bg-gray-50 dark:bg-gray-800/60 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800";
  const warn =
    "border-amber-300/60 dark:border-amber-600/40 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-950/60";
  const ok =
    "border-emerald-300/60 dark:border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60";

  // ── Local mode ──
  if (syncMode !== "cloud" || cloudState === "local") {
    return (
      <div className={`${base} ${subtle}`}>
        <span>Saved on this device</span>
        {!compact && (
          <>
            <span className="opacity-30">·</span>
            <button
              type="button"
              className="font-semibold hover:underline underline-offset-2"
              onClick={() => setSyncMode("cloud")}
            >
              Save everywhere →
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Checking connectivity ──
  if (cloudState === "loading") {
    return (
      <div className={`${base} ${subtle}`}>
        <svg className="animate-spin h-3 w-3 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <circle cx="12" cy="12" r="10" strokeDasharray="56" strokeDashoffset="14" strokeLinecap="round" />
        </svg>
        <span>Checking cloud…</span>
      </div>
    );
  }

  // ── Cloud mode but offline ──
  if (cloudState === "offline") {
    return (
      <div className={`${base} ${warn}`}>
        <span>Cloud unavailable</span>
        {!compact && (
          <>
            <span className="opacity-30">·</span>
            <button
              type="button"
              className="font-semibold hover:underline underline-offset-2"
              onClick={() => setSyncMode("local")}
            >
              Use local →
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Cloud mode, online, not authenticated ──
  if (!isAuthed) {
    return (
      <div className={`${base} ${subtle}`}>
        <span>Save everywhere</span>
        {!compact && (
          <>
            <span className="opacity-30">·</span>
            <Link
              to="/signin"
              className="font-semibold hover:underline underline-offset-2"
            >
              Sign in →
            </Link>
          </>
        )}
      </div>
    );
  }

  // ── Cloud mode, online, authenticated ──
  return (
    <div className={`${base} ${ok}`} title={isPro ? "Cloud + Pro active" : "Cloud active"}>
      <span>Saving everywhere ✓</span>
      {!isPro && !compact && (
        <>
          <span className="opacity-30">·</span>
          <Link
            to="/billing"
            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline underline-offset-2"
          >
            Unlock Pro →
          </Link>
        </>
      )}
    </div>
  );
}
