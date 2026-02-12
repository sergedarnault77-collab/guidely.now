export interface Habit {
  id: string;
  name: string;
}

export interface DayEntry {
  completedHabits: string[]; // habit IDs
  mood: number; // 1-10
  motivation: number; // 1-10
}

export interface MonthData {
  habits: Habit[];
  days: Record<number, DayEntry>; // day number (1-31) -> entry
}

export type YearData = Record<string, MonthData>; // month key like "2025-01" -> data

// ---- Entitlement Interface ----

/**
 * Single source of truth for the user's paid status.
 *
 * `source` tells us HOW the entitlement was granted so we can later
 * plug in App Store / Play Store / Stripe receipts without refactoring.
 *
 * `expiresAt` is optional — when set, the provider auto-reverts to free
 * after expiry (useful for trial periods or subscription lapses).
 */
export type EntitlementSource =
  | "dev_toggle"       // Developer testing
  | "stripe"           // Stripe Checkout / subscription
  | "app_store"        // Apple In-App Purchase
  | "play_store"       // Google Play Billing
  | "promo"            // Promotional / coupon grant
  | "manual";          // Admin-granted

export interface Entitlement {
  /** Whether the user currently has Pro access */
  isPro: boolean;
  /** How the entitlement was granted */
  source: EntitlementSource;
  /** ISO timestamp when the entitlement expires (null = never / lifetime) */
  expiresAt: string | null;
}

export const FREE_ENTITLEMENT: Entitlement = {
  isPro: false,
  source: "dev_toggle",
  expiresAt: null,
};

// ---- Weekly Planner Types ----

export interface WeeklyTask {
  id: string;
  text: string;
  completed: boolean;
  dayIndex: number; // 0-6 (Sun-Sat based on week start)
}

export interface WeeklyNotes {
  general: string;
  improvements: string;
  gratitude: string;
}

export interface WeeklyData {
  weekStartDate: string; // ISO date string "2025-01-06"
  tasks: WeeklyTask[];
  habits: Habit[]; // up to 8 habits for the week
  habitCompletions: Record<string, boolean[]>; // habitId -> [day0, day1, ..., day6]
  notes: WeeklyNotes;
}

export type WeeklyStore = Record<string, WeeklyData>; // weekKey "2025-W02" -> data

// ---- Weekly Helper Functions ----

export function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // ISO week: Monday is first day
  const dayNum = d.getDay() || 7; // Sunday = 7
  d.setDate(d.getDate() + 4 - dayNum); // Thursday of the week
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

export function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
  return new Date(d.setDate(diff));
}

export function getWeekDates(startDate: Date): Date[] {
  const dates: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    dates.push(d);
  }
  return dates;
}

export function formatWeekRange(startDate: Date): string {
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + 6);
  const startMonth = startDate.toLocaleDateString("en-US", { month: "short" });
  const endMonth = endDate.toLocaleDateString("en-US", { month: "short" });
  if (startMonth === endMonth) {
    return `${startMonth} ${startDate.getDate()} – ${endDate.getDate()}, ${startDate.getFullYear()}`;
  }
  return `${startMonth} ${startDate.getDate()} – ${endMonth} ${endDate.getDate()}, ${startDate.getFullYear()}`;
}

export const WEEKDAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function calculateWeeklyTaskProgress(tasks: WeeklyTask[], dayIndex: number): { completed: number; total: number; percentage: number } {
  const dayTasks = tasks.filter((t) => t.dayIndex === dayIndex);
  const completed = dayTasks.filter((t) => t.completed).length;
  const total = dayTasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percentage };
}

export function calculateWeeklyOverallProgress(tasks: WeeklyTask[]): { completed: number; total: number; percentage: number } {
  const completed = tasks.filter((t) => t.completed).length;
  const total = tasks.length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percentage };
}

export function calculateWeeklyHabitProgress(habitCompletions: Record<string, boolean[]>): { completed: number; total: number; percentage: number } {
  let completed = 0;
  let total = 0;
  for (const days of Object.values(habitCompletions)) {
    for (const done of days) {
      total++;
      if (done) completed++;
    }
  }
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { completed, total, percentage };
}

export function getWeeksInMonth(year: number, month: number): { weekKey: string; startDate: Date; label: string }[] {
  const weeks: { weekKey: string; startDate: Date; label: string }[] = [];
  const seen = new Set<string>();
  const daysInMonth = getDaysInMonth(year, month);

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month - 1, d);
    const wk = getWeekKey(date);
    if (!seen.has(wk)) {
      seen.add(wk);
      const start = getWeekStartDate(date);
      weeks.push({
        weekKey: wk,
        startDate: start,
        label: `Week ${weeks.length + 1}`,
      });
    }
  }
  return weeks;
}

// Rollup: aggregate weekly data into monthly summary
export interface WeeklyRollup {
  weekKey: string;
  weekLabel: string;
  weekRange: string;
  taskProgress: { completed: number; total: number; percentage: number };
  habitProgress: { completed: number; total: number; percentage: number };
  dailyTaskProgress: { completed: number; total: number; percentage: number }[];
  dailyHabitProgress: number[]; // percentage per day
}

export function rollupWeekToMonth(weeklyStore: WeeklyStore, year: number, month: number): WeeklyRollup[] {
  const weeks = getWeeksInMonth(year, month);
  return weeks.map((w, idx) => {
    const weekData = weeklyStore[w.weekKey];
    if (!weekData) {
      return {
        weekKey: w.weekKey,
        weekLabel: `Week ${idx + 1}`,
        weekRange: formatWeekRange(w.startDate),
        taskProgress: { completed: 0, total: 0, percentage: 0 },
        habitProgress: { completed: 0, total: 0, percentage: 0 },
        dailyTaskProgress: Array.from({ length: 7 }, () => ({ completed: 0, total: 0, percentage: 0 })),
        dailyHabitProgress: Array(7).fill(0),
      };
    }

    const taskProgress = calculateWeeklyOverallProgress(weekData.tasks);
    const habitProgress = calculateWeeklyHabitProgress(weekData.habitCompletions);

    const dailyTaskProgress = Array.from({ length: 7 }, (_, i) =>
      calculateWeeklyTaskProgress(weekData.tasks, i)
    );

    const dailyHabitProgress = Array.from({ length: 7 }, (_, dayIdx) => {
      const habitIds = Object.keys(weekData.habitCompletions);
      if (habitIds.length === 0) return 0;
      let done = 0;
      for (const hid of habitIds) {
        if (weekData.habitCompletions[hid]?.[dayIdx]) done++;
      }
      return Math.round((done / habitIds.length) * 100);
    });

    return {
      weekKey: w.weekKey,
      weekLabel: `Week ${idx + 1}`,
      weekRange: formatWeekRange(w.startDate),
      taskProgress,
      habitProgress,
      dailyTaskProgress,
      dailyHabitProgress,
    };
  });
}

export function getMonthlyRollupSummary(rollups: WeeklyRollup[]): {
  totalTasksCompleted: number;
  totalTasks: number;
  taskPercentage: number;
  totalHabitsCompleted: number;
  totalHabits: number;
  habitPercentage: number;
  weekCount: number;
  bestWeek: string;
  bestWeekPct: number;
} {
  let totalTasksCompleted = 0;
  let totalTasks = 0;
  let totalHabitsCompleted = 0;
  let totalHabits = 0;
  let bestWeek = "";
  let bestWeekPct = 0;

  for (const r of rollups) {
    totalTasksCompleted += r.taskProgress.completed;
    totalTasks += r.taskProgress.total;
    totalHabitsCompleted += r.habitProgress.completed;
    totalHabits += r.habitProgress.total;
    const combined = r.taskProgress.total + r.habitProgress.total > 0
      ? Math.round(((r.taskProgress.completed + r.habitProgress.completed) / (r.taskProgress.total + r.habitProgress.total)) * 100)
      : 0;
    if (combined > bestWeekPct) {
      bestWeekPct = combined;
      bestWeek = r.weekLabel;
    }
  }

  return {
    totalTasksCompleted,
    totalTasks,
    taskPercentage: totalTasks > 0 ? Math.round((totalTasksCompleted / totalTasks) * 100) : 0,
    totalHabitsCompleted,
    totalHabits,
    habitPercentage: totalHabits > 0 ? Math.round((totalHabitsCompleted / totalHabits) * 100) : 0,
    weekCount: rollups.length,
    bestWeek,
    bestWeekPct,
  };
}

// ---- Existing Types & Helpers ----

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
] as const;

export const MONTH_KEYS = [
  "01", "02", "03", "04", "05", "06",
  "07", "08", "09", "10", "11", "12"
] as const;

export const DAYS_OF_WEEK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

export function getFirstDayOfMonth(year: number, month: number): number {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1; // Monday = 0
}

export function getMonthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function getWeekNumber(day: number, firstDay: number): number {
  return Math.floor((day - 1 + firstDay) / 7) + 1;
}

export function calculateDailyProgress(entry: DayEntry | undefined, totalHabits: number): number {
  if (!entry || totalHabits === 0) return 0;
  return Math.round((entry.completedHabits.length / totalHabits) * 100);
}

export function calculateMonthProgress(monthData: MonthData, daysInMonth: number): { completed: number; total: number; percentage: number } {
  const totalHabits = monthData.habits.length;
  if (totalHabits === 0) return { completed: 0, total: 0, percentage: 0 };
  
  let completed = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const entry = monthData.days[d];
    if (entry) {
      completed += entry.completedHabits.length;
    }
  }
  const total = totalHabits * daysInMonth;
  const percentage = total > 0 ? Math.round((completed / total) * 10000) / 100 : 0;
  return { completed, total, percentage };
}

export function getHabitStats(habitId: string, monthData: MonthData, daysInMonth: number): { goal: number; actual: number; percentage: number } {
  let actual = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const entry = monthData.days[d];
    if (entry && entry.completedHabits.includes(habitId)) {
      actual++;
    }
  }
  return {
    goal: daysInMonth,
    actual,
    percentage: Math.round((actual / daysInMonth) * 100),
  };
}

export const DEFAULT_HABITS: Habit[] = [
  { id: "h1", name: "Wake up at 05:00" },
  { id: "h2", name: "Gym" },
  { id: "h3", name: "Reading / Learning" },
  { id: "h4", name: "Day Planning" },
  { id: "h5", name: "Budget Tracking" },
  { id: "h6", name: "Project Work" },
  { id: "h7", name: "No Alcohol" },
  { id: "h8", name: "Social Media Detox" },
  { id: "h9", name: "Goal Journaling" },
  { id: "h10", name: "Cold Shower" },
];

export const DEFAULT_WEEKLY_HABITS: Habit[] = [
  { id: "wh1", name: "Wake up at 06:00" },
  { id: "wh2", name: "No Alcohol" },
  { id: "wh3", name: "Cold Shower" },
  { id: "wh4", name: "1hr Social Media" },
  { id: "wh5", name: "Budget Tracking" },
  { id: "wh6", name: "Gym" },
  { id: "wh7", name: "Reading" },
  { id: "wh8", name: "English" },
];
