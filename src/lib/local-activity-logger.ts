import { useCallback } from "react";

/**
 * Pure local activity logger — zero Convex imports.
 * Stores events in localStorage only. Used when shouldUseCloud is false.
 */

export interface ActivityEvent {
  id: string;
  type: "habit_completed" | "habit_missed" | "task_completed" | "mood_logged" | "week_planned" | "streak_milestone" | "perfect_day" | "habit_added" | "habit_removed";
  title: string;
  detail: string;
  emoji: string;
  occurredAt: number;
}

const LOCAL_EVENTS_KEY = "habitflow-activity-events";
const MAX_LOCAL_EVENTS = 100;

function storeLocalEvent(event: ActivityEvent) {
  try {
    const raw = localStorage.getItem(LOCAL_EVENTS_KEY);
    const events: ActivityEvent[] = raw ? JSON.parse(raw) : [];
    events.unshift(event);
    if (events.length > MAX_LOCAL_EVENTS) events.length = MAX_LOCAL_EVENTS;
    localStorage.setItem(LOCAL_EVENTS_KEY, JSON.stringify(events));
  } catch {}
}

export function useLocalActivityLogger() {
  const log = useCallback(
    (event: Omit<ActivityEvent, "id">) => {
      const fullEvent: ActivityEvent = {
        ...event,
        id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      };
      storeLocalEvent(fullEvent);
      return fullEvent;
    },
    []
  );

  const logHabitCompleted = useCallback(
    (habitName: string, day: number, month: string) => {
      log({ type: "habit_completed", title: `Completed: ${habitName}`, detail: `Day ${day} of ${month}`, emoji: "\u2705", occurredAt: Date.now() });
    },
    [log]
  );

  const logHabitUnchecked = useCallback(
    (habitName: string, day: number, month: string) => {
      log({ type: "habit_missed", title: `Unchecked: ${habitName}`, detail: `Day ${day} of ${month}`, emoji: "\u21a9\ufe0f", occurredAt: Date.now() });
    },
    [log]
  );

  const logTaskCompleted = useCallback(
    (taskText: string, _weekLabel: string) => {
      log({ type: "task_completed", title: "Task completed", detail: taskText, emoji: "\ud83d\udccb", occurredAt: Date.now() });
    },
    [log]
  );

  const logMoodSet = useCallback(
    (mood: number, motivation: number, day: number, month: string) => {
      log({
        type: "mood_logged",
        title: `Mood: ${mood}/10`,
        detail: `Motivation: ${motivation}/10 \u2014 Day ${day}, ${month}`,
        emoji: mood >= 7 ? "\ud83d\ude0a" : mood >= 4 ? "\ud83d\ude10" : "\ud83d\ude14",
        occurredAt: Date.now(),
      });
    },
    [log]
  );

  const logPerfectDay = useCallback(
    (habitCount: number, day: number, month: string) => {
      log({ type: "perfect_day", title: "Perfect day!", detail: `All ${habitCount} habits completed on Day ${day} of ${month}`, emoji: "\ud83c\udfc6", occurredAt: Date.now() });
    },
    [log]
  );

  const logStreakMilestone = useCallback(
    (streak: number) => {
      log({ type: "streak_milestone", title: `${streak}-day streak!`, detail: streak >= 7 ? "Incredible consistency!" : "Building momentum", emoji: "\ud83d\udd25", occurredAt: Date.now() });
    },
    [log]
  );

  const logHabitAdded = useCallback(
    (habitName: string, month: string) => {
      log({ type: "habit_added", title: "New habit added", detail: `"${habitName}" added for ${month}`, emoji: "\u2795", occurredAt: Date.now() });
    },
    [log]
  );

  const logWeekPlanned = useCallback(
    (taskCount: number, weekLabel: string) => {
      log({ type: "week_planned", title: "Week planned", detail: `${taskCount} tasks set for ${weekLabel}`, emoji: "\ud83d\udcd0", occurredAt: Date.now() });
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
