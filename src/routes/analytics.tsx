import { createFileRoute } from "@tanstack/react-router";
import { useHabits } from "../lib/context";
import { useCloudStatus } from "../lib/cloud-status";
import { MONTHS, getDaysInMonth, calculateMonthProgress, getHabitStats, calculateDailyProgress, rollupWeekToMonth, getMonthlyRollupSummary } from "../lib/types";
import { AreaChart } from "../components/AreaChart";
import { ProgressRing } from "../components/ProgressRing";
import { BarChart } from "../components/BarChart";
import { useState } from "react";

function AnalyticsContent() {
  const { data, weeklyData, selectedYear } = useHabits();
  const [showWeeklyRollup, setShowWeeklyRollup] = useState(true);

  // Gather all unique habits across the year
  const allHabitNames = new Set<string>();
  const monthlyData = MONTHS.map((name, i) => {
    const month = i + 1;
    const key = `${selectedYear}-${String(month).padStart(2, "0")}`;
    const monthData = data[key] || { habits: [], days: {} };
    const daysInMonth = getDaysInMonth(selectedYear, month);
    const stats = calculateMonthProgress(monthData, daysInMonth);
    monthData.habits.forEach((h) => allHabitNames.add(h.name));

    // Streaks
    let bestStreak = 0;
    let tempStreak = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const pct = calculateDailyProgress(monthData.days[d], monthData.habits.length);
      if (pct >= 50) {
        tempStreak++;
        bestStreak = Math.max(bestStreak, tempStreak);
      } else {
        tempStreak = 0;
      }
    }
    const currentStreak = tempStreak;

    // Average mood & motivation
    const entries = Object.values(monthData.days);
    const avgMood = entries.length > 0 ? entries.reduce((s, e) => s + e.mood, 0) / entries.length : 0;
    const avgMotivation = entries.length > 0 ? entries.reduce((s, e) => s + e.motivation, 0) / entries.length : 0;

    // Consistency
    let consistentDays = 0;
    let trackedDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      if (monthData.days[d]) {
        trackedDays++;
        if (calculateDailyProgress(monthData.days[d], monthData.habits.length) >= 50) {
          consistentDays++;
        }
      }
    }
    const consistency = trackedDays > 0 ? Math.round((consistentDays / trackedDays) * 100) : 0;

    // Weekly rollup for this month
    const weeklyRollups = rollupWeekToMonth(weeklyData, selectedYear, month);
    const rollupSummary = getMonthlyRollupSummary(weeklyRollups);

    return {
      name,
      month,
      ...stats,
      habitCount: monthData.habits.length,
      bestStreak,
      currentStreak,
      avgMood: Math.round(avgMood * 10) / 10,
      avgMotivation: Math.round(avgMotivation * 10) / 10,
      consistency,
      trackedDays,
      monthData,
      daysInMonth,
      weeklyRollups,
      rollupSummary,
    };
  });

  const activeMonths = monthlyData.filter((m) => m.total > 0);
  const totalCompleted = monthlyData.reduce((s, m) => s + m.completed, 0);
  const totalPossible = monthlyData.reduce((s, m) => s + m.total, 0);
  const yearPct = totalPossible > 0 ? Math.round((totalCompleted / totalPossible) * 100) : 0;
  const overallBestStreak = Math.max(...monthlyData.map((m) => m.bestStreak), 0);
  const avgConsistency = activeMonths.length > 0
    ? Math.round(activeMonths.reduce((s, m) => s + m.consistency, 0) / activeMonths.length)
    : 0;
  const totalTrackedDays = monthlyData.reduce((s, m) => s + m.trackedDays, 0);

  // Weekly rollup totals
  const totalWeeklyTasks = monthlyData.reduce((s, m) => s + m.rollupSummary.totalTasks, 0);
  const totalWeeklyTasksDone = monthlyData.reduce((s, m) => s + m.rollupSummary.totalTasksCompleted, 0);
  const weeklyTaskPct = totalWeeklyTasks > 0 ? Math.round((totalWeeklyTasksDone / totalWeeklyTasks) * 100) : 0;
  const totalWeeklyHabits = monthlyData.reduce((s, m) => s + m.rollupSummary.totalHabits, 0);
  const totalWeeklyHabitsDone = monthlyData.reduce((s, m) => s + m.rollupSummary.totalHabitsCompleted, 0);
  const weeklyHabitPct = totalWeeklyHabits > 0 ? Math.round((totalWeeklyHabitsDone / totalWeeklyHabits) * 100) : 0;
  const monthsWithWeeklyData = monthlyData.filter((m) => m.rollupSummary.totalTasks > 0 || m.rollupSummary.totalHabits > 0);

  // Habit-level yearly analysis
  const habitYearlyStats: { name: string; totalActual: number; totalGoal: number; percentage: number; monthsActive: number }[] = [];
  allHabitNames.forEach((habitName) => {
    let totalActual = 0;
    let totalGoal = 0;
    let monthsActive = 0;

    monthlyData.forEach((m) => {
      const habit = m.monthData.habits.find((h) => h.name === habitName);
      if (habit) {
        monthsActive++;
        const hStats = getHabitStats(habit.id, m.monthData, m.daysInMonth);
        totalActual += hStats.actual;
        totalGoal += hStats.goal;
      }
    });

    if (totalGoal > 0) {
      habitYearlyStats.push({
        name: habitName,
        totalActual,
        totalGoal,
        percentage: Math.round((totalActual / totalGoal) * 100),
        monthsActive,
      });
    }
  });

  habitYearlyStats.sort((a, b) => b.percentage - a.percentage);

  // Chart data
  const monthlyProgressData = monthlyData.map((m) => m.percentage);
  const monthlyConsistencyData = monthlyData.map((m) => m.consistency);
  const monthLabels = MONTHS.map((m) => m.slice(0, 3));

  const habitBarData = habitYearlyStats.slice(0, 8).map((h) => ({
    label: h.name.length > 12 ? h.name.slice(0, 12) + "..." : h.name,
    value: h.percentage,
    color: h.percentage >= 70 ? "#22c55e" : h.percentage >= 40 ? "#f59e0b" : "#ef4444",
  }));

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analytics</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">Year {selectedYear} performance overview</p>
      </div>

      {/* Year Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40 flex items-center gap-4">
          <ProgressRing percentage={yearPct} size={56} strokeWidth={5}>
            <span className="text-xs font-bold">{yearPct}%</span>
          </ProgressRing>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Year Progress</p>
            <p className="text-lg font-bold">{yearPct}%</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Best Streak</p>
          <p className="text-2xl font-bold">{overallBestStreak}</p>
          <p className="text-xs text-gray-400">days</p>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Avg Consistency</p>
          <p className="text-2xl font-bold">{avgConsistency}%</p>
          <p className="text-xs text-gray-400">across months</p>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Days Tracked</p>
          <p className="text-2xl font-bold">{totalTrackedDays}</p>
          <p className="text-xs text-gray-400">this year</p>
        </div>
      </div>

      {/* Monthly Trends */}
      {activeMonths.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
          <h3 className="font-semibold mb-4">Monthly Trends</h3>
          <AreaChart
            labels={monthLabels}
            datasets={[
              { data: monthlyProgressData, color: "#22c55e", fillColor: "rgba(34,197,94,0.12)", label: "Progress" },
              { data: monthlyConsistencyData, color: "#3b82f6", fillColor: "rgba(59,130,246,0.08)", label: "Consistency" },
            ]}
            height={200}
          />
        </div>
      )}

      {/* Habit Performance */}
      {habitYearlyStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
          <h3 className="font-semibold mb-4">Habit Performance</h3>
          <BarChart data={habitBarData} maxValue={100} height={200} />
          <div className="mt-4 space-y-2">
            {habitYearlyStats.slice(0, 5).map((h) => (
              <div key={h.name} className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">{h.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">
                    {h.totalActual}/{h.totalGoal}
                  </span>
                  <span className={`font-bold ${
                    h.percentage >= 70
                      ? "text-emerald-600 dark:text-emerald-400"
                      : h.percentage >= 40
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-red-500"
                  }`}>
                    {h.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Rollup */}
      {monthsWithWeeklyData.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Weekly Planning</h3>
            <button
              onClick={() => setShowWeeklyRollup(!showWeeklyRollup)}
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300"
            >
              {showWeeklyRollup ? "Hide" : "Show"}
            </button>
          </div>
          {showWeeklyRollup && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weekly Tasks</p>
                <p className="text-xl font-bold">{totalWeeklyTasks}</p>
                <p className="text-xs text-gray-400">{totalWeeklyTasksDone} completed</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Task Completion</p>
                <p className="text-xl font-bold">{weeklyTaskPct}%</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Weekly Habits</p>
                <p className="text-xl font-bold">{totalWeeklyHabits}</p>
                <p className="text-xs text-gray-400">{totalWeeklyHabitsDone} completed</p>
              </div>
              <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Habit Completion</p>
                <p className="text-xl font-bold">{weeklyHabitPct}%</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Monthly Breakdown */}
      {activeMonths.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
          <h3 className="font-semibold mb-4">Monthly Breakdown</h3>
          <div className="space-y-3">
            {monthlyData.map((m) => (
              m.total > 0 && (
                <div key={m.month} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{m.name}</span>
                    <span className={`text-sm font-bold ${
                      m.percentage >= 70
                        ? "text-emerald-600 dark:text-emerald-400"
                        : m.percentage >= 40
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-red-500"
                    }`}>
                      {m.percentage}%
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{
                        width: `${m.percentage}%`,
                        backgroundColor: m.percentage >= 70 ? "#22c55e" : m.percentage >= 40 ? "#f59e0b" : "#ef4444",
                      }}
                    />
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>{m.completed}/{m.total} completed</span>
                    <span>Consistency: {m.consistency}%</span>
                  </div>
                </div>
              )
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AnalyticsPage() {
  const { checking } = useCloudStatus();

  if (checking) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
        <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg mb-4" />
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800/50" />
          ))}
        </div>
      </div>
    );
  }

  return <AnalyticsContent />;
}

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});
