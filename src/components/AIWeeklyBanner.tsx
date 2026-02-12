import { useState, useMemo } from "react";
import { useAIAccess } from "@/hooks/useAIAccess";
import { LockedFeature } from "@/lib/subscription";
import type { WeeklyData, WeeklyTask } from "../lib/types";
import {
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  calculateWeeklyTaskProgress,
} from "../lib/types";
import { interpretTask } from "../lib/smart-task-ai";

// ---- Types ----

interface DayLoad {
  dayIndex: number;
  dayName: string;
  taskCount: number;
  totalMinutes: number;
  incompleteTasks: WeeklyTask[];
  completedTasks: WeeklyTask[];
  lowPriorityTasks: WeeklyTask[];
}

interface WeekAnalysis {
  overloadedDays: DayLoad[];
  lightDays: DayLoad[];
  suggestedRecoveryDay: DayLoad | null;
  isUnrealistic: boolean;
  totalWeekMinutes: number;
  avgDailyMinutes: number;
  maxDayMinutes: number;
  imbalanceScore: number; // 0-100, higher = more imbalanced
  headline: string;
  subtext: string;
  confidence: "high" | "medium" | "low";
  suggestions: WeekSuggestion[];
}

interface WeekSuggestion {
  id: string;
  text: string;
  emoji: string;
  type: "rebalance" | "recovery" | "reduce" | "flag";
  action?: {
    label: string;
    taskIds: string[];
    fromDay: number;
    toDay: number;
  };
}

// ---- Analysis Engine ----

function analyzeWeek(weekData: WeeklyData): WeekAnalysis {
  const dayLoads: DayLoad[] = [];
  const now = new Date();
  const todayDayIdx = (now.getDay() + 6) % 7; // Mon=0

  for (let i = 0; i < 7; i++) {
    const dayTasks = weekData.tasks.filter((t) => t.dayIndex === i);
    const incompleteTasks = dayTasks.filter((t) => !t.completed);
    const completedTasks = dayTasks.filter((t) => t.completed);

    let totalMinutes = 0;
    const lowPriorityTasks: WeeklyTask[] = [];

    for (const task of incompleteTasks) {
      const interp = interpretTask(task.text);
      totalMinutes += interp.estimatedMinutes;
      if (interp.priority === "low") {
        lowPriorityTasks.push(task);
      }
    }
    // Add completed task time too for full picture
    for (const task of completedTasks) {
      const interp = interpretTask(task.text);
      totalMinutes += interp.estimatedMinutes;
    }

    dayLoads.push({
      dayIndex: i,
      dayName: WEEKDAY_NAMES[i],
      taskCount: dayTasks.length,
      totalMinutes,
      incompleteTasks,
      completedTasks,
      lowPriorityTasks,
    });
  }

  const totalWeekMinutes = dayLoads.reduce((s, d) => s + d.totalMinutes, 0);
  const avgDailyMinutes = Math.round(totalWeekMinutes / 7);
  const maxDayMinutes = Math.max(...dayLoads.map((d) => d.totalMinutes));

  // Overloaded: >1.6x average and >90 minutes
  const overloadThreshold = Math.max(avgDailyMinutes * 1.6, 90);
  const overloadedDays = dayLoads.filter(
    (d) => d.totalMinutes > overloadThreshold && d.incompleteTasks.length > 0
  );

  // Light days: <0.5x average or 0 tasks, and not in the past
  const lightDays = dayLoads.filter(
    (d) =>
      d.totalMinutes < avgDailyMinutes * 0.5 &&
      d.dayIndex >= todayDayIdx &&
      d.incompleteTasks.length <= 2
  );

  // Suggested recovery day: lightest future day
  const futureDays = dayLoads.filter((d) => d.dayIndex > todayDayIdx);
  const suggestedRecoveryDay =
    futureDays.length > 0
      ? futureDays.reduce((min, d) =>
          d.totalMinutes < min.totalMinutes ? d : min
        )
      : null;

  // Unrealistic: >8 hours total remaining or any day >3 hours of incomplete tasks
  const totalRemainingMinutes = dayLoads
    .filter((d) => d.dayIndex >= todayDayIdx)
    .reduce((s, d) => {
      const incompleteMinutes = d.incompleteTasks.reduce((sum, t) => {
        return sum + interpretTask(t.text).estimatedMinutes;
      }, 0);
      return s + incompleteMinutes;
    }, 0);

  const isUnrealistic =
    totalRemainingMinutes > 480 ||
    dayLoads.some((d) => {
      if (d.dayIndex < todayDayIdx) return false;
      const incMin = d.incompleteTasks.reduce(
        (s, t) => s + interpretTask(t.text).estimatedMinutes,
        0
      );
      return incMin > 180;
    });

  // Imbalance score
  const variance =
    dayLoads.reduce(
      (s, d) => s + Math.pow(d.totalMinutes - avgDailyMinutes, 2),
      0
    ) / 7;
  const stdDev = Math.sqrt(variance);
  const imbalanceScore = Math.min(
    100,
    Math.round((stdDev / Math.max(avgDailyMinutes, 1)) * 100)
  );

  // Build suggestions
  const suggestions: WeekSuggestion[] = [];

  // Rebalance: move low-priority tasks from overloaded to light days
  for (const heavy of overloadedDays) {
    const movable = heavy.lowPriorityTasks.slice(0, 2);
    if (movable.length > 0 && lightDays.length > 0) {
      const target = lightDays[0];
      suggestions.push({
        id: `rebalance-${heavy.dayIndex}-${target.dayIndex}`,
        text: `Move ${movable.length} low-priority task${movable.length > 1 ? "s" : ""} from ${heavy.dayName} to ${target.dayName}`,
        emoji: "📦",
        type: "rebalance",
        action: {
          label: `Move to ${WEEKDAY_SHORT[target.dayIndex]}`,
          taskIds: movable.map((t) => t.id),
          fromDay: heavy.dayIndex,
          toDay: target.dayIndex,
        },
      });
    }
  }

  // Recovery day suggestion
  if (
    suggestedRecoveryDay &&
    suggestedRecoveryDay.taskCount <= 1 &&
    overloadedDays.length > 0
  ) {
    suggestions.push({
      id: `recovery-${suggestedRecoveryDay.dayIndex}`,
      text: `Keep ${suggestedRecoveryDay.dayName} as a recovery day — you have heavy days before it`,
      emoji: "🧘",
      type: "recovery",
    });
  }

  // Unrealistic week flag
  if (isUnrealistic) {
    // Find the heaviest incomplete day
    const heaviestFuture = dayLoads
      .filter((d) => d.dayIndex >= todayDayIdx)
      .reduce((max, d) =>
        d.incompleteTasks.length > max.incompleteTasks.length ? d : max
      );
    if (heaviestFuture.lowPriorityTasks.length > 0) {
      suggestions.push({
        id: `reduce-${heaviestFuture.dayIndex}`,
        text: `Remove ${heaviestFuture.lowPriorityTasks.length} optional task${heaviestFuture.lowPriorityTasks.length > 1 ? "s" : ""} from ${heaviestFuture.dayName} to make the week realistic`,
        emoji: "✂️",
        type: "reduce",
        action: {
          label: "Remove optional tasks",
          taskIds: heaviestFuture.lowPriorityTasks.map((t) => t.id),
          fromDay: heaviestFuture.dayIndex,
          toDay: -1, // means delete
        },
      });
    }
  }

  // Flag overloaded days without actionable fix
  for (const heavy of overloadedDays) {
    if (
      heavy.lowPriorityTasks.length === 0 &&
      !suggestions.some((s) => s.id.includes(`${heavy.dayIndex}`))
    ) {
      suggestions.push({
        id: `flag-${heavy.dayIndex}`,
        text: `${heavy.dayName} has ${heavy.incompleteTasks.length} tasks (~${Math.round(heavy.totalMinutes / 60 * 10) / 10}h) — all high priority. Consider splitting across days.`,
        emoji: "⚠️",
        type: "flag",
      });
    }
  }

  // Confidence
  const totalTasks = weekData.tasks.length;
  const confidence: "high" | "medium" | "low" =
    totalTasks >= 15 ? "high" : totalTasks >= 8 ? "medium" : "low";

  // Headline
  let headline: string;
  let subtext: string;

  if (overloadedDays.length === 0 && !isUnrealistic) {
    headline = "Your week looks well-balanced!";
    subtext = `${totalTasks} tasks spread across 7 days — steady and achievable.`;
  } else if (isUnrealistic && overloadedDays.length >= 3) {
    headline = "This week looks unrealistic — let me help you trim it.";
    subtext = `~${Math.round(totalRemainingMinutes / 60)}h of work remaining with ${overloadedDays.length} overloaded days.`;
  } else if (overloadedDays.length > 0) {
    const dayNames = overloadedDays.map((d) => WEEKDAY_SHORT[d.dayIndex]).join("–");
    headline = `This week looks overloaded on ${dayNames}. Want me to rebalance it?`;
    subtext = `${overloadedDays.length} heavy day${overloadedDays.length > 1 ? "s" : ""} detected — ${suggestions.filter((s) => s.action).length} quick fix${suggestions.filter((s) => s.action).length !== 1 ? "es" : ""} available.`;
  } else {
    headline = "Week is manageable but could be optimized.";
    subtext = `Imbalance score: ${imbalanceScore}% — some days are heavier than others.`;
  }

  return {
    overloadedDays,
    lightDays,
    suggestedRecoveryDay,
    isUnrealistic,
    totalWeekMinutes,
    avgDailyMinutes,
    maxDayMinutes,
    imbalanceScore,
    headline,
    subtext,
    confidence,
    suggestions,
  };
}

// ---- Component ----

interface AIWeeklyBannerProps {
  weekData: WeeklyData;
  weekKey: string;
  onMoveTask: (weekKey: string, taskId: string, newDayIndex: number) => void;
  onRemoveTask: (weekKey: string, taskId: string) => void;
}

export function AIWeeklyBanner({
  weekData,
  weekKey,
  onMoveTask,
  onRemoveTask,
}: AIWeeklyBannerProps) {
  const { enabled, reason } = useAIAccess();
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [appliedActions, setAppliedActions] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  const analysis = useMemo(() => analyzeWeek(weekData), [weekData]);

  if (!enabled) {
    return (
      <LockedFeature
        reason={reason === "upgrade" ? "needs_pro" : "needs_cloud"}
        featureLabel="AI weekly planning"
      />
    );
  }

  // Don't show if balanced and no suggestions
  if (
    dismissed ||
    (analysis.overloadedDays.length === 0 &&
      !analysis.isUnrealistic &&
      analysis.suggestions.length === 0)
  ) {
    return null;
  }

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = (suggestion: WeekSuggestion) => {
    if (!suggestion.action) return;
    const { taskIds, toDay } = suggestion.action;

    if (toDay === -1) {
      // Remove tasks
      for (const taskId of taskIds) {
        onRemoveTask(weekKey, taskId);
      }
      showToast(`Removed ${taskIds.length} optional task${taskIds.length > 1 ? "s" : ""}`);
    } else {
      // Move tasks
      for (const taskId of taskIds) {
        onMoveTask(weekKey, taskId, toDay);
      }
      showToast(
        `Moved ${taskIds.length} task${taskIds.length > 1 ? "s" : ""} to ${WEEKDAY_SHORT[toDay]}`
      );
    }

    setAppliedActions((prev) => new Set([...prev, suggestion.id]));
  };

  const pendingSuggestions = analysis.suggestions.filter(
    (s) => !appliedActions.has(s.id)
  );

  const confidenceBadge = {
    high: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300",
    medium: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    low: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
  };

  const confidenceLabel = {
    high: "◆ High confidence",
    medium: "◇ Medium confidence",
    low: "○ Low confidence",
  };

  const borderColor = analysis.isUnrealistic
    ? "border-red-300 dark:border-red-800/50"
    : analysis.overloadedDays.length > 0
    ? "border-amber-300 dark:border-amber-800/50"
    : "border-indigo-200 dark:border-indigo-800/50";

  const bgGradient = analysis.isUnrealistic
    ? "from-red-50 via-white to-orange-50 dark:from-red-900/20 dark:via-gray-800/60 dark:to-orange-900/10"
    : analysis.overloadedDays.length > 0
    ? "from-amber-50 via-white to-indigo-50 dark:from-amber-900/15 dark:via-gray-800/60 dark:to-indigo-900/10"
    : "from-indigo-50 via-white to-cyan-50 dark:from-indigo-900/15 dark:via-gray-800/60 dark:to-cyan-900/10";

  return (
    <div
      className={`relative bg-gradient-to-r ${bgGradient} rounded-2xl border ${borderColor} overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2 duration-500`}
    >
      {/* Toast */}
      {toast && (
        <div className="absolute top-2 right-2 z-50 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-1 duration-200">
          ✓ {toast}
        </div>
      )}

      {/* Main Banner */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
              analysis.isUnrealistic
                ? "bg-gradient-to-br from-red-500 to-orange-600 shadow-red-500/25"
                : analysis.overloadedDays.length > 0
                ? "bg-gradient-to-br from-amber-500 to-orange-600 shadow-amber-500/25"
                : "bg-gradient-to-br from-indigo-500 to-cyan-600 shadow-indigo-500/25"
            }`}
          >
            <span className="text-white text-lg">🤖</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-0.5">
              <h3 className="text-sm font-bold text-gray-900 dark:text-white">
                {analysis.headline}
              </h3>
              <span
                className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full ${confidenceBadge[analysis.confidence]}`}
              >
                {confidenceLabel[analysis.confidence]}
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {analysis.subtext}
            </p>

            {/* Quick Stats */}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-red-400" />
                {analysis.overloadedDays.length} overloaded
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                {analysis.lightDays.length} light
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                ⏱ ~{Math.round(analysis.totalWeekMinutes / 60)}h total
              </span>
              <span className="text-[10px] text-gray-400 dark:text-gray-500">
                📊 {analysis.imbalanceScore}% imbalance
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {pendingSuggestions.length > 0 && (
              <button
                onClick={() => setExpanded(!expanded)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                  expanded
                    ? "bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                    : analysis.isUnrealistic
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-sm shadow-red-500/25"
                    : "bg-amber-500 text-white hover:bg-amber-600 shadow-sm shadow-amber-500/25"
                }`}
              >
                {expanded
                  ? "Hide"
                  : `${pendingSuggestions.length} fix${pendingSuggestions.length !== 1 ? "es" : ""}`}
              </button>
            )}
            <button
              onClick={() => setDismissed(true)}
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-xs"
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* Expanded Suggestions */}
      {expanded && pendingSuggestions.length > 0 && (
        <div className="px-4 pb-4 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="h-px bg-gray-200/60 dark:bg-gray-700/40" />

          {/* Day Load Visualization */}
          <div className="flex items-end gap-1 h-12 px-1">
            {Array.from({ length: 7 }).map((_, i) => {
              const load = weekData.tasks.filter((t) => t.dayIndex === i);
              const incompleteCount = load.filter((t) => !t.completed).length;
              const totalCount = load.length;
              const maxTasks = Math.max(
                ...Array.from({ length: 7 }).map(
                  (_, j) => weekData.tasks.filter((t) => t.dayIndex === j).length
                ),
                1
              );
              const height = Math.max(4, (totalCount / maxTasks) * 40);
              const isOverloaded = analysis.overloadedDays.some(
                (d) => d.dayIndex === i
              );
              const isLight = analysis.lightDays.some(
                (d) => d.dayIndex === i
              );

              return (
                <div
                  key={i}
                  className="flex-1 flex flex-col items-center gap-0.5"
                >
                  <div
                    className={`w-full rounded-t transition-all duration-300 ${
                      isOverloaded
                        ? "bg-red-400 dark:bg-red-500"
                        : isLight
                        ? "bg-emerald-300 dark:bg-emerald-600"
                        : "bg-indigo-300 dark:bg-indigo-600"
                    }`}
                    style={{ height: `${height}px` }}
                  />
                  <span className="text-[8px] text-gray-400 dark:text-gray-500 font-medium">
                    {WEEKDAY_SHORT[i]}
                  </span>
                  <span
                    className={`text-[8px] font-bold ${
                      isOverloaded
                        ? "text-red-500 dark:text-red-400"
                        : isLight
                        ? "text-emerald-500 dark:text-emerald-400"
                        : "text-gray-500 dark:text-gray-400"
                    }`}
                  >
                    {incompleteCount > 0 ? incompleteCount : totalCount > 0 ? `✓${totalCount}` : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Suggestion Cards */}
          <div className="space-y-1.5 mt-2">
            {pendingSuggestions.map((suggestion) => (
              <div
                key={suggestion.id}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 ${
                  suggestion.type === "rebalance"
                    ? "bg-blue-50/50 dark:bg-blue-900/10 border-blue-200/50 dark:border-blue-800/30"
                    : suggestion.type === "recovery"
                    ? "bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200/50 dark:border-emerald-800/30"
                    : suggestion.type === "reduce"
                    ? "bg-red-50/50 dark:bg-red-900/10 border-red-200/50 dark:border-red-800/30"
                    : "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-800/30"
                }`}
              >
                <span className="text-base flex-shrink-0">{suggestion.emoji}</span>
                <p className="flex-1 text-xs text-gray-700 dark:text-gray-300">
                  {suggestion.text}
                </p>
                {suggestion.action && (
                  <button
                    onClick={() => handleAction(suggestion)}
                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-lg transition-all duration-200 flex-shrink-0 ${
                      suggestion.type === "reduce"
                        ? "bg-red-500 hover:bg-red-600 text-white shadow-sm shadow-red-500/25"
                        : "bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
                    }`}
                  >
                    {suggestion.action.label}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Applied actions summary */}
          {appliedActions.size > 0 && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium text-center pt-1">
              ✓ {appliedActions.size} change{appliedActions.size !== 1 ? "s" : ""} applied — your week is more balanced now
            </p>
          )}
        </div>
      )}
    </div>
  );
}
