import { createFileRoute } from "@tanstack/react-router";
import { useHabits } from "../lib/context";
import { useCloudStatus } from "../lib/cloud-status";
import {
  getWeekKey,
  getWeekStartDate,
  getWeekDates,
  formatWeekRange,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  calculateWeeklyTaskProgress,
  calculateWeeklyOverallProgress,
  calculateWeeklyHabitProgress,
} from "../lib/types";
import { ProgressRing } from "../components/ProgressRing";
import { BarChart } from "../components/BarChart";
import { AIWeeklyBanner } from "../components/AIWeeklyBanner";
import { UpgradeGate } from "../lib/subscription";
import { GuestGateModal, useGuestGate } from "../components/GuestGate";
import { useState, useEffect } from "react";

function WeeklyPlannerContent() {
  const now = new Date();
  const {
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
    isAuthenticated,
  } = useHabits();

  const { showModal, closeModal, guard } = useGuestGate(isAuthenticated);

  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [newTaskTexts, setNewTaskTexts] = useState<Record<number, string>>({});
  const [showAddHabit, setShowAddHabit] = useState(false);
  const [newHabitName, setNewHabitName] = useState("");
  const [activeTab, setActiveTab] = useState<"tasks" | "habits" | "notes">("tasks");

  const weekKey = getWeekKey(currentDate);
  const weekStart = getWeekStartDate(currentDate);
  const weekDates = getWeekDates(weekStart);

  useEffect(() => {
    initWeek(weekKey, weekStart);
  }, [weekKey, weekStart, initWeek]);

  const weekData = getWeekData(weekKey);

  const navigateWeek = (offset: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset * 7);
    setCurrentDate(d);
  };

  const goToToday = () => setCurrentDate(new Date());

  if (!weekData) return null;

  const overallTaskProgress = calculateWeeklyOverallProgress(weekData.tasks);
  const habitProgress = calculateWeeklyHabitProgress(weekData.habitCompletions);
  const overallTaskProgressPercent = Math.round(overallTaskProgress * 100) / 100;
  const habitProgressPercent = Math.round(habitProgress * 100) / 100;

  const dailyBarData = WEEKDAY_SHORT.map((label, i) => {
    const p = calculateWeeklyTaskProgress(weekData.tasks, i);
    return {
      label,
      value: p.percentage,
      color: p.percentage >= 70 ? "#22c55e" : p.percentage >= 40 ? "#f59e0b" : p.total === 0 ? "#d1d5db" : "#ef4444",
    };
  });

  const handleAddTask = (dayIndex: number) => {
    guard(() => {
      const text = newTaskTexts[dayIndex]?.trim();
      if (text) {
        addWeeklyTask(weekKey, text, dayIndex);
        setNewTaskTexts((prev) => ({ ...prev, [dayIndex]: "" }));
      }
    });
  };

  const handleAddHabit = () => {
    guard(() => {
      if (newHabitName.trim() && weekData.habits.length < 8) {
        addWeeklyHabit(weekKey, newHabitName.trim());
        setNewHabitName("");
        setShowAddHabit(false);
      }
    });
  };

  const isToday = (date: Date) =>
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <GuestGateModal show={showModal} onClose={closeModal} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Weekly Planner</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {formatWeekRange(weekStart)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek(-1)}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            ← Prev
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors text-sm font-medium"
          >
            Today
          </button>
          <button
            onClick={() => navigateWeek(1)}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors text-sm font-medium"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tasks</p>
          <p className="text-2xl font-bold">{weekData.tasks.length}</p>
          <p className="text-xs text-gray-400">
            {weekData.tasks.filter((t) => t.completed).length} done
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Progress</p>
          <p className="text-2xl font-bold">{overallTaskProgressPercent}%</p>
          <p className="text-xs text-gray-400">week completion</p>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Habits</p>
          <p className="text-2xl font-bold">{weekData.habits.length}</p>
          <p className="text-xs text-gray-400">tracked</p>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Habit Progress</p>
          <p className="text-2xl font-bold">{habitProgressPercent}%</p>
          <p className="text-xs text-gray-400">completion</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200/60 dark:border-gray-700/40">
        {(["tasks", "habits", "notes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
              activeTab === tab
                ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          {weekDates.map((date, dayIndex) => {
            const dayTasks = weekData.tasks.filter((t) => t.dayIndex === dayIndex);
            const isCurrentDay = isToday(date);

            return (
              <div
                key={dayIndex}
                className={`rounded-2xl border p-5 ${
                  isCurrentDay
                    ? "bg-indigo-50 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40"
                    : "bg-white dark:bg-gray-800/50 border-gray-200/60 dark:border-gray-700/40"
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-semibold">
                      {WEEKDAY_NAMES[dayIndex]} {date.getDate()}
                    </h3>
                    {isCurrentDay && <p className="text-xs text-indigo-600 dark:text-indigo-400">Today</p>}
                  </div>
                  <div className="text-sm font-medium text-gray-500">
                    {dayTasks.filter((t) => t.completed).length}/{dayTasks.length}
                  </div>
                </div>

                <div className="space-y-2 mb-3">
                  {dayTasks.map((task) => (
                    <div key={task.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <button
                        onClick={() =>
                          guard(() => {
                            toggleWeeklyTask(weekKey, task.id);
                          })
                        }
                        className={`flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                          task.completed
                            ? "bg-emerald-500 border-emerald-500 text-white"
                            : "border-gray-300 dark:border-gray-600 hover:border-emerald-500"
                        }`}
                      >
                        {task.completed && "✓"}
                      </button>
                      <span
                        className={`flex-1 text-sm ${
                          task.completed
                            ? "line-through text-gray-400 dark:text-gray-500"
                            : "text-gray-700 dark:text-gray-300"
                        }`}
                      >
                        {task.text}
                      </span>
                      <button
                        onClick={() =>
                          guard(() => {
                            removeWeeklyTask(weekKey, task.id);
                          })
                        }
                        className="text-gray-400 hover:text-red-500 transition-colors text-xs"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newTaskTexts[dayIndex] || ""}
                    onChange={(e) => setNewTaskTexts((prev) => ({ ...prev, [dayIndex]: e.target.value }))}
                    onKeyDown={(e) => e.key === "Enter" && handleAddTask(dayIndex)}
                    placeholder="Add task..."
                    className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                  <button
                    onClick={() => handleAddTask(dayIndex)}
                    className="px-3 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeTab === "habits" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Weekly Habits</h3>
              <button
                onClick={() => setShowAddHabit(!showAddHabit)}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors"
              >
                {showAddHabit ? "✕" : "+ Add"}
              </button>
            </div>

            {showAddHabit && (
              <div className="mb-4 flex gap-2">
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddHabit()}
                  placeholder="Habit name..."
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  autoFocus
                />
                <button
                  onClick={handleAddHabit}
                  className="px-4 py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  Add
                </button>
              </div>
            )}

            {weekData.habits.length === 0 ? (
              <p className="text-sm text-gray-500 dark:text-gray-400">No habits tracked this week</p>
            ) : (
              <div className="space-y-3">
                {weekData.habits.map((habit) => {
                  const completions = weekData.habitCompletions[habit.id] || [];
                  const completionRate = (completions.length / 7) * 100;

                  return (
                    <div key={habit.id} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/30">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{habit.name}</span>
                        <button
                          onClick={() =>
                            guard(() => {
                              removeWeeklyHabit(weekKey, habit.id);
                            })
                          }
                          className="text-gray-400 hover:text-red-500 transition-colors text-xs"
                        >
                          ✕
                        </button>
                      </div>
                      <div className="flex gap-1">
                        {WEEKDAY_SHORT.map((_, dayIndex) => {
                          const isCompleted = weekData.habitCompletions[habit.id]?.includes(dayIndex) || false;
                          return (
                            <button
                              key={dayIndex}
                              onClick={() =>
                                guard(() => {
                                  toggleWeeklyHabit(weekKey, habit.id, dayIndex);
                                })
                              }
                              className={`flex-1 h-8 rounded-md transition-all text-xs font-medium ${
                                isCompleted
                                  ? "bg-emerald-500 text-white"
                                  : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
                              }`}
                            >
                              {WEEKDAY_SHORT[dayIndex][0]}
                            </button>
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                        {completions.length}/7 days • {Math.round(completionRate)}%
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "notes" && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
          <h3 className="font-semibold mb-4">Weekly Notes</h3>
          <textarea
            value={weekData.notes}
            onChange={(e) =>
              guard(() => {
                updateWeeklyNotes(weekKey, e.target.value);
              })
            }
            placeholder="Reflect on your week, set intentions, or note anything important..."
            className="w-full h-48 p-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none"
          />
        </div>
      )}

      {/* AI Banner */}
      <UpgradeGate feature="ai_weekly_planner">
        <AIWeeklyBanner weekData={weekData} />
      </UpgradeGate>

      {/* Weekly Chart */}
      {weekData.tasks.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
          <h3 className="font-semibold mb-4">Daily Progress</h3>
          <BarChart data={dailyBarData} maxValue={100} height={180} />
        </div>
      )}
    </div>
  );
}

function WeeklyPlannerPage() {
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

  return <WeeklyPlannerContent />;
}

export const Route = createFileRoute("/weekly")({
  component: WeeklyPlannerPage,
});
