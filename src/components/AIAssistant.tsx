import { useState, useRef } from "react";
import { useAIAccess } from "@/hooks/useAIAccess";
import { LockedFeature } from "@/lib/subscription";

export interface AIAction {
  id: string;
  label: string;
  emoji: string;
  type: "reschedule" | "lower_difficulty" | "create_minimum" | "navigate" | "dismiss_habit" | "focus_mode";
  payload?: Record<string, any>;
}

export interface AIInsight {
  id: string;
  type: "tip" | "observation" | "suggestion" | "warning";
  title: string;
  message: string;
  emoji: string;
  confidence?: number; // 0-100
  actionLabel?: string;
  actionRoute?: string;
  actions?: AIAction[];
}

interface AIAssistantProps {
  insights: AIInsight[];
  dailyPlan: string[];
  greeting: string;
  streak: number;
  todayScore: number;
  onDismissInsight?: (id: string) => void;
  onAction?: (action: AIAction, insightId: string) => void;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidence >= 80 ? "high" : confidence >= 50 ? "medium" : "low";
  const colors = {
    high: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 ring-emerald-300/50 dark:ring-emerald-700/50",
    medium: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 ring-amber-300/50 dark:ring-amber-700/50",
    low: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 ring-gray-300/50 dark:ring-gray-700/50",
  };
  const labels = { high: "High confidence", medium: "Medium confidence", low: "Low confidence" };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full ring-1 ${colors[level]}`}>
      {level === "high" ? "◆" : level === "medium" ? "◇" : "○"} {labels[level]}
    </span>
  );
}

export function AIAssistant({ insights, dailyPlan, greeting, streak, todayScore, onDismissInsight, onAction }: AIAssistantProps) {
  const { enabled, reason } = useAIAccess();
  const [expanded, setExpanded] = useState(true);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [executedActions, setExecutedActions] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);

  const visibleInsights = insights.filter((i) => !dismissedIds.has(i.id));

  if (!enabled) {
    return (
      <LockedFeature
        reason={reason === "upgrade" ? "needs_pro" : "needs_cloud"}
        featureLabel="AI insights"
      />
    );
  }

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]));
    onDismissInsight?.(id);
  };

  const handleAction = (action: AIAction, insightId: string) => {
    const actionKey = `${insightId}-${action.id}`;
    setExecutedActions((prev) => new Set([...prev, actionKey]));
    onAction?.(action, insightId);
  };

  const typeColors = {
    tip: "from-blue-500/10 to-cyan-500/10 border-blue-500/20 dark:from-blue-900/30 dark:to-cyan-900/30 dark:border-blue-700/30",
    observation: "from-purple-500/10 to-pink-500/10 border-purple-500/20 dark:from-purple-900/30 dark:to-pink-900/30 dark:border-purple-700/30",
    suggestion: "from-emerald-500/10 to-teal-500/10 border-emerald-500/20 dark:from-emerald-900/30 dark:to-teal-900/30 dark:border-emerald-700/30",
    warning: "from-amber-500/10 to-orange-500/10 border-amber-500/20 dark:from-amber-900/30 dark:to-orange-900/30 dark:border-amber-700/30",
  };

  const typeBadgeColors = {
    tip: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
    observation: "bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300",
    suggestion: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    warning: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300",
  };

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-800/80 dark:via-gray-800/60 dark:to-indigo-900/20 rounded-2xl border border-indigo-200/50 dark:border-indigo-700/30 overflow-hidden shadow-sm">
      {/* AI Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-4 flex items-center justify-between hover:bg-white/30 dark:hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/25">
            <span className="text-white text-lg">🤖</span>
          </div>
          <div className="text-left">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              AI Co-Pilot
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 uppercase tracking-wider">
                Smart
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{greeting}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400">
              <span className="text-xs">🔥</span>
              <span className="text-xs font-bold">{streak}d</span>
            </div>
          )}
          <span className={`text-sm transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}>▾</span>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
          {/* Today's Score */}
          <div className="flex items-center gap-3 p-3 rounded-xl bg-white/60 dark:bg-gray-800/40 border border-gray-200/40 dark:border-gray-700/30">
            <div className="relative">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" className="text-gray-200 dark:text-gray-700" />
                <circle
                  cx="24" cy="24" r="20" fill="none"
                  stroke={todayScore >= 70 ? "#22c55e" : todayScore >= 40 ? "#f59e0b" : "#ef4444"}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${(todayScore / 100) * 125.6} 125.6`}
                  transform="rotate(-90 24 24)"
                  className="transition-all duration-700"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-xs font-bold">
                {todayScore}%
              </span>
            </div>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300">Today&apos;s Score</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {todayScore >= 70 ? "Crushing it! Keep the momentum going." :
                 todayScore >= 40 ? "Good progress. A few more habits to go!" :
                 todayScore > 0 ? "Just getting started. You got this!" :
                 "Start your day strong — check off your first habit!"}
              </p>
            </div>
          </div>

          {/* Daily Plan */}
          {dailyPlan.length > 0 && (
            <div className="p-3 rounded-xl bg-white/60 dark:bg-gray-800/40 border border-gray-200/40 dark:border-gray-700/30">
              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-1.5">
                <span>📋</span> AI Daily Plan
              </p>
              <div className="space-y-1.5">
                {dailyPlan.map((item, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                    <span className="text-indigo-500 dark:text-indigo-400 font-bold mt-0.5 flex-shrink-0">{i + 1}.</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Insights with Actions */}
          <div ref={scrollRef} className="space-y-2 max-h-[400px] overflow-y-auto">
            {visibleInsights.map((insight) => {
              const hasActions = insight.actions && insight.actions.length > 0;
              return (
                <div
                  key={insight.id}
                  className={`relative p-3 rounded-xl bg-gradient-to-r border transition-all duration-300 ${typeColors[insight.type]}`}
                >
                  <button
                    onClick={() => handleDismiss(insight.id)}
                    className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-white/50 dark:hover:bg-white/10 transition-colors text-[10px]"
                  >
                    ✕
                  </button>
                  <div className="flex items-start gap-2.5 pr-5">
                    <span className="text-lg flex-shrink-0">{insight.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span className="text-xs font-semibold text-gray-800 dark:text-gray-200">{insight.title}</span>
                        <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider ${typeBadgeColors[insight.type]}`}>
                          {insight.type}
                        </span>
                        {insight.confidence !== undefined && (
                          <ConfidenceBadge confidence={insight.confidence} />
                        )}
                      </div>
                      <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{insight.message}</p>

                      {/* 1-Click Action Buttons */}
                      {hasActions && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {insight.actions!.map((action) => {
                            const actionKey = `${insight.id}-${action.id}`;
                            const isExecuted = executedActions.has(actionKey);
                            return (
                              <button
                                key={action.id}
                                onClick={() => handleAction(action, insight.id)}
                                disabled={isExecuted}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 ${
                                  isExecuted
                                    ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 cursor-default"
                                    : "bg-white/80 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm hover:scale-[1.02] active:scale-95 border border-gray-200/60 dark:border-gray-600/40"
                                }`}
                              >
                                <span>{isExecuted ? "✓" : action.emoji}</span>
                                <span>{isExecuted ? "Done!" : action.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {visibleInsights.length === 0 && (
            <div className="text-center py-4">
              <span className="text-2xl block mb-1">✨</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">All caught up! Check back later for new insights.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Generate insights from user data
export function generateInsights(
  data: Record<string, any>,
  weeklyData: Record<string, any>,
  selectedYear: number
): { insights: AIInsight[]; dailyPlan: string[]; greeting: string; streak: number; todayScore: number } {
  const now = new Date();
  const hour = now.getHours();
  const currentMonth = now.getMonth() + 1;
  const currentDay = now.getDate();
  const monthKey = `${selectedYear}-${String(currentMonth).padStart(2, "0")}`;
  const monthData = data[monthKey] || { habits: [], days: {} };

  // Greeting based on time of day
  let greeting = "Good morning! Let's make today count.";
  if (hour >= 12 && hour < 17) greeting = "Good afternoon! How's your progress today?";
  else if (hour >= 17 && hour < 21) greeting = "Good evening! Time to review your day.";
  else if (hour >= 21) greeting = "Winding down? Let's see how today went.";

  // Today's score
  const todayEntry = monthData.days?.[currentDay];
  const totalHabits = monthData.habits?.length || 0;
  const todayScore = todayEntry && totalHabits > 0
    ? Math.round((todayEntry.completedHabits.length / totalHabits) * 100)
    : 0;

  // Calculate streak
  let streak = 0;
  for (let d = currentDay; d >= 1; d--) {
    const entry = monthData.days?.[d];
    if (entry && totalHabits > 0) {
      const pct = Math.round((entry.completedHabits.length / totalHabits) * 100);
      if (pct >= 50) streak++;
      else break;
    } else {
      if (d === currentDay) continue;
      break;
    }
  }

  const insights: AIInsight[] = [];

  // Insight: Incomplete habits today — with 1-click actions
  if (todayEntry && totalHabits > 0) {
    const remaining = totalHabits - todayEntry.completedHabits.length;
    if (remaining > 0 && remaining <= 3) {
      const missingHabits = monthData.habits
        .filter((h: any) => !todayEntry.completedHabits.includes(h.id))
        .map((h: any) => h);
      const missingNames = missingHabits.map((h: any) => h.name);

      const actions: AIAction[] = missingHabits.map((h: any) => ({
        id: `reschedule-${h.id}`,
        label: `Move "${h.name}" to tomorrow`,
        emoji: "📅",
        type: "reschedule" as const,
        payload: { habitId: h.id, habitName: h.name, targetDay: "tomorrow" },
      }));

      if (missingHabits.length > 1) {
        actions.push({
          id: "create-minimum",
          label: "Do minimum versions",
          emoji: "⚡",
          type: "create_minimum" as const,
          payload: { habits: missingHabits.map((h: any) => ({ id: h.id, name: h.name })) },
        });
      }

      insights.push({
        id: "almost-done",
        type: "suggestion",
        title: "Almost there!",
        emoji: "🎯",
        message: `Just ${remaining} habit${remaining > 1 ? "s" : ""} left today: ${missingNames.join(", ")}. You can do it!`,
        confidence: 90,
        actions,
      });
    }
  }

  // Insight: Streak celebration
  if (streak >= 7) {
    insights.push({
      id: "streak-fire",
      type: "observation",
      title: `${streak}-day streak!`,
      emoji: "🔥",
      message: "You're on fire! Consistency is the key to lasting change. Keep this momentum going.",
      confidence: 95,
    });
  } else if (streak >= 3) {
    insights.push({
      id: "streak-building",
      type: "tip",
      title: "Building momentum",
      emoji: "📈",
      message: `${streak} days in a row of 50%+ completion. Push for 7 to build a strong habit loop!`,
      confidence: 85,
    });
  }

  // Insight: Mood trend with actions
  const recentMoods: number[] = [];
  for (let d = Math.max(1, currentDay - 6); d <= currentDay; d++) {
    const entry = monthData.days?.[d];
    if (entry) recentMoods.push(entry.mood);
  }
  if (recentMoods.length >= 3) {
    const avgMood = recentMoods.reduce((a: number, b: number) => a + b, 0) / recentMoods.length;
    const trend = recentMoods[recentMoods.length - 1] - recentMoods[0];
    if (trend <= -2) {
      insights.push({
        id: "mood-declining",
        type: "warning",
        title: "Mood dipping",
        emoji: "💛",
        message: "Your mood has been trending down. Consider taking a break or doing something you enjoy today.",
        confidence: 75,
        actions: [
          { id: "lower-goals", label: "Lower goals this week", emoji: "📉", type: "lower_difficulty", payload: { reason: "mood_dip" } },
          { id: "focus-wellness", label: "Add wellness focus", emoji: "🧘", type: "focus_mode", payload: { mode: "wellness" } },
        ],
      });
    } else if (avgMood >= 7) {
      insights.push({
        id: "mood-great",
        type: "observation",
        title: "Feeling great!",
        emoji: "😊",
        message: `Your average mood this week is ${avgMood.toFixed(1)}/10. High mood correlates with better habit completion — ride this wave!`,
        confidence: 88,
      });
    }
  }

  // Insight: Weakest habit with actions
  if (monthData.habits && monthData.habits.length > 0 && currentDay >= 7) {
    let worstHabit = { id: "", name: "", pct: 100 };
    for (const habit of monthData.habits) {
      let done = 0;
      for (let d = 1; d <= currentDay; d++) {
        if (monthData.days?.[d]?.completedHabits?.includes(habit.id)) done++;
      }
      const pct = Math.round((done / currentDay) * 100);
      if (pct < worstHabit.pct) worstHabit = { id: habit.id, name: habit.name, pct };
    }
    if (worstHabit.pct < 40 && worstHabit.name) {
      insights.push({
        id: "weak-habit",
        type: "warning",
        title: "Needs attention",
        emoji: "⚠️",
        message: `"${worstHabit.name}" is at ${worstHabit.pct}% this month. Try pairing it with a habit you already do consistently.`,
        confidence: 82,
        actions: [
          { id: `lower-${worstHabit.id}`, label: `Lower "${worstHabit.name}" difficulty`, emoji: "📉", type: "lower_difficulty", payload: { habitId: worstHabit.id, habitName: worstHabit.name } },
          { id: `min-${worstHabit.id}`, label: `Create minimum version`, emoji: "⚡", type: "create_minimum", payload: { habits: [{ id: worstHabit.id, name: worstHabit.name }] } },
          { id: `dismiss-${worstHabit.id}`, label: `Remove this habit`, emoji: "🗑️", type: "dismiss_habit", payload: { habitId: worstHabit.id, habitName: worstHabit.name } },
        ],
      });
    }
  }

  // Insight: Best habit
  if (monthData.habits && monthData.habits.length > 0 && currentDay >= 5) {
    let bestHabit = { name: "", pct: 0 };
    for (const habit of monthData.habits) {
      let done = 0;
      for (let d = 1; d <= currentDay; d++) {
        if (monthData.days?.[d]?.completedHabits?.includes(habit.id)) done++;
      }
      const pct = Math.round((done / currentDay) * 100);
      if (pct > bestHabit.pct) bestHabit = { name: habit.name, pct };
    }
    if (bestHabit.pct >= 80) {
      insights.push({
        id: "best-habit",
        type: "observation",
        title: "Star performer",
        emoji: "⭐",
        message: `"${bestHabit.name}" is at ${bestHabit.pct}% — your strongest habit this month. This is becoming automatic!`,
        confidence: 92,
      });
    }
  }

  // Insight: Weekend vs weekday performance
  if (currentDay >= 14) {
    let weekdayTotal = 0, weekdayDone = 0, weekendTotal = 0, weekendDone = 0;
    for (let d = 1; d <= currentDay; d++) {
      const date = new Date(selectedYear, currentMonth - 1, d);
      const dayOfWeek = date.getDay();
      const entry = monthData.days?.[d];
      if (entry && totalHabits > 0) {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          weekendTotal += totalHabits;
          weekendDone += entry.completedHabits.length;
        } else {
          weekdayTotal += totalHabits;
          weekdayDone += entry.completedHabits.length;
        }
      }
    }
    const weekdayPct = weekdayTotal > 0 ? Math.round((weekdayDone / weekdayTotal) * 100) : 0;
    const weekendPct = weekendTotal > 0 ? Math.round((weekendDone / weekendTotal) * 100) : 0;
    if (weekdayPct - weekendPct > 20) {
      insights.push({
        id: "weekend-drop",
        type: "tip",
        title: "Weekend slump",
        emoji: "📅",
        message: `Weekday completion is ${weekdayPct}% vs ${weekendPct}% on weekends. Try setting weekend-specific routines to stay consistent.`,
        confidence: 78,
        actions: [
          { id: "lower-weekend", label: "Lower weekend goals", emoji: "📉", type: "lower_difficulty", payload: { reason: "weekend_slump" } },
        ],
      });
    }
  }

  // Insight: No habits set up
  if (totalHabits === 0) {
    insights.push({
      id: "no-habits",
      type: "suggestion",
      title: "Get started!",
      emoji: "🚀",
      message: "You haven't set up any habits for this month yet. Head to the Monthly Tracker to add your first habits!",
      confidence: 100,
      actions: [
        { id: "go-tracker", label: "Go to Tracker", emoji: "📊", type: "navigate", payload: { route: "/tracker" } },
      ],
    });
  }

  // Insight: Weekly planner check
  const weekKey = getWeekKeySimple(now);
  const currentWeek = weeklyData[weekKey];
  if (!currentWeek || (currentWeek.tasks?.length || 0) === 0) {
    insights.push({
      id: "plan-week",
      type: "suggestion",
      title: "Plan your week",
      emoji: "📋",
      message: "You haven't planned this week yet. Taking 5 minutes to plan can boost your productivity by up to 25%.",
      confidence: 85,
      actions: [
        { id: "go-weekly", label: "Open Weekly Planner", emoji: "📋", type: "navigate", payload: { route: "/weekly" } },
      ],
    });
  } else {
    const completedTasks = currentWeek.tasks.filter((t: any) => t.completed).length;
    const totalTasks = currentWeek.tasks.length;
    const taskPct = Math.round((completedTasks / totalTasks) * 100);
    if (taskPct >= 80) {
      insights.push({
        id: "weekly-crushing",
        type: "observation",
        title: "Weekly tasks on point!",
        emoji: "💪",
        message: `${completedTasks}/${totalTasks} weekly tasks done (${taskPct}%). You're crushing your to-do list!`,
        confidence: 95,
      });
    }
  }

  // Generate daily plan
  const dailyPlan: string[] = [];
  if (totalHabits > 0 && todayEntry) {
    const remaining = monthData.habits.filter((h: any) => !todayEntry.completedHabits.includes(h.id));
    if (remaining.length > 0) {
      dailyPlan.push(`Complete remaining habits: ${remaining.slice(0, 3).map((h: any) => h.name).join(", ")}${remaining.length > 3 ? ` (+${remaining.length - 3} more)` : ""}`);
    }
  } else if (totalHabits > 0) {
    dailyPlan.push(`Start with your easiest habit to build momentum`);
  }

  if (currentWeek) {
    const todayDayIdx = (now.getDay() + 6) % 7;
    const todayTasks = currentWeek.tasks?.filter((t: any) => t.dayIndex === todayDayIdx && !t.completed) || [];
    if (todayTasks.length > 0) {
      dailyPlan.push(`${todayTasks.length} weekly task${todayTasks.length > 1 ? "s" : ""} scheduled for today`);
    }
  }

  if (hour < 12) {
    dailyPlan.push("Set your mood & motivation for today");
  } else if (hour >= 20) {
    dailyPlan.push("Review today and plan tomorrow");
  }

  if (recentMoods.length > 0) {
    const lastMood = recentMoods[recentMoods.length - 1];
    if (lastMood <= 4) {
      dailyPlan.push("Take a 10-minute break to recharge");
    }
  }

  return { insights, dailyPlan, greeting, streak, todayScore };
}

// Simple week key helper (avoids circular import)
function getWeekKeySimple(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
