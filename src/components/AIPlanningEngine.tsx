import { useState, useMemo, useCallback } from "react";
import { useAIAccess } from "@/hooks/useAIAccess";
import { LockedFeature } from "@/lib/subscription";
import type { YearData, MonthData, WeeklyStore, WeeklyTask, Habit } from "../lib/types";
import {
  generateEnhancedAgenda,
  interpretTask,
  predictCompletion,
  formatDuration,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type EnhancedAgendaItem,
  type EnhancedDailyAgenda,
  type TaskInterpretation,
  type PredictiveScore,
} from "../lib/smart-task-ai";

// Re-export types for backward compat
export interface SuggestedTask {
  id: string;
  text: string;
  reason: string;
  priority: "high" | "medium" | "low";
  category: "habit" | "weekly" | "wellness" | "planning" | "review";
  source: string;
}

export interface DailyPlan {
  date: Date;
  suggestedTasks: SuggestedTask[];
  focusHabit: { name: string; reason: string } | null;
  timeBlocks: TimeBlock[];
  motivationalNote: string;
}

export interface TimeBlock {
  label: string;
  emoji: string;
  tasks: string[];
}

// ---- Prediction Score Ring ----

function PredictionRing({ score, size = 36, label }: { score: number; size?: number; label?: string }) {
  const radius = (size - 6) / 2;
  const circumference = 2 * Math.PI * radius;
  const color = score >= 75 ? "#22c55e" : score >= 50 ? "#f59e0b" : "#ef4444";

  return (
    <div className="relative flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="currentColor" strokeWidth="3"
          className="text-gray-200 dark:text-gray-700"
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold">
        {score}%
      </span>
      {label && <span className="text-[8px] text-gray-400 mt-0.5">{label}</span>}
    </div>
  );
}

// ---- Prediction Detail Popover ----

function PredictionDetail({ prediction, onClose }: { prediction: PredictiveScore; onClose: () => void }) {
  return (
    <div className="absolute right-0 top-full mt-1 z-50 w-72 p-3 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Completion Prediction</span>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 text-xs">✕</button>
      </div>

      {/* Score comparison */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex-1 text-center p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/30">
          <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{prediction.completeNowScore}%</p>
          <p className="text-[9px] text-gray-500 dark:text-gray-400">Now</p>
        </div>
        <div className="flex-1 text-center p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/50 dark:border-amber-800/30">
          <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{prediction.completeLaterScore}%</p>
          <p className="text-[9px] text-gray-500 dark:text-gray-400">Later</p>
        </div>
        <div className="flex-1 text-center p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200/50 dark:border-blue-800/30">
          <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{prediction.completeTomorrowScore}%</p>
          <p className="text-[9px] text-gray-500 dark:text-gray-400">Tomorrow</p>
        </div>
      </div>

      {/* Factors */}
      <div className="space-y-1.5 mb-2">
        {prediction.factors.map((factor, i) => (
          <div key={i} className="flex items-center gap-2 text-[10px]">
            <span>{factor.emoji}</span>
            <span className="flex-1 text-gray-600 dark:text-gray-400">{factor.label}</span>
            <span className={`font-bold ${factor.impact > 0 ? "text-emerald-600 dark:text-emerald-400" : factor.impact < 0 ? "text-red-500 dark:text-red-400" : "text-gray-400"}`}>
              {factor.impact > 0 ? "+" : ""}{factor.impact}
            </span>
          </div>
        ))}
      </div>

      {/* Recommendation */}
      <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/30 dark:border-indigo-800/30">
        <p className="text-[10px] text-indigo-700 dark:text-indigo-300 font-medium">
          💡 {prediction.recommendation}
        </p>
      </div>
    </div>
  );
}

// ---- Enhanced Agenda Item ----

function AgendaItemCard({
  item,
  isAccepted,
  onAccept,
  onDismiss,
}: {
  item: EnhancedAgendaItem;
  isAccepted: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const [showPrediction, setShowPrediction] = useState(false);
  const [showReminder, setShowReminder] = useState(false);

  const { interpretation, prediction, reminder } = item;
  const catColors = CATEGORY_COLORS[interpretation.category];

  const priorityColors = {
    high: "border-red-200 dark:border-red-800/40 bg-red-50/30 dark:bg-red-900/10",
    medium: "border-amber-200 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-900/10",
    low: "border-gray-200 dark:border-gray-700/40 bg-gray-50/30 dark:bg-gray-800/20",
  };

  const priorityBadge = {
    high: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    medium: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
    low: "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400",
  };

  const sourceEmoji = {
    habit: "✅",
    weekly: "📋",
    overdue: "⚠️",
    "ai-suggested": "🤖",
  };

  return (
    <div
      className={`relative p-3 rounded-xl border transition-all duration-300 ${
        isAccepted
          ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10 opacity-60"
          : priorityColors[interpretation.priority]
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Left: Category emoji + prediction ring */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0">
          <span className="text-sm">{interpretation.emoji}</span>
          <PredictionRing score={prediction.completeNowScore} size={32} />
        </div>

        {/* Center: Task info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
            <span className={`text-xs font-semibold ${isAccepted ? "line-through text-gray-400" : "text-gray-800 dark:text-gray-200"}`}>
              {item.text}
            </span>
            <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-full uppercase tracking-wider ${priorityBadge[interpretation.priority]}`}>
              {interpretation.priority}
            </span>
          </div>

          {/* Category + Duration + Source */}
          <div className="flex items-center gap-1.5 flex-wrap mt-1">
            <span className={`px-1.5 py-0.5 text-[8px] font-semibold rounded-full ${catColors.bg} ${catColors.text}`}>
              {CATEGORY_LABELS[interpretation.category]}
            </span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500">
              ~{formatDuration(interpretation.estimatedMinutes)}
            </span>
            <span className="text-[9px] text-gray-400 dark:text-gray-500">
              {sourceEmoji[item.source]} {item.sourceDetail}
            </span>
          </div>

          {/* Adaptive Reminder */}
          {reminder && !isAccepted && (
            <div className="mt-1.5">
              <button
                onClick={() => setShowReminder(!showReminder)}
                className="text-[9px] text-indigo-500 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1 transition-colors"
              >
                <span>⏰</span>
                <span>{reminder.suggestedTimeLabel}</span>
                <span className="text-[8px]">·</span>
                <span className="italic">{reminder.nudgeStyle}</span>
                <span className={`transition-transform duration-200 ${showReminder ? "rotate-180" : ""}`}>▾</span>
              </button>
              {showReminder && (
                <div className="mt-1 p-2 rounded-lg bg-indigo-50/80 dark:bg-indigo-900/20 border border-indigo-200/30 dark:border-indigo-800/30 animate-in fade-in slide-in-from-top-1 duration-200">
                  <p className="text-[10px] text-indigo-700 dark:text-indigo-300 italic">
                    &quot;{reminder.message}&quot;
                  </p>
                  <p className="text-[9px] text-gray-500 dark:text-gray-400 mt-0.5">
                    {reminder.reason}
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Tags */}
          {interpretation.tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1 flex-wrap">
              {interpretation.tags.map((tag) => (
                <span key={tag} className="px-1 py-0.5 text-[8px] rounded bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Right: Actions + Prediction detail */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 relative">
          {!isAccepted && (
            <>
              <button
                onClick={() => setShowPrediction(!showPrediction)}
                className="w-7 h-7 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center hover:bg-indigo-200 dark:hover:bg-indigo-900/60 transition-colors text-[10px]"
                title="View prediction"
              >
                📊
              </button>
              <button
                onClick={onAccept}
                className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-200 dark:hover:bg-emerald-900/60 transition-colors text-xs"
                title="Accept"
              >
                ✓
              </button>
              <button
                onClick={onDismiss}
                className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-400 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-[10px]"
                title="Dismiss"
              >
                ✕
              </button>
            </>
          )}
          {showPrediction && (
            <PredictionDetail
              prediction={prediction}
              onClose={() => setShowPrediction(false)}
            />
          )}
        </div>
      </div>
    </div>
  );
}

// ---- UI Component ----

interface DailyPlannerProps {
  data: YearData;
  weeklyData: WeeklyStore;
  selectedYear: number;
  onAddToWeekly?: (text: string, dayIndex: number) => void;
}

export function DailyPlanner({ data, weeklyData, selectedYear, onAddToWeekly }: DailyPlannerProps) {
  const { enabled, reason } = useAIAccess();
  const [expandedSection, setExpandedSection] = useState<string | null>("agenda");
  const [acceptedTasks, setAcceptedTasks] = useState<Set<string>>(new Set());
  const [dismissedTasks, setDismissedTasks] = useState<Set<string>>(new Set());

  const agenda = useMemo(
    () => generateEnhancedAgenda(data, weeklyData, selectedYear),
    [data, weeklyData, selectedYear]
  );

  const visibleItems = agenda.items.filter(
    (item) => !dismissedTasks.has(item.id)
  );

  if (!enabled) {
    return (
      <LockedFeature
        reason={reason === "upgrade" ? "needs_pro" : "needs_cloud"}
        featureLabel="AI daily agenda"
      />
    );
  }

  const handleAccept = useCallback((item: EnhancedAgendaItem) => {
    setAcceptedTasks((prev) => new Set([...prev, item.id]));
    if (onAddToWeekly && item.source === "weekly") {
      const todayDayIdx = (new Date().getDay() + 6) % 7;
      onAddToWeekly(item.text, todayDayIdx);
    }
  }, [onAddToWeekly]);

  const handleDismiss = useCallback((itemId: string) => {
    setDismissedTasks((prev) => new Set([...prev, itemId]));
  }, []);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const { summary } = agenda;

  return (
    <div className="bg-gradient-to-br from-indigo-50 via-white to-cyan-50 dark:from-gray-800/80 dark:via-gray-800/60 dark:to-indigo-900/20 rounded-2xl border border-indigo-200/50 dark:border-indigo-700/30 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="p-4 border-b border-indigo-200/30 dark:border-indigo-700/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <span className="text-white text-lg">⚡</span>
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              AI Daily Agenda
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-300 uppercase tracking-wider">
                Predictive
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {summary.totalItems} items · ~{formatDuration(summary.totalMinutes)} · {summary.predictedCompletionRate}% predicted completion
            </p>
          </div>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="px-4 pt-3">
        <div className="grid grid-cols-4 gap-2">
          <div className="text-center p-2 rounded-lg bg-white/60 dark:bg-gray-800/40 border border-gray-200/30 dark:border-gray-700/20">
            <p className="text-lg font-bold text-indigo-600 dark:text-indigo-400">{summary.totalItems}</p>
            <p className="text-[9px] text-gray-500 dark:text-gray-400">Tasks</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/60 dark:bg-gray-800/40 border border-gray-200/30 dark:border-gray-700/20">
            <p className="text-lg font-bold text-red-500 dark:text-red-400">{summary.highPriorityCount}</p>
            <p className="text-[9px] text-gray-500 dark:text-gray-400">Urgent</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/60 dark:bg-gray-800/40 border border-gray-200/30 dark:border-gray-700/20">
            <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{summary.predictedCompletionRate}%</p>
            <p className="text-[9px] text-gray-500 dark:text-gray-400">Predicted</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-white/60 dark:bg-gray-800/40 border border-gray-200/30 dark:border-gray-700/20">
            <p className="text-sm font-bold text-amber-600 dark:text-amber-400">{summary.peakProductivityWindow}</p>
            <p className="text-[9px] text-gray-500 dark:text-gray-400">Peak Window</p>
          </div>
        </div>
        <p className="text-[11px] text-center text-indigo-600 dark:text-indigo-400 mt-2 font-medium italic">
          {summary.motivationalMessage}
        </p>
      </div>

      {/* Enhanced Agenda Items */}
      <div className="p-4">
        <button
          onClick={() => toggleSection("agenda")}
          className="w-full flex items-center justify-between mb-3"
        >
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            Prioritized Agenda ({visibleItems.length})
          </span>
          <span className={`text-xs transition-transform duration-200 ${expandedSection === "agenda" ? "rotate-180" : ""}`}>▾</span>
        </button>

        {expandedSection === "agenda" && (
          <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
            {visibleItems.map((item) => (
              <AgendaItemCard
                key={item.id}
                item={item}
                isAccepted={acceptedTasks.has(item.id)}
                onAccept={() => handleAccept(item)}
                onDismiss={() => handleDismiss(item.id)}
              />
            ))}

            {visibleItems.length === 0 && (
              <div className="text-center py-6">
                <span className="text-2xl block mb-1">🎉</span>
                <p className="text-xs text-gray-500 dark:text-gray-400">All tasks handled! You&apos;re on top of things.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prediction Legend */}
      <div className="px-4 pb-4">
        <button
          onClick={() => toggleSection("legend")}
          className="w-full flex items-center justify-between mb-2"
        >
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
            How Predictions Work
          </span>
          <span className={`text-xs transition-transform duration-200 ${expandedSection === "legend" ? "rotate-180" : ""}`}>▾</span>
        </button>

        {expandedSection === "legend" && (
          <div className="p-3 rounded-xl bg-white/60 dark:bg-gray-800/40 border border-gray-200/30 dark:border-gray-700/20 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>75%+ — Ideal conditions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span>50-74% — Good conditions</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span>&lt;50% — Consider deferring</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span>📊</span>
                <span>Click for full breakdown</span>
              </div>
            </div>
            <p className="text-[9px] text-gray-400 dark:text-gray-500 mt-2 italic">
              Scores are based on your time of day, mood, day-of-week patterns, current momentum, task type, and weekly completion history.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
