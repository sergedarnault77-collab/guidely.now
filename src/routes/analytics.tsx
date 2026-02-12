import { createFileRoute } from "@tanstack/react-router";
import { useHabits } from "../lib/context";
import { MONTHS, getDaysInMonth, calculateMonthProgress, getHabitStats, calculateDailyProgress, rollupWeekToMonth, getMonthlyRollupSummary } from "../lib/types";
import { AreaChart } from "../components/AreaChart";
import { ProgressRing } from "../components/ProgressRing";
import { BarChart } from "../components/BarChart";
import { useState } from "react";

function AnalyticsPage() {
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
        const s = getHabitStats(habit.id, m.monthData, m.daysInMonth);
        totalActual += s.actual;
        totalGoal += s.goal;
        monthsActive++;
      }
    });
    const percentage = totalGoal > 0 ? Math.round((totalActual / totalGoal) * 100) : 0;
    habitYearlyStats.push({ name: habitName, totalActual, totalGoal, percentage, monthsActive });
  });
  habitYearlyStats.sort((a, b) => b.percentage - a.percentage);

  // Chart data
  const progressData = monthlyData.map((m) => m.percentage);
  const moodData = monthlyData.map((m) => m.avgMood * 10);
  const motivationData = monthlyData.map((m) => m.avgMotivation * 10);
  const consistencyData = monthlyData.map((m) => m.consistency);
  const weeklyTaskData = monthlyData.map((m) => m.rollupSummary.taskPercentage);
  const weeklyHabitData = monthlyData.map((m) => m.rollupSummary.habitPercentage);
  const monthLabels = MONTHS.map((m) => m.slice(0, 3));

  // Insights
  const insights: { emoji: string; text: string; type: "positive" | "neutral" | "warning" }[] = [];
  if (activeMonths.length > 0) {
    const bestMonth = activeMonths.reduce((b, m) => (m.percentage > b.percentage ? m : b));
    const worstMonth = activeMonths.reduce((w, m) => (m.percentage < w.percentage ? m : w));
    insights.push({ emoji: "🏆", text: `Best month: ${bestMonth.name} at ${bestMonth.percentage}%`, type: "positive" });
    if (activeMonths.length > 1) {
      insights.push({ emoji: "📉", text: `Needs work: ${worstMonth.name} at ${worstMonth.percentage}%`, type: "warning" });
    }
    if (overallBestStreak >= 7) {
      insights.push({ emoji: "🔥", text: `Longest streak: ${overallBestStreak} days of 50%+ completion`, type: "positive" });
    }
    if (avgConsistency >= 70) {
      insights.push({ emoji: "💪", text: `Great consistency! ${avgConsistency}% of tracked days hit 50%+ completion`, type: "positive" });
    } else if (avgConsistency >= 40) {
      insights.push({ emoji: "📊", text: `${avgConsistency}% consistency — room for improvement`, type: "neutral" });
    } else {
      insights.push({ emoji: "⚠️", text: `Only ${avgConsistency}% consistency — try focusing on fewer habits`, type: "warning" });
    }
    if (habitYearlyStats.length > 0) {
      const topHabit = habitYearlyStats[0];
      insights.push({ emoji: "⭐", text: `Strongest habit: "${topHabit.name}" at ${topHabit.percentage}%`, type: "positive" });
      if (habitYearlyStats.length > 1) {
        const weakest = habitYearlyStats[habitYearlyStats.length - 1];
        insights.push({ emoji: "🎯", text: `Focus area: "${weakest.name}" at ${weakest.percentage}%`, type: "warning" });
      }
    }
  }
  // Weekly insights
  if (monthsWithWeeklyData.length > 0) {
    insights.push({ emoji: "📋", text: `Weekly tasks: ${totalWeeklyTasksDone}/${totalWeeklyTasks} completed (${weeklyTaskPct}%)`, type: weeklyTaskPct >= 60 ? "positive" : "neutral" });
    if (weeklyHabitPct > 0) {
      insights.push({ emoji: "🔄", text: `Weekly habits: ${weeklyHabitPct}% completion across ${monthsWithWeeklyData.length} month(s)`, type: weeklyHabitPct >= 60 ? "positive" : "neutral" });
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Analytics & Insights</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">Deep dive into your {selectedYear} performance</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowWeeklyRollup(!showWeeklyRollup)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              showWeeklyRollup
                ? "bg-purple-500 text-white shadow-md shadow-purple-500/25"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            📋 Weekly Rollup
          </button>
        </div>
      </div>

      {/* Top Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "Year Progress", value: `${yearPct}%`, emoji: "🎯" },
          { label: "Active Months", value: String(activeMonths.length), emoji: "📅" },
          { label: "Days Tracked", value: String(totalTrackedDays), emoji: "📝" },
          { label: "Best Streak", value: `${overallBestStreak}d`, emoji: "🔥" },
          { label: "Consistency", value: `${avgConsistency}%`, emoji: "💪" },
          { label: "Total Done", value: String(totalCompleted), emoji: "✅" },
        ].map((stat, i) => (
          <div key={i} className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40 text-center">
            <span className="text-2xl block mb-1">{stat.emoji}</span>
            <p className="text-xl font-bold">{stat.value}</p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Weekly Rollup Summary */}
      {showWeeklyRollup && (totalWeeklyTasks > 0 || totalWeeklyHabits > 0) && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-2xl p-5 border border-purple-200/60 dark:border-purple-700/40">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <span>📋</span> Weekly → Monthly Rollup
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
            <div className="bg-white/70 dark:bg-gray-800/50 rounded-xl p-4 text-center">
              <ProgressRing percentage={weeklyTaskPct} size={52} strokeWidth={4} color="#8b5cf6">
                <span className="text-[10px] font-bold">{weeklyTaskPct}%</span>
              </ProgressRing>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2">Task Completion</p>
              <p className="text-[10px] text-gray-400">{totalWeeklyTasksDone}/{totalWeeklyTasks}</p>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/50 rounded-xl p-4 text-center">
              <ProgressRing percentage={weeklyHabitPct} size={52} strokeWidth={4} color="#3b82f6">
                <span className="text-[10px] font-bold">{weeklyHabitPct}%</span>
              </ProgressRing>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2">Habit Completion</p>
              <p className="text-[10px] text-gray-400">{totalWeeklyHabitsDone}/{totalWeeklyHabits}</p>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{monthsWithWeeklyData.length}</p>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">Months with Data</p>
            </div>
            <div className="bg-white/70 dark:bg-gray-800/50 rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                {monthlyData.reduce((s, m) => s + m.rollupSummary.weekCount, 0)}
              </p>
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-1">Weeks Tracked</p>
            </div>
          </div>

          {/* Weekly Task & Habit Trends Chart */}
          <div className="bg-white/70 dark:bg-gray-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold">Weekly Rollup Trends</h4>
              <div className="flex items-center gap-3 text-[10px]">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500" /> Tasks</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Habits</span>
              </div>
            </div>
            <AreaChart
              labels={monthLabels}
              datasets={[
                { data: weeklyTaskData, color: "#8b5cf6", fillColor: "rgba(139,92,246,0.12)", label: "Tasks" },
                { data: weeklyHabitData, color: "#3b82f6", fillColor: "rgba(59,130,246,0.08)", label: "Habits" },
              ]}
              height={180}
            />
          </div>

          {/* Per-Month Weekly Breakdown */}
          {monthsWithWeeklyData.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-purple-200/60 dark:border-purple-700/40">
                    <th className="text-left p-2 font-medium text-gray-500 dark:text-gray-400">Month</th>
                    <th className="text-center p-2 font-medium text-gray-500 dark:text-gray-400">Weeks</th>
                    <th className="text-center p-2 font-medium text-gray-500 dark:text-gray-400">Tasks Done</th>
                    <th className="text-center p-2 font-medium text-gray-500 dark:text-gray-400">Task %</th>
                    <th className="text-center p-2 font-medium text-gray-500 dark:text-gray-400">Habits Done</th>
                    <th className="text-center p-2 font-medium text-gray-500 dark:text-gray-400">Habit %</th>
                    <th className="text-center p-2 font-medium text-gray-500 dark:text-gray-400">Best Week</th>
                  </tr>
                </thead>
                <tbody>
                  {monthsWithWeeklyData.map((m) => (
                    <tr key={m.month} className="border-b border-gray-100 dark:border-gray-800/40 hover:bg-white/50 dark:hover:bg-gray-800/20 transition-colors">
                      <td className="p-2 font-medium">{m.name}</td>
                      <td className="p-2 text-center">{m.rollupSummary.weekCount}</td>
                      <td className="p-2 text-center">{m.rollupSummary.totalTasksCompleted}/{m.rollupSummary.totalTasks}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.rollupSummary.taskPercentage >= 70
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                            : m.rollupSummary.taskPercentage >= 40
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        }`}>
                          {m.rollupSummary.taskPercentage}%
                        </span>
                      </td>
                      <td className="p-2 text-center">{m.rollupSummary.totalHabitsCompleted}/{m.rollupSummary.totalHabits}</td>
                      <td className="p-2 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          m.rollupSummary.habitPercentage >= 70
                            ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                            : m.rollupSummary.habitPercentage >= 40
                            ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                            : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                        }`}>
                          {m.rollupSummary.habitPercentage}%
                        </span>
                      </td>
                      <td className="p-2 text-center text-xs">
                        {m.rollupSummary.bestWeek ? `${m.rollupSummary.bestWeek} (${m.rollupSummary.bestWeekPct}%)` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
          <h3 className="font-semibold mb-3">💡 Key Insights</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {insights.map((insight, i) => (
              <div
                key={i}
                className={`p-3 rounded-xl text-sm ${
                  insight.type === "positive"
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300"
                    : insight.type === "warning"
                    ? "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300"
                    : "bg-gray-50 dark:bg-gray-800/30 text-gray-700 dark:text-gray-300"
                }`}
              >
                <span className="mr-1.5">{insight.emoji}</span>
                {insight.text}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Progress vs Mood</h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Progress</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-pink-400" /> Mood</span>
            </div>
          </div>
          <AreaChart
            labels={monthLabels}
            datasets={[
              { data: progressData, color: "#22c55e", fillColor: "rgba(34,197,94,0.12)", label: "Progress" },
              { data: moodData, color: "#f472b6", fillColor: "rgba(244,114,182,0.08)", label: "Mood" },
            ]}
            height={200}
          />
        </div>

        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">Consistency & Motivation</h3>
            <div className="flex items-center gap-3 text-[10px]">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" /> Consistency</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-400" /> Motivation</span>
            </div>
          </div>
          <AreaChart
            labels={monthLabels}
            datasets={[
              { data: consistencyData, color: "#3b82f6", fillColor: "rgba(59,130,246,0.12)", label: "Consistency" },
              { data: motivationData, color: "#fb923c", fillColor: "rgba(251,146,60,0.08)", label: "Motivation" },
            ]}
            height={200}
          />
        </div>
      </div>

      {/* Habit Yearly Breakdown */}
      {habitYearlyStats.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
          <h3 className="font-semibold mb-4">Habit Performance (Yearly)</h3>
          <div className="space-y-3">
            {habitYearlyStats.map((h, i) => (
              <div key={i} className="flex items-center gap-4">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-40 truncate">{h.name}</span>
                <div className="flex-1 h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${h.percentage}%`,
                      backgroundColor: h.percentage >= 70 ? "#22c55e" : h.percentage >= 40 ? "#f59e0b" : "#ef4444",
                    }}
                  />
                </div>
                <span className={`text-xs font-bold w-12 text-right ${
                  h.percentage >= 70 ? "text-emerald-600 dark:text-emerald-400" : h.percentage >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-500"
                }`}>
                  {h.percentage}%
                </span>
                <span className="text-[10px] text-gray-400 w-16 text-right">{h.totalActual}/{h.totalGoal}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Monthly Comparison Table */}
      {activeMonths.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden">
          <div className="p-5 border-b border-gray-200/60 dark:border-gray-700/40">
            <h3 className="font-semibold">Monthly Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200/60 dark:border-gray-700/40 bg-gray-50 dark:bg-gray-800/30">
                  <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400">Month</th>
                  <th className="text-center p-3 font-medium text-gray-500 dark:text-gray-400">Habits</th>
                  <th className="text-center p-3 font-medium text-gray-500 dark:text-gray-400">Completed</th>
                  <th className="text-center p-3 font-medium text-gray-500 dark:text-gray-400">Progress</th>
                  <th className="text-center p-3 font-medium text-gray-500 dark:text-gray-400">Streak</th>
                  <th className="text-center p-3 font-medium text-gray-500 dark:text-gray-400">Mood</th>
                  <th className="text-center p-3 font-medium text-gray-500 dark:text-gray-400">Motivation</th>
                  <th className="text-center p-3 font-medium text-gray-500 dark:text-gray-400">Consistency</th>
                </tr>
              </thead>
              <tbody>
                {activeMonths.map((m) => (
                  <tr key={m.month} className="border-b border-gray-100 dark:border-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/20 transition-colors">
                    <td className="p-3 font-medium">{m.name}</td>
                    <td className="p-3 text-center">{m.habitCount}</td>
                    <td className="p-3 text-center">{m.completed}</td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-16 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${m.percentage}%`,
                              backgroundColor: m.percentage >= 70 ? "#22c55e" : m.percentage >= 40 ? "#f59e0b" : "#ef4444",
                            }}
                          />
                        </div>
                        <span className="text-xs font-bold">{m.percentage}%</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">{m.bestStreak}d</td>
                    <td className="p-3 text-center">{m.avgMood || "—"}</td>
                    <td className="p-3 text-center">{m.avgMotivation || "—"}</td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        m.consistency >= 70
                          ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                          : m.consistency >= 40
                          ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"
                          : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
                      }`}>
                        {m.consistency}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeMonths.length === 0 && !monthsWithWeeklyData.length && (
        <div className="text-center py-16">
          <span className="text-5xl block mb-4">📊</span>
          <h3 className="text-xl font-semibold text-gray-600 dark:text-gray-400">No data yet</h3>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-2">Start tracking habits to see your analytics here</p>
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/analytics")({
  component: AnalyticsPage,
});
