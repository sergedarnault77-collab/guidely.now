import { createFileRoute } from "@tanstack/react-router";
import { useHabits } from "../lib/context";
import { MONTHS, getDaysInMonth, getFirstDayOfMonth, calculateDailyProgress, calculateMonthProgress, getHabitStats } from "../lib/types";
import { ProgressRing } from "../components/ProgressRing";
import { AreaChart } from "../components/AreaChart";
import { BarChart } from "../components/BarChart";
import { GuestGateModal, useGuestGate } from "../components/GuestGate";
import { useState, useRef } from "react";

function TrackerPage() {
  const { month: searchMonth } = Route.useSearch();
  const now = new Date();
  const {
    selectedYear,
    getMonthData,
    toggleHabit,
    setMood,
    setMotivation,
    addHabit,
    removeHabit,
    activityLogger,
    isAuthenticated,
  } = useHabits();

  const { showModal, closeModal, guard } = useGuestGate(isAuthenticated);

  const [activeMonth, setActiveMonth] = useState(searchMonth || now.getMonth() + 1);
  const [newHabitName, setNewHabitName] = useState("");
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const prevPerfectDays = useRef<Set<string>>(new Set());

  const monthData = getMonthData(selectedYear, activeMonth);
  const daysInMonth = getDaysInMonth(selectedYear, activeMonth);
  const firstDay = getFirstDayOfMonth(selectedYear, activeMonth);
  const stats = calculateMonthProgress(monthData, daysInMonth);
  const monthName = MONTHS[activeMonth - 1];

  const handleAddHabit = () => {
    guard(() => {
      if (newHabitName.trim()) {
        addHabit(selectedYear, activeMonth, newHabitName.trim());
        activityLogger.logHabitAdded(newHabitName.trim(), monthName);
        setNewHabitName("");
        setShowAddHabit(false);
      }
    });
  };

  const handleToggleHabit = (day: number, habitId: string) => {
    guard(() => {
      const entry = monthData.days[day];
      const wasCompleted = entry?.completedHabits?.includes(habitId) || false;
      const habit = monthData.habits.find((h) => h.id === habitId);

      toggleHabit(selectedYear, activeMonth, day, habitId);

      if (habit) {
        if (wasCompleted) {
          activityLogger.logHabitUnchecked(habit.name, day, monthName);
        } else {
          activityLogger.logHabitCompleted(habit.name, day, monthName);

          const completedAfter = [...(entry?.completedHabits || []), habitId];
          const uniqueCompleted = new Set(completedAfter);
          const dayKey = `${selectedYear}-${activeMonth}-${day}`;
          if (uniqueCompleted.size >= monthData.habits.length && !prevPerfectDays.current.has(dayKey)) {
            prevPerfectDays.current.add(dayKey);
            activityLogger.logPerfectDay(monthData.habits.length, day, monthName);
          }
        }
      }
    });
  };

  const handleSetMood = (day: number, mood: number) => {
    guard(() => {
      setMood(selectedYear, activeMonth, day, mood);
      const entry = monthData.days[day];
      const motivation = entry?.motivation || 5;
      activityLogger.logMoodSet(mood, motivation, day, monthName);
    });
  };

  const handleSetMotivation = (day: number, motivation: number) => {
    guard(() => {
      setMotivation(selectedYear, activeMonth, day, motivation);
      const entry = monthData.days[day];
      const mood = entry?.mood || 5;
      activityLogger.logMoodSet(mood, motivation, day, monthName);
    });
  };

  const handleShowAddHabit = () => {
    guard(() => {
      setShowAddHabit(!showAddHabit);
    });
  };

  const handleEditDay = (d: number) => {
    guard(() => {
      setEditingDay(editingDay === d ? null : d);
    });
  };

  // Daily progress data for chart
  const dailyProgressData: number[] = [];
  const dailyMoodData: number[] = [];
  const dayLabels: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    dailyProgressData.push(calculateDailyProgress(monthData.days[d], monthData.habits.length));
    const entry = monthData.days[d];
    dailyMoodData.push(entry ? ((entry.mood + entry.motivation) / 20) * 100 : 0);
    dayLabels.push(String(d));
  }

  // Habit stats for bar chart
  const habitStats = monthData.habits.map((h) => {
    const s = getHabitStats(h.id, monthData, daysInMonth);
    return { ...h, ...s };
  });

  const habitBarData = habitStats.map((h) => ({
    label: h.name.length > 10 ? h.name.slice(0, 10) + "..." : h.name,
    value: h.percentage,
    color: h.percentage >= 70 ? "#22c55e" : h.percentage >= 40 ? "#f59e0b" : "#ef4444",
  }));

  // Weeks organization
  const weeks: number[][] = [];
  let currentWeek: number[] = [];
  for (let i = 0; i < firstDay; i++) {
    currentWeek.push(0);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(0);
    weeks.push(currentWeek);
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <GuestGateModal show={showModal} onClose={closeModal} />

      {/* Month Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">
            {monthName} {selectedYear}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Daily habit tracking & emotional state</p>
        </div>
        <div className="flex flex-wrap gap-1">
          {MONTHS.map((m, i) => (
            <button
              key={i}
              onClick={() => setActiveMonth(i + 1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                activeMonth === i + 1
                  ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
              }`}
            >
              {m.slice(0, 3)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40 flex items-center gap-4">
          <ProgressRing percentage={stats.percentage} size={56} strokeWidth={5}>
            <span className="text-xs font-bold">{Math.round(stats.percentage)}%</span>
          </ProgressRing>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Progress</p>
            <p className="text-lg font-bold">{stats.percentage}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Habits</p>
          <p className="text-2xl font-bold">{monthData.habits.length}</p>
          <p className="text-xs text-gray-400">{stats.completed} completed</p>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Best Day</p>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {dailyProgressData.length > 0 ? Math.max(...dailyProgressData) : 0}%
          </p>
          <p className="text-xs text-gray-400">
            Day {dailyProgressData.indexOf(Math.max(...dailyProgressData)) + 1}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Mood</p>
          <p className="text-2xl font-bold text-pink-500">
            {(() => {
              const moods = Object.values(monthData.days).map((d) => d.mood);
              return moods.length > 0 ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : "—";
            })()}
          </p>
          <p className="text-xs text-gray-400">out of 10</p>
        </div>
      </div>

      {/* Main Grid: Habit Tracker + Sidebar */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Habit Tracking Grid */}
        <div className="xl:col-span-2 bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden">
          {/* Habit Management Header */}
          <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 flex items-center justify-between">
            <h3 className="font-semibold">Habit Checklist</h3>
            <button
              onClick={handleShowAddHabit}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
            >
              {showAddHabit ? "✕ Cancel" : "+ Add Habit"}
            </button>
          </div>

          {showAddHabit && (
            <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 bg-gray-50 dark:bg-gray-800/30 flex gap-2">
              <input
                type="text"
                value={newHabitName}
                onChange={(e) => setNewHabitName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddHabit()}
                placeholder="Enter habit name..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                autoFocus
              />
              <button
                onClick={handleAddHabit}
                className="px-4 py-2 bg-emerald-500 text-white text-sm font-medium rounded-lg hover:bg-emerald-600 transition-colors"
              >
                Add
              </button>
            </div>
          )}

          {monthData.habits.length === 0 ? (
            <div className="p-12 text-center">
              <span className="text-4xl mb-3 block">📝</span>
              <p className="text-gray-500 dark:text-gray-400 font-medium">No habits yet</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add your first habit to start tracking</p>
              <button
                onClick={handleShowAddHabit}
                className="mt-4 px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors"
              >
                + Add Your First Habit
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-200/60 dark:border-gray-700/40">
                    <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400 sticky left-0 bg-white dark:bg-gray-800/50 min-w-[160px]">
                      Habit
                    </th>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const isToday = d === now.getDate() && activeMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
                      return (
                        <th
                          key={d}
                          className={`p-1.5 text-center font-medium min-w-[28px] ${
                            isToday
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {d}
                        </th>
                      );
                    })}
                    <th className="p-3 text-center font-medium text-gray-500 dark:text-gray-400 min-w-[50px]">%</th>
                  </tr>
                </thead>
                <tbody>
                  {monthData.habits.map((habit) => {
                    const hStats = getHabitStats(habit.id, monthData, daysInMonth);
                    return (
                      <tr
                        key={habit.id}
                        className="border-b border-gray-100 dark:border-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="p-3 sticky left-0 bg-white dark:bg-gray-800/50">
                          <div className="flex items-center justify-between group">
                            <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[120px]">
                              {habit.name}
                            </span>
                            <button
                              onClick={() => guard(() => removeHabit(selectedYear, activeMonth, habit.id))}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all ml-1 text-[10px]"
                              title="Remove habit"
                            >
                              ✕
                            </button>
                          </div>
                        </td>
                        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                          const isCompleted = monthData.days[d]?.completedHabits.includes(habit.id) || false;
                          const isToday = d === now.getDate() && activeMonth === now.getMonth() + 1 && selectedYear === now.getFullYear();
                          return (
                            <td key={d} className="p-0.5 text-center">
                              <button
                                onClick={() => handleToggleHabit(d, habit.id)}
                                className={`w-6 h-6 rounded-md flex items-center justify-center transition-all duration-200 text-[11px] ${
                                  isCompleted
                                    ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30 scale-100"
                                    : isToday
                                    ? "bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-300 dark:border-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/40"
                                    : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                                } hover:scale-110`}
                              >
                                {isCompleted ? "✓" : ""}
                              </button>
                            </td>
                          );
                        })}
                        <td className="p-3 text-center">
                          <span className={`font-bold ${
                            hStats.percentage >= 70
                              ? "text-emerald-600 dark:text-emerald-400"
                              : hStats.percentage >= 40
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-red-500"
                          }`}>
                            {hStats.percentage}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Daily Progress Row */}
                  <tr className="bg-gray-50 dark:bg-gray-800/30 font-medium">
                    <td className="p-3 sticky left-0 bg-gray-50 dark:bg-gray-800/30 text-gray-500 dark:text-gray-400">
                      Daily %
                    </td>
                    {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
                      const pct = calculateDailyProgress(monthData.days[d], monthData.habits.length);
                      return (
                        <td key={d} className="p-0.5 text-center">
                          <span className={`text-[10px] ${
                            pct >= 70
                              ? "text-emerald-600 dark:text-emerald-400"
                              : pct >= 40
                              ? "text-amber-600 dark:text-amber-400"
                              : pct > 0
                              ? "text-red-500"
                              : "text-gray-300 dark:text-gray-600"
                          }`}>
                            {pct > 0 ? pct : "—"}
                          </span>
                        </td>
                      );
                    })}
                    <td className="p-3 text-center text-emerald-600 dark:text-emerald-400 font-bold">
                      {stats.percentage}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Mood & Motivation Tracker */}
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
            <h3 className="font-semibold mb-4">Emotional State</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Click a day to set mood & motivation</p>

            {/* Calendar mini view for selecting day */}
            <div className="grid grid-cols-7 gap-1 mb-4">
              {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
                <span key={i} className="text-[10px] text-center text-gray-400 font-medium">{d}</span>
              ))}
              {weeks.flat().map((d, i) => {
                if (d === 0) return <span key={i} />;
                const entry = monthData.days[d];
                const hasMood = entry && (entry.mood !== 5 || entry.motivation !== 5);
                const isSelected = editingDay === d;
                return (
                  <button
                    key={i}
                    onClick={() => handleEditDay(d)}
                    className={`w-full aspect-square rounded-md text-[10px] font-medium transition-all ${
                      isSelected
                        ? "bg-pink-500 text-white scale-110 shadow-md"
                        : hasMood
                        ? "bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            {editingDay !== null && (
              <div className="space-y-4 p-3 bg-gray-50 dark:bg-gray-800/30 rounded-xl">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
                  Day {editingDay} — {monthName}
                </p>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">😊 Mood</span>
                    <span className="text-xs font-bold text-pink-500">
                      {monthData.days[editingDay]?.mood || 5}/10
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={monthData.days[editingDay]?.mood || 5}
                    onChange={(e) => handleSetMood(editingDay, parseInt(e.target.value))}
                    className="w-full accent-pink-500"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-gray-500">🔥 Motivation</span>
                    <span className="text-xs font-bold text-orange-500">
                      {monthData.days[editingDay]?.motivation || 5}/10
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={monthData.days[editingDay]?.motivation || 5}
                    onChange={(e) => handleSetMotivation(editingDay, parseInt(e.target.value))}
                    className="w-full accent-orange-500"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Habit Performance */}
          {monthData.habits.length > 0 && (
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
              <h3 className="font-semibold mb-4">Habit Performance</h3>
              <div className="space-y-3">
                {habitStats
                  .sort((a, b) => b.percentage - a.percentage)
                  .map((h) => (
                    <div key={h.id}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-gray-600 dark:text-gray-400 truncate max-w-[140px]">{h.name}</span>
                        <span className="text-xs font-bold ml-2">
                          {h.actual}/{h.goal}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700 ease-out"
                          style={{
                            width: `${h.percentage}%`,
                            backgroundColor: h.percentage >= 70 ? "#22c55e" : h.percentage >= 40 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts Section */}
      {monthData.habits.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Progress Trend */}
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Daily Trend</h3>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Progress</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400" /> Mood</span>
              </div>
            </div>
            <AreaChart
              labels={dayLabels}
              datasets={[
                { data: dailyProgressData, color: "#22c55e", fillColor: "rgba(34,197,94,0.12)", label: "Progress" },
                { data: dailyMoodData, color: "#f472b6", fillColor: "rgba(244,114,182,0.08)", label: "Mood" },
              ]}
              height={180}
            />
          </div>

          {/* Habit Bar Chart */}
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
            <h3 className="font-semibold mb-3">Habit Completion Rates</h3>
            <BarChart data={habitBarData} maxValue={100} height={180} />
          </div>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/tracker")({
  component: TrackerPage,
  validateSearch: (search: Record<string, unknown>) => ({
    month: (search.month as number | undefined),
  }),
});
