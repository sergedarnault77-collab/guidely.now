import { createContext, useContext, type ReactNode } from "react";
import { useHabitStore } from "./store";
import { useActivityLogger } from "./activity-tracker";
import { useLocalHabitStore } from "./local-store";
import { useLocalActivityLogger } from "./local-activity-logger";
import { useCloudStatus } from "./cloud-status";
import { useSession } from "./auth-client";
import type { YearData, WeeklyStore, MonthData, Habit, WeeklyData, WeeklyNotes } from "./types";

/* ── Shared shape that both cloud and local stores satisfy ── */
interface HabitStore {
  data: YearData;
  weeklyData: WeeklyStore;
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  getMonthData: (year: number, month: number) => MonthData;
  setMonthHabits: (year: number, month: number, habits: Habit[]) => void;
  toggleHabit: (year: number, month: number, day: number, habitId: string) => void;
  setMood: (year: number, month: number, day: number, mood: number) => void;
  setMotivation: (year: number, month: number, day: number, motivation: number) => void;
  addHabit: (year: number, month: number, name: string) => void;
  removeHabit: (year: number, month: number, habitId: string) => void;
  getWeekData: (weekKey: string) => WeeklyData | null;
  initWeek: (weekKey: string, startDate: Date) => void;
  addWeeklyTask: (weekKey: string, text: string, dayIndex: number) => void;
  toggleWeeklyTask: (weekKey: string, taskId: string) => void;
  removeWeeklyTask: (weekKey: string, taskId: string) => void;
  moveWeeklyTask: (weekKey: string, taskId: string, newDayIndex: number) => void;
  toggleWeeklyHabit: (weekKey: string, habitId: string, dayIndex: number) => void;
  addWeeklyHabit: (weekKey: string, name: string) => void;
  removeWeeklyHabit: (weekKey: string, habitId: string) => void;
  updateWeeklyNotes: (weekKey: string, notes: Partial<WeeklyNotes>) => void;
  resetData: () => void;
  isAuthenticated: boolean;
}

interface ActivityLogger {
  logHabitCompleted: (habitName: string, day: number, month: string) => void;
  logHabitUnchecked: (habitName: string, day: number, month: string) => void;
  logTaskCompleted: (taskText: string, weekLabel: string) => void;
  logMoodSet: (mood: number, motivation: number, day: number, month: string) => void;
  logPerfectDay: (habitCount: number, day: number, month: string) => void;
  logStreakMilestone: (streak: number) => void;
  logHabitAdded: (habitName: string, month: string) => void;
  logWeekPlanned: (taskCount: number, weekLabel: string) => void;
}

interface HabitContextValue extends HabitStore {
  activityLogger: ActivityLogger;
}

const HabitContext = createContext<HabitContextValue | null>(null);

/* ── Cloud provider: calls useHabitStore + useActivityLogger (both use Convex hooks) ── */
function CloudProviderInner({ children }: { children: ReactNode }) {
  const store = useHabitStore();
  const activityLogger = useActivityLogger(store.isAuthenticated);
  return (
    <HabitContext.Provider value={{ ...store, activityLogger }}>
      {children}
    </HabitContext.Provider>
  );
}

/* ── Local provider: calls useLocalHabitStore + useLocalActivityLogger (zero Convex) ── */
function LocalProviderInner({ children }: { children: ReactNode }) {
  const store = useLocalHabitStore();
  const activityLogger = useLocalActivityLogger();
  return (
    <HabitContext.Provider value={{ ...store, activityLogger }}>
      {children}
    </HabitContext.Provider>
  );
}

/* ── Public HabitProvider: gates on cloud status to pick the right inner provider ── */
export function HabitProvider({ children }: { children: ReactNode }) {
  const { syncMode, isCloudEnabled } = useCloudStatus();
  const { data: session } = useSession();
  const isAuthenticated = !!session;

  // Only use the cloud provider when ALL three conditions are met:
  // 1. syncMode is "cloud" (user opted in)
  // 2. Convex is reachable (isCloudEnabled)
  // 3. User is authenticated
  const shouldUseCloud = syncMode === "cloud" && isCloudEnabled && isAuthenticated;

  if (shouldUseCloud) {
    return <CloudProviderInner>{children}</CloudProviderInner>;
  }

  return <LocalProviderInner>{children}</LocalProviderInner>;
}

export function useHabits(): HabitContextValue {
  const ctx = useContext(HabitContext);
  if (!ctx) throw new Error("useHabits must be used within HabitProvider");
  return ctx;
}
