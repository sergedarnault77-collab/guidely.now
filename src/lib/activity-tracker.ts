import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useMemo, useRef } from "react";
import type { YearData, WeeklyStore, MonthData } from "./types";

// ---- Activity Event Types ----

export interface ActivityEvent {
  id: string;
  type: "habit_completed" | "habit_missed" | "task_completed" | "mood_logged" | "week_planned" | "streak_milestone" | "perfect_day" | "habit_added" | "habit_removed";
  title: string;
  detail: string;
  emoji: string;
  occurredAt: number; // timestamp ms
}

// ---- Cloud-backed Activity Logger ----

export function useActivityLogger(isAuthenticated: boolean) {
  const logEvent = useMutation(api.mutations.logActivityEvent);
  const queueRef = useRef<ActivityEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (!isAuthenticated || queueRef.current.length === 0) return;
    const batch = [...queueRef.current];
    queueRef.current = [];
    for (const event of batch) {
      logEvent({
        type: event.type,
        title: event.title,
        detail: event.detail,
        emoji: event.emoji,
        occurredAt: event.occurredAt,
      }).catch(() => {});
    }
  }, [isAuthenticated, logEvent]);

  const log = useCallback(
    (event: Omit<ActivityEvent, "id">) => {
      const fullEvent: ActivityEvent = {
        ...event,
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };

      // Always store locally
      storeLocalEvent(fullEvent);

      // Queue for cloud if authenticated
      if (isAuthenticated) {
        queueRef.current.push(fullEvent);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(flush, 1000);
      }

      return fullEvent;
    },
    [isAuthenticated, flush]
  );

  // Convenience methods
  const logHabitCompleted = useCallback(
    (habitName: string, day: number, month: string) => {
      log({
        type: "habit_completed",
        title: `Completed: ${habitName}`,
        detail: `Day ${day} of ${month}`,
        emoji: "✅",
        occurredAt: Date.now(),
      });
    },
    [log]
  );

  const logHabitUnchecked = useCallback(
    (habitName: string, day: number, month: string) => {
      log({
        type: "habit_missed",
        title: `Unchecked: ${habitName}`,
        detail: `Day ${day} of ${month}`,
        emoji: "↩️",
        occurredAt: Date.now(),
      });
    },
    [log]
  );

  const logTaskCompleted = useCallback(
    (taskText: string, weekLabel: string) => {
      log({
        type: "task_completed",
        title: "Task completed",
        detail: taskText,
        emoji: "📋",
        occurredAt: Date.now(),
      });
    },
    [log]
  );

  const logMoodSet = useCallback(
    (mood: number, motivation: number, day: number, month: string) => {
      log({
        type: "mood_logged",
        title: `Mood: ${mood}/10`,
        detail: `Motivation: ${motivation}/10 — Day ${day}, ${month}`,
        emoji: mood >= 7 ? "😊" : mood >= 4 ? "😐" : "😔",
        occurredAt: Date.now(),
      });
    },
    [log]
  );

  const logPerfectDay = useCallback(
    (habitCount: number, day: number, month: string) => {
      log({
        type: "perfect_day",
        title: "Perfect day!",
        detail: `All ${habitCount} habits completed on Day ${day} of ${month}`,
        emoji: "🏆",
        occurredAt: Date.now(),
      });
    },
    [log]
  );

  const logStreakMilestone = useCallback(
    (streak: number) => {
      log({
        type: "streak_milestone",
        title: `${streak}-day streak!`,
        detail: streak >= 7 ? "Incredible consistency!" : "Building momentum",
        emoji: "🔥",
        occurredAt: Date.now(),
      });
    },
    [log]
  );

  const logHabitAdded = useCallback(
    (habitName: string, month: string) => {
      log({
        type: "habit_added",
        title: "New habit added",
        detail: `"${habitName}" added for ${month}`,
        emoji: "➕",
        occurredAt: Date.now(),
      });
    },
    [log]
  );

  const logWeekPlanned = useCallback(
    (taskCount: number, weekLabel: string) => {
      log({
        type: "week_planned",
        title: "Week planned",
        detail: `${taskCount} tasks set for ${weekLabel}`,
        emoji: "📐",
        occurredAt: Date.now(),
      });
    },
    [log]
  );

  return {
    log,
    logHabitCompleted,
    logHabitUnchecked,
    logTaskCompleted,
    logMoodSet,
    logPerfectDay,
    logStreakMilestone,
    logHabitAdded,
    logWeekPlanned,
  };
}

// ---- Local Storage for Activity Events (guest users) ----

const LOCAL_EVENTS_KEY = "habitflow-activity-events";
const MAX_LOCAL_EVENTS = 100;

function storeLocalEvent(event: ActivityEvent) {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    const events: ActivityEvent[] = raw ? JSON.parse(raw) : [];
    events.unshift(event);
    // Keep only recent events
    if (events.length > MAX_LOCAL_EVENTS) events.length = MAX_LOCAL_EVENTS;
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
  } catch {}
}

export function getLocalEvents(limit: number = 50): ActivityEvent[] {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    if (!raw) return [];
    const events: ActivityEvent[] = JSON.parse(raw);
    return events.slice(0, limit);
  } catch {
    return [];
  }
}

// ---- Unified Activity Feed Hook ----

export function useActivityFeed(
  isAuthenticated: boolean,
  data: YearData,
  weeklyData: WeeklyStore,
  selectedYear: number,
  limit: number = 30
) {
  // Cloud events (authenticated users)
  const cloudEvents = useQuery(
    api.queries.listActivityEvents,
    isAuthenticated ? { limit } : "skip"
  );

  // Generate computed events from current data (works for everyone)
  const computedEvents = useMemo(
    () => generateComputedEvents(data, weeklyData, selectedYear, limit),
    [data, weeklyData, selectedYear, limit]
  );

  // Local stored events (guest fallback + recent actions)
  const localEvents = useMemo(() => getLocalEvents(limit), [limit]);

  // Merge: cloud events take priority, then local, then computed
  const mergedEvents = useMemo(() => {
    const seen = new Set<string>();
    const all: ActivityEvent[] = [];

    // Cloud events first (most authoritative)
    if (cloudEvents && cloudEvents.length > 0) {
      for (const ce of cloudEvents) {
        const event: ActivityEvent = {
          id: ce._id,
          type: ce.type as ActivityEvent["type"],
          title: ce.title,
          detail: ce.detail,
          emoji: ce.emoji,
          occurredAt: ce.occurredAt,
        };
        const key = `${event.type}-${event.title}-${Math.floor(event.occurredAt / 60000)}`;
        if (!seen.has(key)) {
          seen.add(key);
          all.push(event);
        }
      }
    }

    // Local events (recent actions not yet in cloud)
    for (const le of localEvents) {
      const key = `${le.type}-${le.title}-${Math.floor(le.occurredAt / 60000)}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(le);
      }
    }

    // Computed events (derived from data state)
    for (const ce of computedEvents) {
      const key = `${ce.type}-${ce.title}`;
      if (!seen.has(key)) {
        seen.add(key);
        all.push(ce);
      }
    }

    // Sort by time descending
    all.sort((a, b) => b.occurredAt - a.occurredAt);
    return all.slice(0, limit);
  }, [cloudEvents, localEvents, computedEvents, limit]);

  return mergedEvents;
}

// ---- Computed Events (derived from current data snapshot) ----

function generateComputedEvents(
  data: YearData,
  weeklyData: WeeklyStore,
  selectedYear: number,
  limit: number
): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const monthKey = `${selectedYear}-${String(currentMonth).padStart(2, "0")}`;
  const monthData: MonthData = data[monthKey] || { habits: [], days: {} };
  const totalHabits = monthData.habits.length;

  // Recent habit completions (last 7 days)
  for (let offset = 0; offset < 7 && offset < currentDay; offset++) {
    const d = currentDay - offset;
    if (d < 1) break;
    const entry = monthData.days[d];
    if (!entry || totalHabits === 0) continue;
    const pct = Math.round((entry.completedHabits.length / totalHabits) * 100);
    const ts = new Date(selectedYear, currentMonth - 1, d, 23, 59).getTime();

    if (pct === 100) {
      events.push({
        id: `computed-perfect-${d}`,
        type: "perfect_day",
        title: "Perfect day!",
        detail: `All ${totalHabits} habits completed`,
        emoji: "🏆",
        occurredAt: ts,
      });
    } else if (pct >= 70) {
      events.push({
        id: `computed-good-${d}`,
        type: "habit_completed",
        title: `${pct}% completion`,
        detail: `${entry.completedHabits.length}/${totalHabits} habits done`,
        emoji: "✅",
        occurredAt: ts,
      });
    }
  }

  // Streak detection
  let streak = 0;
  for (let d = currentDay; d >= 1; d--) {
    const entry = monthData.days[d];
    if (entry && totalHabits > 0) {
      const pct = Math.round((entry.completedHabits.length / totalHabits) * 100);
      if (pct >= 50) streak++;
      else break;
    } else {
      if (d === currentDay) continue;
      break;
    }
  }
  if (streak >= 3) {
    events.push({
      id: `computed-streak-${streak}`,
      type: "streak_milestone",
      title: `${streak}-day streak!`,
      detail: streak >= 7 ? "Incredible consistency!" : "Building momentum",
      emoji: "🔥",
      occurredAt: now.getTime(),
    });
  }

  // Weekly task summary
  const weekKey = getWeekKeyLocal(now);
  const weekData = weeklyData[weekKey];
  if (weekData) {
    const completed = weekData.tasks.filter((t) => t.completed).length;
    const total = weekData.tasks.length;
    if (total > 0 && completed > 0) {
      events.push({
        id: `computed-weekly-${weekKey}`,
        type: "task_completed",
        title: `${completed}/${total} weekly tasks`,
        detail: completed === total ? "All tasks done this week!" : `${total - completed} remaining`,
        emoji: completed === total ? "🎉" : "📋",
        occurredAt: now.getTime() - 1000, // slightly in the past
      });
    }
  }

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

// ---- Time formatting ----

export function timeAgo(ts: number): string {
  const now = Date.now();
  const diffMs = now - ts;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  const date = new Date(ts);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
