import { createFileRoute } from "@tanstack/react-router";
import { useHabits } from "../lib/context";
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

function WeeklyPlannerPage() {
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

  const isCurrentWeek = getWeekKey(now) === weekKey;

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <GuestGateModal show={showModal} onClose={closeModal} />

      {/* AI Weekly Rebalancing Banner */}
      <UpgradeGate feature="aiWeeklyPlanning" featureLabel="AI Weekly Planning & Rebalancing">
        <AIWeeklyBanner
          weekData={weekData}
          weekKey={weekKey}
          onMoveTask={moveWeeklyTask}
          onRemoveTask={removeWeeklyTask}
        />
      </UpgradeGate>

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
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            ◀
          </button>
          <button
            onClick={goToToday}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              isCurrentWeek
                ? "bg-emerald-500 text-white shadow-md shadow-emerald-500/25"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            }`}
          >
            This Week
          </button>
          <button
            onClick={() => navigateWeek(1)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-sm font-medium"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40 flex items-center gap-4">
          <ProgressRing percentage={overallTaskProgress.percentage} size={56} strokeWidth={5}>
            <span className="text-xs font-bold">{overallTaskProgress.percentage}%</span>
          </ProgressRing>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Tasks</p>
            <p className="text-lg font-bold">{overallTaskProgress.completed}/{overallTaskProgress.total}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40 flex items-center gap-4">
          <ProgressRing percentage={habitProgress.percentage} size={56} strokeWidth={5} color="#8b5cf6">
            <span className="text-xs font-bold">{habitProgress.percentage}%</span>
          </ProgressRing>
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400">Habits</p>
            <p className="text-lg font-bold">{habitProgress.completed}/{habitProgress.total}</p>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Best Day</p>
          {(() => {
            let bestIdx = 0;
            let bestPct = 0;
            for (let i = 0; i < 7; i++) {
              const p = calculateWeeklyTaskProgress(weekData.tasks, i);
              if (p.percentage > bestPct) { bestPct = p.percentage; bestIdx = i; }
            }
            return (
              <>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{bestPct}%</p>
                <p className="text-xs text-gray-400">{WEEKDAY_NAMES[bestIdx]}</p>
              </>
            );
          })()}
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tracked Habits</p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{weekData.habits.length}</p>
          <p className="text-xs text-gray-400">of 8 max</p>
        </div>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800/50 rounded-xl p-1">
        {(["tasks", "habits", "notes"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab
                ? "bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            {tab === "tasks" ? "📋 Tasks" : tab === "habits" ? "✅ Habits" : "📝 Notes"}
          </button>
        ))}
      </div>

      {/* Tasks Tab */}
      {activeTab === "tasks" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-7 gap-4">
            {weekDates.map((date, dayIdx) => {
              const dayTasks = weekData.tasks.filter((t) => t.dayIndex === dayIdx);
              const dayProgress = calculateWeeklyTaskProgress(weekData.tasks, dayIdx);
              const today = isToday(date);

              return (
                <div
                  key={dayIdx}
                  className={`bg-white dark:bg-gray-800/50 rounded-2xl border overflow-hidden transition-all ${
                    today
                      ? "border-emerald-300 dark:border-emerald-700 ring-2 ring-emerald-500/20"
                      : "border-gray-200/60 dark:border-gray-700/40"
                  }`}
                >
                  <div className={`p-3 border-b border-gray-200/60 dark:border-gray-700/40 ${
                    today ? "bg-emerald-50 dark:bg-emerald-900/20" : ""
                  }`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className={`text-xs font-bold uppercase tracking-wider ${
                          today ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"
                        }`}>
                          {WEEKDAY_SHORT[dayIdx]}
                        </p>
                        <p className={`text-lg font-bold ${today ? "text-emerald-700 dark:text-emerald-300" : ""}`}>
                          {date.getDate()}
                        </p>
                      </div>
                      {dayProgress.total > 0 && (
                        <div className="text-right">
                          <p className={`text-sm font-bold ${
                            dayProgress.percentage >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                            dayProgress.percentage >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-500"
                          }`}>
                            {dayProgress.percentage}%
                          </p>
                          <p className="text-[10px] text-gray-400">{dayProgress.completed}/{dayProgress.total}</p>
                        </div>
                      )}
                    </div>
                    {dayProgress.total > 0 && (
                      <div className="mt-2 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${dayProgress.percentage}%`,
                            backgroundColor: dayProgress.percentage >= 70 ? "#22c55e" : dayProgress.percentage >= 40 ? "#f59e0b" : "#ef4444",
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <div className="p-2 space-y-1 min-h-[100px] max-h-[300px] overflow-y-auto">
                    {dayTasks.map((task) => (
                      <div
                        key={task.id}
                        className="group flex items-start gap-2 p-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors"
                      >
                        <button
                          onClick={() => guard(() => toggleWeeklyTask(weekKey, task.id))}
                          className={`mt-0.5 w-4 h-4 rounded flex-shrink-0 flex items-center justify-center transition-all text-[10px] ${
                            task.completed
                              ? "bg-emerald-500 text-white"
                              : "border border-gray-300 dark:border-gray-600 hover:border-emerald-400"
                          }`}
                        >
                          {task.completed ? "✓" : ""}
                        </button>
                        <span className={`text-xs flex-1 leading-relaxed ${
                          task.completed ? "line-through text-gray-400 dark:text-gray-500" : "text-gray-700 dark:text-gray-300"
                        }`}>
                          {task.text}
                        </span>
                        <button
                          onClick={() => guard(() => removeWeeklyTask(weekKey, task.id))}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 text-[10px] transition-opacity flex-shrink-0"
                        >
                          ✕
                        </button>
                      </div>
                    ))}

                    {dayTasks.length === 0 && (
                      <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center py-4">No tasks</p>
                    )}
                  </div>

                  <div className="p-2 border-t border-gray-100 dark:border-gray-800/40">
                    <div className="flex gap-1">
                      <input
                        type="text"
                        value={newTaskTexts[dayIdx] || ""}
                        onChange={(e) => setNewTaskTexts((prev) => ({ ...prev, [dayIdx]: e.target.value }))}
                        onKeyDown={(e) => e.key === "Enter" && handleAddTask(dayIdx)}
                        onFocus={() => { if (!isAuthenticated) guard(); }}
                        placeholder="+ Add task..."
                        className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent focus:outline-none focus:ring-1 focus:ring-emerald-500/50 placeholder:text-gray-300 dark:placeholder:text-gray-600"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
            <h3 className="font-semibold mb-3">Daily Task Completion</h3>
            <BarChart data={dailyBarData} maxValue={100} height={160} />
          </div>
        </div>
      )}

      {/* Habits Tab */}
      {activeTab === "habits" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden">
            <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Weekly Habit Tracker</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Track up to 8 daily habits across the week</p>
              </div>
              {weekData.habits.length < 8 && (
                <button
                  onClick={() => guard(() => setShowAddHabit(!showAddHabit))}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors"
                >
                  {showAddHabit ? "✕ Cancel" : "+ Add Habit"}
                </button>
              )}
            </div>

            {showAddHabit && (
              <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 bg-gray-50 dark:bg-gray-800/30 flex gap-2">
                <input
                  type="text"
                  value={newHabitName}
                  onChange={(e) => setNewHabitName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddHabit()}
                  placeholder="Enter habit name..."
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                  autoFocus
                />
                <button
                  onClick={handleAddHabit}
                  className="px-4 py-2 bg-purple-500 text-white text-sm font-medium rounded-lg hover:bg-purple-600 transition-colors"
                >
                  Add
                </button>
              </div>
            )}

            {weekData.habits.length === 0 ? (
              <div className="p-12 text-center">
                <span className="text-4xl mb-3 block">✅</span>
                <p className="text-gray-500 dark:text-gray-400 font-medium">No habits yet</p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Add habits to track daily across the week</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200/60 dark:border-gray-700/40">
                      <th className="text-left p-3 font-medium text-gray-500 dark:text-gray-400 min-w-[160px]">Habit</th>
                      {weekDates.map((date, i) => {
                        const today = isToday(date);
                        return (
                          <th key={i} className={`p-3 text-center font-medium min-w-[60px] ${
                            today ? "text-emerald-600 dark:text-emerald-400" : "text-gray-400"
                          }`}>
                            <div className="text-[10px] uppercase tracking-wider">{WEEKDAY_SHORT[i]}</div>
                            <div className={`text-sm ${today ? "font-bold" : ""}`}>{date.getDate()}</div>
                          </th>
                        );
                      })}
                      <th className="p-3 text-center font-medium text-gray-500 dark:text-gray-400 min-w-[60px]">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekData.habits.map((habit) => {
                      const completions = weekData.habitCompletions[habit.id] || Array(7).fill(false);
                      const doneCount = completions.filter(Boolean).length;
                      const pct = Math.round((doneCount / 7) * 100);

                      return (
                        <tr key={habit.id} className="border-b border-gray-100 dark:border-gray-800/40 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                          <td className="p-3">
                            <div className="flex items-center justify-between group">
                              <span className="font-medium text-gray-700 dark:text-gray-300 truncate max-w-[130px]">{habit.name}</span>
                              <button
                                onClick={() => guard(() => removeWeeklyHabit(weekKey, habit.id))}
                                className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-500 transition-all ml-1 text-[10px]"
                              >
                                ✕
                              </button>
                            </div>
                          </td>
                          {completions.map((done: boolean, dayIdx: number) => {
                            const today = isToday(weekDates[dayIdx]);
                            return (
                              <td key={dayIdx} className="p-1.5 text-center">
                                <button
                                  onClick={() => guard(() => toggleWeeklyHabit(weekKey, habit.id, dayIdx))}
                                  className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 text-sm ${
                                    done
                                      ? "bg-purple-500 text-white shadow-sm shadow-purple-500/30"
                                      : today
                                      ? "bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 hover:bg-purple-100 dark:hover:bg-purple-900/40"
                                      : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  } hover:scale-110`}
                                >
                                  {done ? "✓" : ""}
                                </button>
                              </td>
                            );
                          })}
                          <td className="p-3 text-center">
                            <span className={`font-bold text-sm ${
                              pct >= 70 ? "text-emerald-600 dark:text-emerald-400" :
                              pct >= 40 ? "text-amber-600 dark:text-amber-400" : "text-red-500"
                            }`}>
                              {pct}%
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {weekData.habits.length > 0 && (
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-5 border border-gray-200/60 dark:border-gray-700/40">
              <h3 className="font-semibold mb-4">Habit Performance</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {weekData.habits.map((habit) => {
                  const completions = weekData.habitCompletions[habit.id] || Array(7).fill(false);
                  const doneCount = completions.filter(Boolean).length;
                  const pct = Math.round((doneCount / 7) * 100);
                  return (
                    <div key={habit.id} className="text-center">
                      <ProgressRing percentage={pct} size={64} strokeWidth={5} color={pct >= 70 ? "#22c55e" : pct >= 40 ? "#f59e0b" : "#ef4444"}>
                        <span className="text-xs font-bold">{pct}%</span>
                      </ProgressRing>
                      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mt-2 truncate">{habit.name}</p>
                      <p className="text-[10px] text-gray-400">{doneCount}/7 days</p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Notes Tab */}
      {activeTab === "notes" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden">
            <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 bg-blue-50 dark:bg-blue-900/20">
              <h3 className="font-semibold flex items-center gap-2">
                <span>📝</span> Notes
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Reminders & daily thoughts</p>
            </div>
            <div className="p-4">
              <textarea
                value={weekData.notes.general}
                onChange={(e) => guard(() => updateWeeklyNotes(weekKey, { general: e.target.value }))}
                onFocus={() => { if (!isAuthenticated) guard(); }}
                placeholder="Buy bread on the way home&#10;Brainstorm project ideas&#10;Sign up for driving lessons..."
                className="w-full h-48 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 focus:outline-none focus:ring-2 focus:ring-blue-500/30 resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden">
            <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 bg-amber-50 dark:bg-amber-900/20">
              <h3 className="font-semibold flex items-center gap-2">
                <span>🔧</span> What can be improved?
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Reflection on productivity</p>
            </div>
            <div className="p-4">
              <textarea
                value={weekData.notes.improvements}
                onChange={(e) => guard(() => updateWeeklyNotes(weekKey, { improvements: e.target.value }))}
                onFocus={() => { if (!isAuthenticated) guard(); }}
                placeholder="Start with the hardest task&#10;Plan the day the night before&#10;Drink more water..."
                className="w-full h-48 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 focus:outline-none focus:ring-2 focus:ring-amber-500/30 resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden">
            <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 bg-emerald-50 dark:bg-emerald-900/20">
              <h3 className="font-semibold flex items-center gap-2">
                <span>🙏</span> What am I grateful for?
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Positive reflection & gratitude</p>
            </div>
            <div className="p-4">
              <textarea
                value={weekData.notes.gratitude}
                onChange={(e) => guard(() => updateWeeklyNotes(weekKey, { gratitude: e.target.value }))}
                onFocus={() => { if (!isAuthenticated) guard(); }}
                placeholder="A good book&#10;A cozy evening at home&#10;A delicious lunch at a cafe..."
                className="w-full h-48 px-3 py-2 text-sm rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 resize-none placeholder:text-gray-300 dark:placeholder:text-gray-600"
              />
            </div>
          </div>
        </div>
      )}

      {/* Motivational Footer */}
      <div className="text-center py-4">
        <p className="text-sm text-gray-400 dark:text-gray-500 italic">
          &quot;Inspiration comes only during work&quot;
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/weekly")({
  component: WeeklyPlannerPage,
});
