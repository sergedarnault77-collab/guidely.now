import { useState } from "react";
import { useConvex } from "convex/react";
import { api } from "../../convex/_generated/api";

type SyncChoice = "upload" | "keep-cloud";

interface SyncModalProps {
  open: boolean;
  onClose: () => void;
  onSyncComplete: () => void;
}

/**
 * Reads all local habit-tracker data from localStorage and returns
 * a single payload matching the firstSyncUpload mutation args.
 */
function getLocalPayload() {
  const STORAGE_KEY = "habit-tracker-data";
  const WEEKLY_STORAGE_KEY = "habit-tracker-weekly";
  const YEAR_KEY = "habit-tracker-year";

  let months: { monthKey: string; habits: string; days: string }[] = [];
  let weeks: {
    weekKey: string;
    weekStartDate: string;
    tasks: string;
    habits: string;
    habitCompletions: string;
    notes: string;
  }[] = [];
  let selectedYear = new Date().getFullYear();

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, { habits: unknown; days: unknown }>;
      months = Object.entries(parsed).map(([monthKey, md]) => ({
        monthKey,
        habits: JSON.stringify(md.habits),
        days: JSON.stringify(md.days),
      }));
    }
  } catch {}

  try {
    const raw = localStorage.getItem(WEEKLY_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Record<
        string,
        {
          weekStartDate: string;
          tasks: unknown;
          habits: unknown;
          habitCompletions: unknown;
          notes: unknown;
        }
      >;
      weeks = Object.entries(parsed).map(([weekKey, wd]) => ({
        weekKey,
        weekStartDate: wd.weekStartDate,
        tasks: JSON.stringify(wd.tasks),
        habits: JSON.stringify(wd.habits),
        habitCompletions: JSON.stringify(wd.habitCompletions),
        notes: JSON.stringify(wd.notes),
      }));
    }
  } catch {}

  try {
    const raw = localStorage.getItem(YEAR_KEY);
    if (raw) selectedYear = parseInt(raw, 10);
  } catch {}

  return { months, weeks, selectedYear };
}

export function SyncModal({ open, onClose, onSyncComplete }: SyncModalProps) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<SyncChoice>("upload");

  // Use the Convex client imperatively — no useMutation hook that could
  // crash during render if the API stub doesn't resolve.
  const convex = useConvex();

  if (!open) return null;

  const handleSync = async () => {
    setSyncing(true);
    setError(null);

    try {
      if (choice === "upload") {
        // Collect ALL local data into a single payload
        const payload = getLocalPayload();
        // Call the mutation imperatively via the Convex client.
        // This is wrapped in try/catch so if the mutation doesn't exist
        // or the backend is unreachable, we catch it gracefully.
        await convex.mutation(api.mutations.firstSyncUpload, payload);
      }

      // choice === "keep-cloud" → do nothing, cloud data will load on next render

      // Mark first sync as done — ONLY reached on success
      try {
        localStorage.setItem("guidely-first-sync-done", "true");
      } catch {}

      onSyncComplete();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : String(err);
      // Detect common cloud-not-ready / network / mutation-not-found errors
      const isCloudNotReady =
        raw.includes("Could not find") ||
        raw.includes("is not a function") ||
        raw.includes("NetworkError") ||
        raw.includes("Failed to fetch") ||
        raw.includes("INTERNAL_SERVER_ERROR") ||
        raw.includes("not found") ||
        raw.includes("502") ||
        raw.includes("503");
      setError(
        isCloudNotReady
          ? "Cloud sync isn\u2019t ready yet in this environment \u2014 please try again later."
          : raw || "Sync failed. Please try again."
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={syncing ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
              <span className="text-xl">☁️</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Sync your data to the cloud?
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Choose how to handle your existing data
              </p>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="px-6 space-y-3">
          {/* Upload local */}
          <button
            type="button"
            onClick={() => setChoice("upload")}
            disabled={syncing}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              choice === "upload"
                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm"
                : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                choice === "upload"
                  ? "border-indigo-500 bg-indigo-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}>
                {choice === "upload" && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Upload local data to cloud
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Your habits, tasks, and weekly plans will be saved to the cloud and available on all devices.
                </p>
                <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
                  Recommended
                </span>
              </div>
            </div>
          </button>

          {/* Keep cloud */}
          <button
            type="button"
            onClick={() => setChoice("keep-cloud")}
            disabled={syncing}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              choice === "keep-cloud"
                ? "border-indigo-500 bg-indigo-50/50 dark:bg-indigo-900/20 shadow-sm"
                : "border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-300 dark:hover:border-gray-600"
            }`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                choice === "keep-cloud"
                  ? "border-indigo-500 bg-indigo-500"
                  : "border-gray-300 dark:border-gray-600"
              }`}>
                {choice === "keep-cloud" && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  Keep cloud data (discard local)
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Use whatever is already in the cloud. Local data in this browser will not be uploaded.
                </p>
              </div>
            </div>
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
            <div className="flex items-start gap-2">
              <span className="text-amber-500 mt-0.5 flex-shrink-0">⚠️</span>
              <div className="flex-1">
                <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">{error}</p>
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={syncing}
                  className="mt-2 px-3 py-1 text-xs font-semibold rounded-lg bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-800/50 transition-colors disabled:opacity-50"
                >
                  Retry
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="p-6 pt-4 flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={syncing}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {syncing ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Syncing...
              </>
            ) : choice === "upload" ? (
              "Upload & Sync"
            ) : (
              "Use Cloud Data"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
