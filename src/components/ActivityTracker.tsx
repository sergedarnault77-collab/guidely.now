import { useState, useMemo } from "react";
import type { YearData, WeeklyStore } from "../lib/types";

export interface ActivityEvent {
  id: string;
  type: "habit_completed" | "habit_missed" | "task_completed" | "mood_logged" | "week_planned" | "streak_milestone";
  title: string;
  detail: string;
  timestamp: Date;
  emoji: string;
}

export function generateActivityFeed(
  data: YearData,
  weeklyData: WeeklyStore,
  selectedYear: number,
  limit: number = 20
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const monthKey = `${selectedYear}-${String(currentMonth).padStart(2, "0")}`;
  const monthData = data[monthKey] || { habits: [], days: {} };

  // Recent habit completions (last 7 days)
  for (let offset = 0; offset < 7 && offset < currentDay; offset++) {
    const d = currentDay - offset;
    if (d < 1) break;
    const entry = monthData.days[d];
    if (!entry) continue;
    const totalHabits = monthData.habits.length;
    if (totalHabits === 0) continue;
    const pct = Math.round((entry.completedHabits.length / totalHabits) * 100);
    const date = new Date(selectedYear, currentMonth - 1, d);

    if (pct === 100) {
      events.push({
        id: `perfect-${d}`,
        type: "habit_completed",
        title: "Perfect day!",
        detail: `All ${totalHabits} habits completed`,
        timestamp: date,
        emoji: "🏆",
      });
    } else if (pct >= 70) {
      events.push({
        id: `good-${d}`,
        type: "habit_completed",
        title: `${pct}% completion`,
        detail: `${entry.completedHabits.length}/${totalHabits} habits done`,
        timestamp: date,
        emoji: "✅",
      });
    } else if (pct > 0 && pct < 30) {
      events.push({
        id: `low-${d}`,
        type: "habit_missed",
        title: `Tough day (${pct}%)`,
        detail: `Only ${entry.completedHabits.length}/${totalHabits} habits`,
        timestamp: date,
        emoji: "💪",
      });
    }

    // Mood logging
    if (entry.mood !== 5 || entry.motivation !== 5) {
      events.push({
        id: `mood-${d}`,
        type: "mood_logged",
        title: `Mood: ${entry.mood}/10`,
        detail: `Motivation: ${entry.motivation}/10`,
        timestamp: date,
        emoji: entry.mood >= 7 ? "😊" : entry.mood >= 4 ? "😐" : "😔",
      });
    }
  }

  // Streak milestones
  let streak = 0;
  for (let d = currentDay; d >= 1; d--) {
    const entry = monthData.days[d];
    if (entry && monthData.habits.length > 0) {
      const pct = Math.round((entry.completedHabits.length / monthData.habits.length) * 100);
      if (pct >= 50) streak++;
      else break;
    } else {
      if (d === currentDay) continue;
      break;
    }
  }
  if (streak >= 3) {
    events.push({
      id: `streak-${streak}`,
      type: "streak_milestone",
      title: `${streak}-day streak!`,
      detail: streak >= 7 ? "Incredible consistency!" : "Building momentum",
      timestamp: now,
      emoji: "🔥",
    });
  }

  // Weekly task completions
  const weekKey = getWeekKeyLocal(now);
  const weekData = weeklyData[weekKey];
  if (weekData) {
    const completed = weekData.tasks.filter((t) => t.completed).length;
    const total = weekData.tasks.length;
    if (total > 0 && completed > 0) {
      events.push({
        id: `weekly-tasks-${weekKey}`,
        type: "task_completed",
        title: `${completed}/${total} weekly tasks`,
        detail: completed === total ? "All tasks done this week!" : `${total - completed} remaining`,
        timestamp: now,
        emoji: completed === total ? "🎉" : "📋",
      });
    }

    if (weekData.tasks.length > 0) {
      events.push({
        id: `week-planned-${weekKey}`,
        type: "week_planned",
        title: "Week planned",
        detail: `${weekData.tasks.length} tasks, ${weekData.habits.length} habits tracked`,
        timestamp: new Date(weekData.weekStartDate),
        emoji: "📐",
      });
    }
  }

  // Sort by timestamp descending
  events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  return events.slice(0, limit);
}

function getWeekKeyLocal(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function timeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

interface ActivityTrackerProps {
  data: YearData;
  weeklyData: WeeklyStore;
  selectedYear: number;
}

export function ActivityTracker({ data, weeklyData, selectedYear }: ActivityTrackerProps) {
  const [showAll, setShowAll] = useState(false);

  const events = useMemo(
    () => generateActivityFeed(data, weeklyData, selectedYear, showAll ? 50 : 8),
    [data, weeklyData, selectedYear, showAll]
  );

  const typeColors: Record<string, string> = {
    habit_completed: "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800/40",
    habit_missed: "bg-orange-100 dark:bg-orange-900/30 border-orange-200 dark:border-orange-800/40",
    task_completed: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800/40",
    mood_logged: "bg-pink-100 dark:bg-pink-900/30 border-pink-200 dark:border-pink-800/40",
    week_planned: "bg-indigo-100 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-800/40",
    streak_milestone: "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800/40",
  };

  return (
    <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">📊</span>
          <h3 className="font-semibold text-sm">Activity Feed</h3>
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
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border text-sm ${typeColors[event.type] || ""}`}>
              {event.emoji}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{event.title}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">{event.detail}</p>
            </div>
            <span className="text-[10px] text-gray-400 dark:text-gray-500 flex-shrink-0 mt-0.5">
              {timeAgo(event.timestamp)}
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
