import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useSession } from "./auth-client";
import { useCloudStatus } from "./cloud-status";
import type { YearData, MonthData, DayEntry, Habit, WeeklyStore, WeeklyData, WeeklyTask, WeeklyNotes } from "./types";
import { getMonthKey, getWeekKey, getWeekStartDate, getWeekDates, DEFAULT_HABITS, DEFAULT_WEEKLY_HABITS } from "./types";

const STORAGE_KEY = "habit-tracker-data";
const YEAR_KEY = "habit-tracker-year";
const WEEKLY_STORAGE_KEY = "habit-tracker-weekly";

function loadData(): YearData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveDataLocal(data: YearData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadYear(): number {
  try {
    const raw = localStorage.getItem(YEAR_KEY);
    if (raw) return parseInt(raw, 10);
  } catch {}
  return new Date().getFullYear();
}

function saveYear(year: number) {
  localStorage.setItem(YEAR_KEY, String(year));
}

function loadWeeklyData(): WeeklyStore {
  try {
    const raw = localStorage.getItem(WEEKLY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {};
}

function saveWeeklyDataLocal(data: WeeklyStore) {
  localStorage.setItem(WEEKLY_STORAGE_KEY, JSON.stringify(data));
}

function generateSampleData(): YearData {
  const year = new Date().getFullYear();
  const data: YearData = {};
  const now = new Date();
  const currentMonth = now.getMonth() + 1;

  for (let offset = -2; offset <= 0; offset++) {
    let m = currentMonth + offset;
    let y = year;
    if (m <= 0) { m += 12; y -= 1; }

    const key = getMonthKey(y, m);
    const daysInMonth = new Date(y, m, 0).getDate();
    const maxDay = (m === currentMonth && y === year) ? now.getDate() : daysInMonth;

    const monthData: MonthData = {
      habits: [...DEFAULT_HABITS],
      days: {},
    };

    for (let d = 1; d <= maxDay; d++) {
      const completedHabits: string[] = [];
      DEFAULT_HABITS.forEach((h) => {
        if (Math.random() > 0.35) {
          completedHabits.push(h.id);
        }
      });
      monthData.days[d] = {
        completedHabits,
        mood: Math.floor(Math.random() * 6) + 4,
        motivation: Math.floor(Math.random() * 5) + 5,
      };
    }

    data[key] = monthData;
  }

  return data;
}

function generateSampleWeeklyData(): WeeklyStore {
  const store: WeeklyStore = {};
  const now = new Date();

  for (let offset = -2; offset <= 0; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset * 7);
    const weekKey = getWeekKey(d);
    const startDate = getWeekStartDate(d);

    const sampleTasks: WeeklyTask[] = [];
    const taskTemplates = [
      "Create a development plan", "Reels script", "Analyze the marketing report",
      "Finish the project proposal", "Set up website traffic", "Pay the targeting specialist",
      "Organize personal finances", "Write 10 content ideas", "Prepare the commercial proposal",
      "Review subscriptions", "Organize the workspace", "Call team meeting",
      "Renew gym membership", "Update portfolio", "Research competitors",
      "Plan social media posts", "Review monthly budget", "Send client invoices",
    ];

    for (let dayIdx = 0; dayIdx < 7; dayIdx++) {
      const numTasks = Math.floor(Math.random() * 4) + 3;
      for (let t = 0; t < numTasks; t++) {
        const template = taskTemplates[Math.floor(Math.random() * taskTemplates.length)];
        const isCurrentWeek = offset === 0;
        const isPastDay = isCurrentWeek ? dayIdx < now.getDay() - 1 || (now.getDay() === 0 && dayIdx < 6) : true;
        sampleTasks.push({
          id: `wt_${weekKey}_${dayIdx}_${t}`,
          text: template,
          completed: isPastDay ? Math.random() > 0.25 : false,
          dayIndex: dayIdx,
        });
      }
    }

    const habitCompletions: Record<string, boolean[]> = {};
    DEFAULT_WEEKLY_HABITS.forEach((h) => {
      habitCompletions[h.id] = Array.from({ length: 7 }, (_, dayIdx) => {
        const isCurrentWeek = offset === 0;
        const isPastDay = isCurrentWeek ? dayIdx < ((now.getDay() + 6) % 7) : true;
        return isPastDay ? Math.random() > 0.35 : false;
      });
    });

    store[weekKey] = {
      weekStartDate: startDate.toISOString().split("T")[0],
      tasks: sampleTasks,
      habits: [...DEFAULT_WEEKLY_HABITS],
      habitCompletions,
      notes: {
        general: offset === 0 ? "Buy bread on the way home\nBrainstorm project ideas\nSign up for driving lessons" : "Review last week\nPlan ahead",
        improvements: offset === 0 ? "Start with the hardest task\nPlan the day the night before\nDrink more water" : "Focus on deep work blocks",
        gratitude: offset === 0 ? "A good book\nA cozy evening at home\nA delicious lunch at a cafe" : "Productive week\nGreat team support",
      },
    };
  }

  return store;
}

export function useHabitStore() {
  // ===== Session & Cloud Status =====
  const { data: session } = useSession();
  const { syncMode, isCloudEnabled } = useCloudStatus();
  const isAuthenticated = !!session;
  // Only interact with Convex when syncMode is "cloud" AND user is authenticated AND cloud is reachable
  const shouldUseCloud = syncMode === "cloud" && isAuthenticated && isCloudEnabled;

  // ===== ALL useState CALLS =====
  const [data, setData] = useState<YearData>(() => {
    const loaded = loadData();
    if (Object.keys(loaded).length === 0) {
      const sample = generateSampleData();
      saveDataLocal(sample);
      return sample;
    }
    return loaded;
  });

  const [weeklyData, setWeeklyData] = useState<WeeklyStore>(() => {
    const loaded = loadWeeklyData();
    if (Object.keys(loaded).length === 0) {
      const sample = generateSampleWeeklyData();
      saveWeeklyDataLocal(sample);
      return sample;
    }
    return loaded;
  });

  const [selectedYear, setSelectedYearState] = useState<number>(() => loadYear());
  const [hasSynced, setHasSynced] = useState(false);

  // ===== Convex queries (only when cloud mode is active) =====
  const cloudMonths = useQuery(api.queries.listHabitMonths, shouldUseCloud ? {} : "skip");
  const cloudWeeks = useQuery(api.queries.listHabitWeeks, shouldUseCloud ? {} : "skip");
  const cloudSettings = useQuery(api.queries.listUserSettings, shouldUseCloud ? {} : "skip");

  // ===== Convex mutations (always declared) =====
  const upsertMonth = useMutation(api.mutations.upsertHabitMonth);
  const upsertWeek = useMutation(api.mutations.upsertHabitWeek);
  const upsertSettings = useMutation(api.mutations.upsertUserSettings);
  const bulkSyncMonths = useMutation(api.mutations.bulkSyncMonths);
  const bulkSyncWeeks = useMutation(api.mutations.bulkSyncWeeks);
  const deleteAllData = useMutation(api.mutations.deleteAllUserData);

  // ===== Ref for debounced cloud saves =====
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weekSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ===== ALL useEffect CALLS =====

  // Sync FROM cloud when data loads (one-time)
  useEffect(() => {
    if (!shouldUseCloud || hasSynced) return;
    if (cloudMonths === undefined || cloudWeeks === undefined || cloudSettings === undefined) return;

    // Cloud has data -> load it into state
    if (cloudMonths.length > 0) {
      const cloudYearData: YearData = {};
      for (const m of cloudMonths) {
        try {
          cloudYearData[m.monthKey] = {
            habits: JSON.parse(m.habits),
            days: JSON.parse(m.days),
          };
        } catch {}
      }
      setData(cloudYearData);
      saveDataLocal(cloudYearData);
    } else {
      // Cloud is empty, upload local data
      const localData = loadData();
      if (Object.keys(localData).length > 0) {
        const months = Object.entries(localData).map(([monthKey, md]) => ({
          monthKey,
          habits: JSON.stringify(md.habits),
          days: JSON.stringify(md.days),
        }));
        bulkSyncMonths({ months }).catch(() => {});
      }
    }

    if (cloudWeeks.length > 0) {
      const cloudWeeklyStore: WeeklyStore = {};
      for (const w of cloudWeeks) {
        try {
          cloudWeeklyStore[w.weekKey] = {
            weekStartDate: w.weekStartDate,
            tasks: JSON.parse(w.tasks),
            habits: JSON.parse(w.habits),
            habitCompletions: JSON.parse(w.habitCompletions),
            notes: JSON.parse(w.notes),
          };
        } catch {}
      }
      setWeeklyData(cloudWeeklyStore);
      saveWeeklyDataLocal(cloudWeeklyStore);
    } else {
      const localWeekly = loadWeeklyData();
      if (Object.keys(localWeekly).length > 0) {
        const weeks = Object.entries(localWeekly).map(([weekKey, wd]) => ({
          weekKey,
          weekStartDate: wd.weekStartDate,
          tasks: JSON.stringify(wd.tasks),
          habits: JSON.stringify(wd.habits),
          habitCompletions: JSON.stringify(wd.habitCompletions),
          notes: JSON.stringify(wd.notes),
        }));
        bulkSyncWeeks({ weeks }).catch(() => {});
      }
    }

    if (cloudSettings && cloudSettings.length > 0) {
      setSelectedYearState(cloudSettings[0].selectedYear);
      saveYear(cloudSettings[0].selectedYear);
    }

    setHasSynced(true);
  }, [shouldUseCloud, hasSynced, cloudMonths, cloudWeeks, cloudSettings, bulkSyncMonths, bulkSyncWeeks]);

  // Save to localStorage whenever data changes
  useEffect(() => {
    saveDataLocal(data);
  }, [data]);

  useEffect(() => {
    saveWeeklyDataLocal(weeklyData);
  }, [weeklyData]);

  // ===== Helper: save month to cloud (debounced) =====
    const saveMonthToCloud = useCallback(
    (monthKey: string, monthData: MonthData) => {
      if (!shouldUseCloud) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        upsertMonth({
          monthKey,
          habits: JSON.stringify(monthData.habits),
          days: JSON.stringify(monthData.days),
        }).catch(() => {});
      }, 500);
    },
    [shouldUseCloud, upsertMonth]
  );

  // ===== Helper: save week to cloud (debounced) =====
    const saveWeekToCloud = useCallback(
    (weekKey: string, weekData: WeeklyData) => {
      if (!shouldUseCloud) return;
      if (weekSaveTimerRef.current) clearTimeout(weekSaveTimerRef.current);
      weekSaveTimerRef.current = setTimeout(() => {
        upsertWeek({
          weekKey,
          weekStartDate: weekData.weekStartDate,
          tasks: JSON.stringify(weekData.tasks),
          habits: JSON.stringify(weekData.habits),
          habitCompletions: JSON.stringify(weekData.habitCompletions),
          notes: JSON.stringify(weekData.notes),
        }).catch(() => {});
      }, 500);
    },
    [shouldUseCloud, upsertWeek]
  );

  // ===== ALL useCallback CALLS =====
  const setSelectedYear = useCallback((year: number) => {
    setSelectedYearState(year);
    saveYear(year);
    if (shouldUseCloud) {
      upsertSettings({ selectedYear: year }).catch(() => {});
    }
  }, [shouldUseCloud, upsertSettings]);

  const getMonthData = useCallback(
    (year: number, month: number): MonthData => {
      const key = getMonthKey(year, month);
      return data[key] || { habits: [], days: {} };
    },
    [data]
  );

  const setMonthHabits = useCallback(
    (year: number, month: number, habits: Habit[]) => {
      const key = getMonthKey(year, month);
      setData((prev) => {
        const updated = {
          ...prev,
          [key]: {
            ...prev[key],
            habits,
            days: prev[key]?.days || {},
          },
        };
        saveMonthToCloud(key, updated[key]);
        return updated;
      });
    },
    [saveMonthToCloud]
  );

  const toggleHabit = useCallback(
    (year: number, month: number, day: number, habitId: string) => {
      const key = getMonthKey(year, month);
      setData((prev) => {
        const monthData = prev[key] || { habits: [...DEFAULT_HABITS], days: {} };
        const dayEntry: DayEntry = monthData.days[day] || {
          completedHabits: [],
          mood: 5,
          motivation: 5,
        };

        const completed = dayEntry.completedHabits.includes(habitId)
          ? dayEntry.completedHabits.filter((id) => id !== habitId)
          : [...dayEntry.completedHabits, habitId];

        const updated = {
          ...prev,
          [key]: {
            ...monthData,
            days: {
              ...monthData.days,
              [day]: { ...dayEntry, completedHabits: completed },
            },
          },
        };
        saveMonthToCloud(key, updated[key]);
        return updated;
      });
    },
    [saveMonthToCloud]
  );

  const setMood = useCallback(
    (year: number, month: number, day: number, mood: number) => {
      const key = getMonthKey(year, month);
      setData((prev) => {
        const monthData = prev[key] || { habits: [...DEFAULT_HABITS], days: {} };
        const dayEntry: DayEntry = monthData.days[day] || {
          completedHabits: [],
          mood: 5,
          motivation: 5,
        };
        const updated = {
          ...prev,
          [key]: {
            ...monthData,
            days: {
              ...monthData.days,
              [day]: { ...dayEntry, mood },
            },
          },
        };
        saveMonthToCloud(key, updated[key]);
        return updated;
      });
    },
    [saveMonthToCloud]
  );

  const setMotivation = useCallback(
    (year: number, month: number, day: number, motivation: number) => {
      const key = getMonthKey(year, month);
      setData((prev) => {
        const monthData = prev[key] || { habits: [...DEFAULT_HABITS], days: {} };
        const dayEntry: DayEntry = monthData.days[day] || {
          completedHabits: [],
          mood: 5,
          motivation: 5,
        };
        const updated = {
          ...prev,
          [key]: {
            ...monthData,
            days: {
              ...monthData.days,
              [day]: { ...dayEntry, motivation },
            },
          },
        };
        saveMonthToCloud(key, updated[key]);
        return updated;
      });
    },
    [saveMonthToCloud]
  );

  const addHabit = useCallback(
    (year: number, month: number, name: string) => {
      const key = getMonthKey(year, month);
      const id = `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setData((prev) => {
        const monthData = prev[key] || { habits: [], days: {} };
        const updated = {
          ...prev,
          [key]: {
            ...monthData,
            habits: [...monthData.habits, { id, name }],
          },
        };
        saveMonthToCloud(key, updated[key]);
        return updated;
      });
    },
    [saveMonthToCloud]
  );

  const removeHabit = useCallback(
    (year: number, month: number, habitId: string) => {
      const key = getMonthKey(year, month);
      setData((prev) => {
        const monthData = prev[key] || { habits: [], days: {} };
        const newDays: Record<number, DayEntry> = {};
        for (const [d, entry] of Object.entries(monthData.days)) {
          newDays[Number(d)] = {
            ...entry,
            completedHabits: entry.completedHabits.filter((id) => id !== habitId),
          };
        }
        const updated = {
          ...prev,
          [key]: {
            habits: monthData.habits.filter((h) => h.id !== habitId),
            days: newDays,
          },
        };
        saveMonthToCloud(key, updated[key]);
        return updated;
      });
    },
    [saveMonthToCloud]
  );

  // ---- Weekly Planner Methods ----

  const getWeekData = useCallback(
    (weekKey: string): WeeklyData | null => {
      return weeklyData[weekKey] || null;
    },
    [weeklyData]
  );

  const initWeek = useCallback(
    (weekKey: string, startDate: Date) => {
      setWeeklyData((prev) => {
        if (prev[weekKey]) return prev;
        const newWeek: WeeklyData = {
          weekStartDate: startDate.toISOString().split("T")[0],
          tasks: [],
          habits: [...DEFAULT_WEEKLY_HABITS],
          habitCompletions: DEFAULT_WEEKLY_HABITS.reduce((acc, h) => {
            acc[h.id] = Array(7).fill(false);
            return acc;
          }, {} as Record<string, boolean[]>),
          notes: { general: "", improvements: "", gratitude: "" },
        };
        const updated = { ...prev, [weekKey]: newWeek };
        saveWeekToCloud(weekKey, newWeek);
        return updated;
      });
    },
    [saveWeekToCloud]
  );

  const addWeeklyTask = useCallback(
    (weekKey: string, text: string, dayIndex: number) => {
      const id = `wt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        const updatedWeek = {
          ...week,
          tasks: [...week.tasks, { id, text, completed: false, dayIndex }],
        };
        const updated = { ...prev, [weekKey]: updatedWeek };
        saveWeekToCloud(weekKey, updatedWeek);
        return updated;
      });
    },
    [saveWeekToCloud]
  );

  const toggleWeeklyTask = useCallback(
    (weekKey: string, taskId: string) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        const updatedWeek = {
          ...week,
          tasks: week.tasks.map((t) =>
            t.id === taskId ? { ...t, completed: !t.completed } : t
          ),
        };
        const updated = { ...prev, [weekKey]: updatedWeek };
        saveWeekToCloud(weekKey, updatedWeek);
        return updated;
      });
    },
    [saveWeekToCloud]
  );

  const moveWeeklyTask = useCallback(
    (weekKey: string, taskId: string, newDayIndex: number) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        const updatedWeek = {
          ...week,
          tasks: week.tasks.map((t) =>
            t.id === taskId ? { ...t, dayIndex: newDayIndex } : t
          ),
        };
        const updated = { ...prev, [weekKey]: updatedWeek };
        saveWeekToCloud(weekKey, updatedWeek);
        return updated;
      });
    },
    [saveWeekToCloud]
  );

  const removeWeeklyTask = useCallback(
    (weekKey: string, taskId: string) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        const updatedWeek = {
          ...week,
          tasks: week.tasks.filter((t) => t.id !== taskId),
        };
        const updated = { ...prev, [weekKey]: updatedWeek };
        saveWeekToCloud(weekKey, updatedWeek);
        return updated;
      });
    },
    [saveWeekToCloud]
  );

  const toggleWeeklyHabit = useCallback(
    (weekKey: string, habitId: string, dayIndex: number) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        const completions = { ...week.habitCompletions };
        const days = [...(completions[habitId] || Array(7).fill(false))];
        days[dayIndex] = !days[dayIndex];
        completions[habitId] = days;
        const updatedWeek = { ...week, habitCompletions: completions };
        const updated = { ...prev, [weekKey]: updatedWeek };
        saveWeekToCloud(weekKey, updatedWeek);
        return updated;
      });
    },
    [saveWeekToCloud]
  );

  const addWeeklyHabit = useCallback(
    (weekKey: string, name: string) => {
      const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        const updatedWeek = {
          ...week,
          habits: [...week.habits, { id, name }],
          habitCompletions: {
            ...week.habitCompletions,
            [id]: Array(7).fill(false),
          },
        };
        const updated = { ...prev, [weekKey]: updatedWeek };
        saveWeekToCloud(weekKey, updatedWeek);
        return updated;
      });
    },
    [saveWeekToCloud]
  );

  const removeWeeklyHabit = useCallback(
    (weekKey: string, habitId: string) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        const completions = { ...week.habitCompletions };
        delete completions[habitId];
        const updatedWeek = {
          ...week,
          habits: week.habits.filter((h) => h.id !== habitId),
          habitCompletions: completions,
        };
        const updated = { ...prev, [weekKey]: updatedWeek };
        saveWeekToCloud(weekKey, updatedWeek);
        return updated;
      });
    },
    [saveWeekToCloud]
  );

  const updateWeeklyNotes = useCallback(
    (weekKey: string, notes: Partial<WeeklyNotes>) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        const updatedWeek = {
          ...week,
          notes: { ...week.notes, ...notes },
        };
        const updated = { ...prev, [weekKey]: updatedWeek };
        saveWeekToCloud(weekKey, updatedWeek);
        return updated;
      });
    },
    [saveWeekToCloud]
  );

  const resetData = useCallback(() => {
    const sample = generateSampleData();
    setData(sample);
    saveDataLocal(sample);
    const weeklySample = generateSampleWeeklyData();
    setWeeklyData(weeklySample);
    saveWeeklyDataLocal(weeklySample);
    if (shouldUseCloud) {
      deleteAllData({}).then(() => {
        // Re-upload sample data
        const months = Object.entries(sample).map(([monthKey, md]) => ({
          monthKey,
          habits: JSON.stringify(md.habits),
          days: JSON.stringify(md.days),
        }));
        bulkSyncMonths({ months }).catch(() => {});
        const weeks = Object.entries(weeklySample).map(([weekKey, wd]) => ({
          weekKey,
          weekStartDate: wd.weekStartDate,
          tasks: JSON.stringify(wd.tasks),
          habits: JSON.stringify(wd.habits),
          habitCompletions: JSON.stringify(wd.habitCompletions),
          notes: JSON.stringify(wd.notes),
        }));
        bulkSyncWeeks({ weeks }).catch(() => {});
      }).catch(() => {});
    }
  }, [shouldUseCloud, deleteAllData, bulkSyncMonths, bulkSyncWeeks]);

  return {
    data,
    weeklyData,
    selectedYear,
    setSelectedYear,
    getMonthData,
    setMonthHabits,
    toggleHabit,
    setMood,
    setMotivation,
    addHabit,
    removeHabit,
    getWeekData,
    initWeek,
    addWeeklyTask,
    toggleWeeklyTask,
    removeWeeklyTask,
    moveWeeklyTask,
    toggleWeeklyHabit,
    addWeeklyHabit,
    removeWeeklyHabit,
    updateWeeklyNotes,
    resetData,
    isAuthenticated,
  };
}
