import { useState, useCallback, useEffect } from "react";
import type { YearData, MonthData, DayEntry, Habit, WeeklyStore, WeeklyData, WeeklyTask, WeeklyNotes } from "./types";
import { getMonthKey, getWeekKey, getWeekStartDate, DEFAULT_HABITS, DEFAULT_WEEKLY_HABITS } from "./types";

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

  const taskTemplates = [
    "Create a development plan", "Reels script", "Analyze the marketing report",
    "Finish the project proposal", "Set up website traffic", "Pay the targeting specialist",
    "Organize personal finances", "Write 10 content ideas", "Prepare the commercial proposal",
    "Review subscriptions", "Organize the workspace", "Call team meeting",
    "Renew gym membership", "Update portfolio", "Research competitors",
    "Plan social media posts", "Review monthly budget", "Send client invoices",
  ];

  for (let offset = -2; offset <= 0; offset++) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset * 7);
    const weekKey = getWeekKey(d);
    const startDate = getWeekStartDate(d);

    const sampleTasks: WeeklyTask[] = [];

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

/**
 * Pure localStorage habit store — zero Convex imports.
 * Used when shouldUseCloud is false.
 */
export function useLocalHabitStore() {
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

  // Persist to localStorage on change
  useEffect(() => { saveDataLocal(data); }, [data]);
  useEffect(() => { saveWeeklyDataLocal(weeklyData); }, [weeklyData]);

  const setSelectedYear = useCallback((year: number) => {
    setSelectedYearState(year);
    saveYear(year);
  }, []);

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
      setData((prev) => ({
        ...prev,
        [key]: { ...prev[key], habits, days: prev[key]?.days || {} },
      }));
    },
    []
  );

  const toggleHabit = useCallback(
    (year: number, month: number, day: number, habitId: string) => {
      const key = getMonthKey(year, month);
      setData((prev) => {
        const monthData = prev[key] || { habits: [...DEFAULT_HABITS], days: {} };
        const dayEntry: DayEntry = monthData.days[day] || { completedHabits: [], mood: 5, motivation: 5 };
        const completed = dayEntry.completedHabits.includes(habitId)
          ? dayEntry.completedHabits.filter((id) => id !== habitId)
          : [...dayEntry.completedHabits, habitId];
        return {
          ...prev,
          [key]: {
            ...monthData,
            days: { ...monthData.days, [day]: { ...dayEntry, completedHabits: completed } },
          },
        };
      });
    },
    []
  );

  const setMood = useCallback(
    (year: number, month: number, day: number, mood: number) => {
      const key = getMonthKey(year, month);
      setData((prev) => {
        const monthData = prev[key] || { habits: [...DEFAULT_HABITS], days: {} };
        const dayEntry: DayEntry = monthData.days[day] || { completedHabits: [], mood: 5, motivation: 5 };
        return {
          ...prev,
          [key]: { ...monthData, days: { ...monthData.days, [day]: { ...dayEntry, mood } } },
        };
      });
    },
    []
  );

  const setMotivation = useCallback(
    (year: number, month: number, day: number, motivation: number) => {
      const key = getMonthKey(year, month);
      setData((prev) => {
        const monthData = prev[key] || { habits: [...DEFAULT_HABITS], days: {} };
        const dayEntry: DayEntry = monthData.days[day] || { completedHabits: [], mood: 5, motivation: 5 };
        return {
          ...prev,
          [key]: { ...monthData, days: { ...monthData.days, [day]: { ...dayEntry, motivation } } },
        };
      });
    },
    []
  );

  const addHabit = useCallback(
    (year: number, month: number, name: string) => {
      const key = getMonthKey(year, month);
      const id = `h_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setData((prev) => {
        const monthData = prev[key] || { habits: [], days: {} };
        return { ...prev, [key]: { ...monthData, habits: [...monthData.habits, { id, name }] } };
      });
    },
    []
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
        return { ...prev, [key]: { habits: monthData.habits.filter((h) => h.id !== habitId), days: newDays } };
      });
    },
    []
  );

  const getWeekData = useCallback(
    (weekKey: string): WeeklyData | null => weeklyData[weekKey] || null,
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
        return { ...prev, [weekKey]: newWeek };
      });
    },
    []
  );

  const addWeeklyTask = useCallback(
    (weekKey: string, text: string, dayIndex: number) => {
      const id = `wt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        return { ...prev, [weekKey]: { ...week, tasks: [...week.tasks, { id, text, completed: false, dayIndex }] } };
      });
    },
    []
  );

  const toggleWeeklyTask = useCallback(
    (weekKey: string, taskId: string) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        return { ...prev, [weekKey]: { ...week, tasks: week.tasks.map((t) => t.id === taskId ? { ...t, completed: !t.completed } : t) } };
      });
    },
    []
  );

  const moveWeeklyTask = useCallback(
    (weekKey: string, taskId: string, newDayIndex: number) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        return { ...prev, [weekKey]: { ...week, tasks: week.tasks.map((t) => t.id === taskId ? { ...t, dayIndex: newDayIndex } : t) } };
      });
    },
    []
  );

  const removeWeeklyTask = useCallback(
    (weekKey: string, taskId: string) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        return { ...prev, [weekKey]: { ...week, tasks: week.tasks.filter((t) => t.id !== taskId) } };
      });
    },
    []
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
        return { ...prev, [weekKey]: { ...week, habitCompletions: completions } };
      });
    },
    []
  );

  const addWeeklyHabit = useCallback(
    (weekKey: string, name: string) => {
      const id = `wh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        return {
          ...prev,
          [weekKey]: {
            ...week,
            habits: [...week.habits, { id, name }],
            habitCompletions: { ...week.habitCompletions, [id]: Array(7).fill(false) },
          },
        };
      });
    },
    []
  );

  const removeWeeklyHabit = useCallback(
    (weekKey: string, habitId: string) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        const completions = { ...week.habitCompletions };
        delete completions[habitId];
        return {
          ...prev,
          [weekKey]: { ...week, habits: week.habits.filter((h) => h.id !== habitId), habitCompletions: completions },
        };
      });
    },
    []
  );

  const updateWeeklyNotes = useCallback(
    (weekKey: string, notes: Partial<WeeklyNotes>) => {
      setWeeklyData((prev) => {
        const week = prev[weekKey];
        if (!week) return prev;
        return { ...prev, [weekKey]: { ...week, notes: { ...week.notes, ...notes } } };
      });
    },
    []
  );

  const resetData = useCallback(() => {
    const sample = generateSampleData();
    setData(sample);
    saveDataLocal(sample);
    const weeklySample = generateSampleWeeklyData();
    setWeeklyData(weeklySample);
    saveWeeklyDataLocal(weeklySample);
  }, []);

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
    isAuthenticated: false,
  };
}
