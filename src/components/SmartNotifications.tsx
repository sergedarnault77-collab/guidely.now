import { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { SmartNotification } from "../lib/smart-notifications";
import { notificationStyles, notificationTypeIcons } from "../lib/smart-notifications";
import { useFeatureAccess, LockedFeature } from "../lib/subscription";

interface SmartNotificationsProps {
  notifications: SmartNotification[];
}

export function SmartNotifications({ notifications }: SmartNotificationsProps) {
  const access = useFeatureAccess("aiNotifications");
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set());

  const visible = useMemo(
    () => notifications.filter(n => !dismissedIds.has(n.id)),
    [notifications, dismissedIds]
  );

  // Auto-dismiss notifications
  useEffect(() => {
    if (!access.allowed) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const n of visible) {
      if (n.autoDismissSeconds > 0) {
        const timer = setTimeout(() => {
          handleDismiss(n.id);
        }, n.autoDismissSeconds * 1000);
        timers.push(timer);
      }
    }
    return () => timers.forEach(clearTimeout);
  }, [visible, access.allowed]);

  const handleDismiss = useCallback((id: string) => {
    setAnimatingOut(prev => new Set([...prev, id]));
    setTimeout(() => {
      setDismissedIds(prev => new Set([...prev, id]));
      setAnimatingOut(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
  }, []);

  // Hidden entirely in local mode — no payment prompt
  if (!access.isCloud) return null;

  // Cloud mode but not Pro — show locked state
  if (!access.allowed) {
    return <LockedFeature reason={access.reason} featureLabel="Smart Guidance" compact />;
  }

  if (visible.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Smart Guidance
          </h3>
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 uppercase tracking-wider">
            AI
          </span>
        </div>
        {visible.length > 1 && (
          <button
            onClick={() => visible.forEach(n => handleDismiss(n.id))}
            className="text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            Dismiss all
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {visible.map((notification) => {
          const styles = notificationStyles[notification.priority];
          const isExiting = animatingOut.has(notification.id);

          return (
            <div
              key={notification.id}
              className={`relative p-2.5 rounded-lg border shadow-sm transition-all duration-300 ${styles.border} ${styles.bg} ${styles.glow} ${
                isExiting ? "opacity-0 scale-95 -translate-x-2" : "opacity-100 scale-100 translate-x-0"
              }`}
            >
              {/* Dismiss button */}
              <button
                onClick={() => handleDismiss(notification.id)}
                className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10 transition-colors text-[8px]"
              >
                ✕
              </button>

              <div className="flex items-start gap-2 pr-4">
                {/* Icon */}
                <div className="flex-shrink-0 w-7 h-7 rounded-md bg-white/60 dark:bg-gray-800/60 flex items-center justify-center text-sm shadow-sm">
                  {notification.emoji}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                    <span className="text-[11px] font-bold text-gray-800 dark:text-gray-200">
                      {notification.title}
                    </span>
                    <span className={`px-1 py-0 text-[8px] font-bold rounded-full uppercase tracking-wider ${styles.badge}`}>
                      {notification.type}
                    </span>
                    {notification.priority === "urgent" && (
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 dark:text-gray-400 leading-snug">
                    {notification.message}
                  </p>

                  {/* Source */}
                  <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-0.5 italic">
                    {notification.source}
                  </p>

                  {/* Action */}
                  {notification.action && (
                    <div className="mt-1.5">
                      {notification.action.route ? (
                        <Link
                          to={notification.action.route as any}
                          className="inline-flex items-center gap-0.5 px-2 py-1 text-[9px] font-semibold rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-600/40 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 shadow-sm"
                        >
                          {notification.action.label}
                          <span className="text-[8px]">→</span>
                        </Link>
                      ) : (
                        <button className="inline-flex items-center gap-0.5 px-2 py-1 text-[9px] font-semibold rounded-md bg-white/80 dark:bg-gray-800/80 border border-gray-200/60 dark:border-gray-600/40 text-gray-700 dark:text-gray-300 hover:bg-white dark:hover:bg-gray-700 transition-all duration-200 hover:scale-105 shadow-sm">
                          {notification.action.label}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Auto-dismiss progress bar */}
              {notification.autoDismissSeconds > 0 && !isExiting && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-xl overflow-hidden">
                  <div
                    className="h-full bg-gray-400/30 dark:bg-gray-500/30 rounded-full"
                    style={{
                      animation: `shrink ${notification.autoDismissSeconds}s linear forwards`,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}

// ---- Compact Notification Bell for Header ----

interface NotificationBellProps {
  count: number;
  onClick: () => void;
}

export function NotificationBell({ count, onClick }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
      title={`${count} notification${count !== 1 ? "s" : ""}`}
    >
      <span className="text-lg">🔔</span>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] flex items-center justify-center px-1 text-[9px] font-bold bg-red-500 text-white rounded-full shadow-lg shadow-red-500/30 animate-pulse">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );
}
