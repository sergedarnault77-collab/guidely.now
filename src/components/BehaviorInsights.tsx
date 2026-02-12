import { useMemo, useState } from "react";
import type { UserBehaviorProfile, HabitProfile, BehaviorPattern, Recommendation } from "../lib/behavior-analytics";
import type { AIAction } from "./AIAssistant";
import { useAIAccess } from "@/hooks/useAIAccess";
import { LockedFeature } from "@/lib/subscription";

interface BehaviorInsightsProps {
  profile: UserBehaviorProfile;
  onAction?: (action: AIAction, sourceId: string) => void;
}

const WEEKDAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const level = confidence >= 80 ? "high" : confidence >= 50 ? "medium" : "low";
  const colors = {
    high: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 ring-emerald-300/50 dark:ring-emerald-700/50",
    medium: "bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 ring-amber-300/50 dark:ring-amber-700/50",
    low: "bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 ring-gray-300/50 dark:ring-gray-700/50",
  };
  const labels = { high: "High confidence", medium: "Medium", low: "Low" };

  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full ring-1 ${colors[level]}`}>
      {level === "high" ? "◆" : level === "medium" ? "◇" : "○"} {labels[level]}
    </span>
  );
}

function ActionButton({ action, sourceId, onAction }: { action: AIAction; sourceId: string; onAction?: (action: AIAction, sourceId: string) => void }) {
  const [executed, setExecuted] = useState(false);

  const handleClick = () => {
    setExecuted(true);
    onAction?.(action, sourceId);
  };

  return (
    <button
      onClick={handleClick}
      disabled={executed}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all duration-200 ${
        executed
          ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 cursor-default"
          : "bg-white/80 dark:bg-gray-700/60 text-gray-700 dark:text-gray-200 hover:bg-white dark:hover:bg-gray-700 hover:shadow-sm hover:scale-[1.02] active:scale-95 border border-gray-200/60 dark:border-gray-600/40"
      }`}
    >
      <span>{executed ? "✓" : action.emoji}</span>
      <span>{executed ? "Done!" : action.label}</span>
    </button>
  );
}

export function BehaviorInsights({ profile, onAction }: BehaviorInsightsProps) {
  const { enabled, reason } = useAIAccess();

  const sortedHabits = useMemo(
    () => [...profile.habitProfiles].sort((a, b) => b.abandonmentRisk - a.abandonmentRisk),
    [profile.habitProfiles]
  );

  const automaticHabits = sortedHabits.filter(h => h.isAutomatic);
  const atRiskHabits = sortedHabits.filter(h => h.abandonmentRisk >= 50);
  const improvingHabits = sortedHabits.filter(h => h.trend > 10);

  if (!enabled) {
    return (
      <LockedFeature
        reason={reason === "upgrade" ? "needs_pro" : "needs_cloud"}
        featureLabel="Behavior Insights"
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Behavior Patterns */}
      {profile.patterns.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden">
          <div className="p-4 border-b border-gray-200/40 dark:border-gray-700/30">
            <div className="flex items-center gap-2">
              <span className="text-lg">🧠</span>
              <h3 className="font-semibold text-sm">Detected Patterns</h3>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 uppercase tracking-wider">
                AI
              </span>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {profile.patterns.map((pattern) => (
              <PatternCard key={pattern.id} pattern={pattern} onAction={onAction} />
            ))}
          </div>
        </div>
      )}

      {/* Habit Health Dashboard */}
      {sortedHabits.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden">
          <div className="p-4 border-b border-gray-200/40 dark:border-gray-700/30">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">📊</span>
                <h3 className="font-semibold text-sm">Habit Health</h3>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-gray-400">
                {automaticHabits.length > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    {automaticHabits.length} automatic
                  </span>
                )}
                {atRiskHabits.length > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {atRiskHabits.length} at risk
                  </span>
                )}
                {improvingHabits.length > 0 && (
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {improvingHabits.length} improving
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="p-4 space-y-3">
            {sortedHabits.map((habit) => (
              <HabitHealthRow key={habit.habitId} habit={habit} onAction={onAction} />
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {profile.recommendations.length > 0 && (
        <div className="bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-800/80 dark:via-gray-800/60 dark:to-indigo-900/20 rounded-2xl border border-indigo-200/50 dark:border-indigo-700/30 overflow-hidden">
          <div className="p-4 border-b border-indigo-200/30 dark:border-indigo-700/20">
            <div className="flex items-center gap-2">
              <span className="text-lg">💡</span>
              <h3 className="font-semibold text-sm">AI Recommendations</h3>
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-300 uppercase tracking-wider">
                Personalized
              </span>
            </div>
          </div>
          <div className="p-4 space-y-2">
            {profile.recommendations.map((rec) => (
              <RecommendationCard key={rec.id} rec={rec} onAction={onAction} />
            ))}
          </div>
        </div>
      )}

      {/* Peak Performance Days */}
      {profile.peakDays.length > 0 && (
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">⚡</span>
            <h3 className="font-semibold text-sm">Your Peak Days</h3>
          </div>
          <div className="flex gap-2">
            {WEEKDAY_NAMES.map((name, i) => {
              const isPeak = profile.peakDays.includes(i);
              return (
                <div
                  key={i}
                  className={`flex-1 py-2 rounded-lg text-center text-xs font-medium transition-all ${
                    isPeak
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-300 dark:ring-emerald-700"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
                  }`}
                >
                  {name}
                  {isPeak && <div className="text-[10px] mt-0.5">⭐</div>}
                </div>
              );
            })}
          </div>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-2 text-center">
            Schedule important habits on your peak days for best results
          </p>
        </div>
      )}

      {/* Mood-Productivity Correlation */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold mb-1">Mood → Productivity</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">
              {profile.moodProductivityCorrelation > 0.3 ? "Strong" :
               profile.moodProductivityCorrelation > 0 ? "Moderate" : "Weak"}
            </span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            r = {profile.moodProductivityCorrelation.toFixed(2)}
          </p>
          <p className="text-[10px] text-gray-400">
            {profile.moodProductivityCorrelation > 0.3
              ? "Your mood strongly drives your habits"
              : "Your habits are fairly independent of mood"}
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-4 border border-gray-200/60 dark:border-gray-700/40">
          <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold mb-1">Weekday vs Weekend</p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold">
              {Math.abs(profile.weekdayWeekendGap)}%
            </span>
            <span className="text-xs text-gray-400">gap</span>
          </div>
          <p className="text-[10px] text-gray-400 mt-1">
            {profile.weekdayWeekendGap > 15
              ? "Significant weekend drop-off"
              : profile.weekdayWeekendGap > 5
              ? "Slight weekend dip"
              : "Consistent across the week!"}
          </p>
        </div>
      </div>
    </div>
  );
}

// ---- Sub-Components ----

function PatternCard({ pattern, onAction }: { pattern: BehaviorPattern; onAction?: (action: AIAction, sourceId: string) => void }) {
  const typeColors = {
    positive: "border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/50 dark:bg-emerald-900/10",
    negative: "border-red-200 dark:border-red-800/40 bg-red-50/50 dark:bg-red-900/10",
    neutral: "border-blue-200 dark:border-blue-800/40 bg-blue-50/50 dark:bg-blue-900/10",
  };
  const typeBadge = {
    positive: "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300",
    negative: "bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300",
    neutral: "bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300",
  };

  const actions: AIAction[] = [];
  if (pattern.type === "negative") {
    actions.push({
      id: `fix-${pattern.id}`,
      label: "Lower difficulty this week",
      emoji: "📉",
      type: "lower_difficulty",
      payload: { patternId: pattern.id, reason: pattern.title },
    });
    actions.push({
      id: `schedule-${pattern.id}`,
      label: "Reschedule to peak day",
      emoji: "📅",
      type: "reschedule",
      payload: { patternId: pattern.id, targetDay: "peak" },
    });
  } else if (pattern.type === "positive") {
    actions.push({
      id: `boost-${pattern.id}`,
      label: "Build on this pattern",
      emoji: "🚀",
      type: "focus_mode",
      payload: { patternId: pattern.id, mode: "amplify" },
    });
  }

  return (
    <div className={`p-3 rounded-xl border transition-all duration-200 ${typeColors[pattern.type]}`}>
      <div className="flex items-start gap-2.5">
        <span className="text-lg flex-shrink-0">{pattern.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{pattern.title}</span>
            <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase tracking-wider ${typeBadge[pattern.type]}`}>
              {pattern.type}
            </span>
            <ConfidenceBadge confidence={pattern.confidence} />
          </div>
          <p className="text-[11px] text-gray-600 dark:text-gray-400 leading-relaxed">{pattern.description}</p>

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {actions.map((action) => (
                <ActionButton key={action.id} action={action} sourceId={pattern.id} onAction={onAction} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecommendationCard({ rec, onAction }: { rec: Recommendation; onAction?: (action: AIAction, sourceId: string) => void }) {
  const priorityColors = {
    high: "border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/10",
    medium: "border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-900/10",
    low: "border-gray-200 dark:border-gray-700/40 bg-gray-50/30 dark:bg-gray-800/20",
  };

  const actions: AIAction[] = [];
  const actionType = rec.actionType;

  if (actionType === "habit_focus") {
    actions.push({
      id: `focus-${rec.id}`,
      label: "Focus on this habit",
      emoji: "🎯",
      type: "focus_mode",
      payload: { recId: rec.id, mode: "habit_focus" },
    });
    actions.push({
      id: `min-${rec.id}`,
      label: "Create minimum version",
      emoji: "⚡",
      type: "create_minimum",
      payload: { recId: rec.id },
    });
  } else if (actionType === "schedule_change") {
    actions.push({
      id: `reschedule-${rec.id}`,
      label: "Reschedule now",
      emoji: "📅",
      type: "reschedule",
      payload: { recId: rec.id, targetDay: "optimal" },
    });
  } else if (actionType === "wellness") {
    actions.push({
      id: `wellness-${rec.id}`,
      label: "Add wellness focus",
      emoji: "🧘",
      type: "focus_mode",
      payload: { recId: rec.id, mode: "wellness" },
    });
    actions.push({
      id: `lower-${rec.id}`,
      label: "Lower goals this week",
      emoji: "📉",
      type: "lower_difficulty",
      payload: { recId: rec.id, reason: "wellness" },
    });
  } else if (actionType === "planning") {
    actions.push({
      id: `plan-${rec.id}`,
      label: "Open Weekly Planner",
      emoji: "📋",
      type: "navigate",
      payload: { route: "/weekly" },
    });
  } else if (actionType === "celebration") {
    actions.push({
      id: `celebrate-${rec.id}`,
      label: "Share achievement",
      emoji: "🎉",
      type: "focus_mode",
      payload: { recId: rec.id, mode: "celebrate" },
    });
  }

  const confidenceMap = { high: 88, medium: 72, low: 55 };

  return (
    <div
      className={`p-3 rounded-xl border transition-all duration-200 hover:shadow-sm ${priorityColors[rec.priority]}`}
    >
      <div className="flex items-start gap-2.5">
        <span className="text-lg flex-shrink-0">{rec.emoji}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
            <p className="text-xs font-bold text-gray-800 dark:text-gray-200">{rec.title}</p>
            <ConfidenceBadge confidence={confidenceMap[rec.priority]} />
          </div>
          <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-0.5 leading-relaxed">{rec.description}</p>
          <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1 italic">{rec.rationale}</p>

          {actions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {actions.map((action) => (
                <ActionButton key={action.id} action={action} sourceId={rec.id} onAction={onAction} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HabitHealthRow({ habit, onAction }: { habit: HabitProfile; onAction?: (action: AIAction, sourceId: string) => void }) {
  const [showActions, setShowActions] = useState(false);

  const statusColor = habit.isAutomatic
    ? "text-emerald-600 dark:text-emerald-400"
    : habit.abandonmentRisk >= 60
    ? "text-red-600 dark:text-red-400"
    : habit.trend > 10
    ? "text-blue-600 dark:text-blue-400"
    : "text-gray-600 dark:text-gray-400";

  const statusLabel = habit.isAutomatic
    ? "Automatic"
    : habit.abandonmentRisk >= 60
    ? "At Risk"
    : habit.trend > 10
    ? "Improving"
    : habit.completionRate >= 70
    ? "Strong"
    : "Building";

  const barColor = habit.isAutomatic
    ? "bg-emerald-500"
    : habit.abandonmentRisk >= 60
    ? "bg-red-500"
    : habit.trend > 10
    ? "bg-blue-500"
    : habit.completionRate >= 70
    ? "bg-emerald-400"
    : "bg-amber-400";

  const actions: AIAction[] = [];
  if (habit.abandonmentRisk >= 60) {
    actions.push({
      id: `lower-${habit.habitId}`,
      label: "Lower difficulty",
      emoji: "📉",
      type: "lower_difficulty",
      payload: { habitId: habit.habitId, habitName: habit.habitName },
    });
    actions.push({
      id: `min-${habit.habitId}`,
      label: "Create minimum version",
      emoji: "⚡",
      type: "create_minimum",
      payload: { habits: [{ id: habit.habitId, name: habit.habitName }] },
    });
    actions.push({
      id: `schedule-${habit.habitId}`,
      label: `Move to ${WEEKDAY_NAMES[habit.bestDayOfWeek]}`,
      emoji: "📅",
      type: "reschedule",
      payload: { habitId: habit.habitId, habitName: habit.habitName, targetDay: WEEKDAY_NAMES[habit.bestDayOfWeek] },
    });
  } else if (habit.completionRate < 50 && !habit.isAutomatic) {
    actions.push({
      id: `min-${habit.habitId}`,
      label: "Create minimum version",
      emoji: "⚡",
      type: "create_minimum",
      payload: { habits: [{ id: habit.habitId, name: habit.habitName }] },
    });
  }

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">
            {habit.habitName}
          </span>
          <span className={`text-[9px] font-bold uppercase tracking-wider ${statusColor}`}>
            {statusLabel}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-gray-400 flex-shrink-0">
          {habit.currentStreak > 0 && (
            <span className="flex items-center gap-0.5">
              🔥 {habit.currentStreak}d
            </span>
          )}
          <span className="font-bold">{habit.completionRate}%</span>
          {habit.trend !== 0 && (
            <span className={habit.trend > 0 ? "text-emerald-500" : "text-red-500"}>
              {habit.trend > 0 ? "↑" : "↓"}{Math.abs(habit.trend)}%
            </span>
          )}
          {actions.length > 0 && (
            <button
              onClick={() => setShowActions(!showActions)}
              className="ml-1 w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-[10px]"
              title="Show actions"
            >
              {showActions ? "✕" : "⚡"}
            </button>
          )}
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${Math.min(100, habit.completionRate)}%` }}
        />
      </div>

      {showActions && actions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
          {actions.map((action) => (
            <ActionButton key={action.id} action={action} sourceId={habit.habitId} onAction={onAction} />
          ))}
        </div>
      )}

      {!showActions && (
        <div className="hidden group-hover:flex items-center gap-3 mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
          <span>Best: {WEEKDAY_NAMES[habit.bestDayOfWeek]}</span>
          <span>Worst: {WEEKDAY_NAMES[habit.worstDayOfWeek]}</span>
          <span>Consistency: {habit.consistencyScore}%</span>
          {habit.correlatedHabits.length > 0 && (
            <span>Pairs with: {habit.correlatedHabits[0].habitName}</span>
          )}
        </div>
      )}
    </div>
  );
}
