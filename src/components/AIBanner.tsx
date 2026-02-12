import { useState } from "react";
import { useAIAccess } from "@/hooks/useAIAccess";

const BANNER_STORAGE_KEY = "guidely-ai-banner-dismissed";

function getToday(): string {
  return new Date().toISOString().split("T")[0];
}

export function AIBanner() {
  const { enabled, reason } = useAIAccess();

  const [visible, setVisible] = useState(() => {
    try {
      const dismissed = localStorage.getItem(BANNER_STORAGE_KEY);
      return dismissed !== getToday();
    } catch {
      return true;
    }
  });

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(BANNER_STORAGE_KEY, getToday());
    } catch {}
  };

  // Not enabled — hide banner (LockedFeature is shown by the parent AI components)
  if (!enabled || !visible) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200/60 dark:border-indigo-800/40 text-indigo-700 dark:text-indigo-300 text-sm">
      <span className="flex-shrink-0">🧠</span>
      <p className="flex-1 text-xs font-medium">
        I&apos;ve prepared your agenda based on your focus patterns, priorities, and pending items.
      </p>
      <button
        onClick={dismiss}
        className="flex-shrink-0 p-0.5 rounded-md text-indigo-400 dark:text-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
        aria-label="Dismiss"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M3 3l8 8M11 3l-8 8" />
        </svg>
      </button>
    </div>
  );
}
