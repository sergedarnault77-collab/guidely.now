import { useState } from "react";
import { useActivityFeed, timeAgo, type ActivityEvent } from "../lib/activity-tracker";
import type { YearData, WeeklyStore } from "../lib/types";

interface ActivityFeedProps {
  isAuthenticated: boolean;
  data: YearData;
  weeklyData: WeeklyStore;
  selectedYear: number;
}

export function ActivityFeed({ isAuthenticated, data, weeklyData, selectedYear }: ActivityFeedProps) {
  const [showAll, setShowAll] = useState(false);
  const limit = showAll ? 50 : 8;
  const events = useActivityFeed(isAuthenticated, data, weeklyData, selectedYear, limit);

  const typeColors: Record<string, string> = {
    habit_completed: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/40",
    habit_missed: "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800/40",
    task_completed: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/40",
    mood_logged: "bg-pink-100 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800/40",
    week_planned: "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/40",
    streak_milestone: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/40",
    perfect_day: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800/40",
    habit_added: "bg-cyan-100 dark:bg-cyan-900/30 border-cyan-200 dark:border-cyan-800/40",
    habit_removed: "bg-red-100 dark:bg-red-900/30 border-red-200 dark:border-red-800/40",
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="font-semibold text-sm">Activity Feed</h3>
          {isAuthenticated && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300 uppercase tracking-wider">
              Synced
            </span>
          )}
          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
            {events.length}
          </span>
        </div>
        {events.length > 8 && (
          <button
            onClick={() => setShowAll(!showAll)}
            className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
          >
            {showAll ? "Show less" : "Show all"}
          </button>
        )}
      </div>

      <div className="divide-y divide-gray-100 dark:divide-gray-800/40">
        {events.map((event) => (
          <div key={event.id} className="p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border text-sm ${typeColors[event.type] || "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700"}`}>
              {event.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{event.title}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{event.detail}</p>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">
              {timeAgo(event.occurredAt)}
            </span>
          </div>
        ))}

        {events.length === 0 && (
          <div className="p-8 text-center">
            <span className="text-3xl block mb-2">📭</span>
            <p className="text-xs text-gray-500 dark:text-gray-400">No activity yet. Start tracking habits to see your feed!</p>
          </div>
        )}
      </div>
    </div>
  );
}
