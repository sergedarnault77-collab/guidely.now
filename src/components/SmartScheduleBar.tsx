import { useState, useEffect, useCallback, useRef } from "react";
import {
  interpretTask,
  parseSchedule,
  formatDuration,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type TaskInterpretation,
  type ParsedSchedule,
} from "../lib/smart-task-ai";
import { useHabits } from "../lib/context";
import { getWeekStartDate } from "../lib/types";
import { useAIAccess } from "@/hooks/useAIAccess";
import { LockedFeature } from "@/lib/subscription";

export function SmartScheduleBar() {
  const { enabled, reason } = useAIAccess();
  const { addWeeklyTask, initWeek, weeklyData } = useHabits();
  const [text, setText] = useState("");
  const [interpretation, setInterpretation] = useState<TaskInterpretation | null>(null);
  const [schedule, setSchedule] = useState<ParsedSchedule | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!enabled || text.trim().length < 3) {
      setInterpretation(null);
      setSchedule(null);
      setShowPreview(false);
      return;
    }
    const timer = setTimeout(() => {
      const parsed = parseSchedule(text);
      const taskText = parsed.cleanedText || text;
      const interp = interpretTask(taskText);
      setInterpretation(interp);
      setSchedule(parsed);
      setShowPreview(true);
    }, 250);
    return () => clearTimeout(timer);
  }, [text, enabled]);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim()) return;

      const parsed = parseSchedule(text);
      const taskText = parsed.cleanedText || text.trim();

      if (parsed.date && parsed.weekKey !== null && parsed.dayIndex !== null) {
        if (!weeklyData[parsed.weekKey]) {
          const weekStart = getWeekStartDate(parsed.date);
          initWeek(parsed.weekKey, weekStart);
        }
        setTimeout(() => {
          addWeeklyTask(parsed.weekKey!, taskText, parsed.dayIndex!);
        }, 50);

        const timeStr = parsed.formattedTime ? ` at ${parsed.formattedTime}` : "";
        setJustAdded(`"${taskText}" scheduled for ${parsed.formattedDate}${timeStr}`);
      } else {
        const now = new Date();
        const todayDow = (now.getDay() + 6) % 7;
        const todayWeekKey = getWeekKeyForDate(now);
        if (!weeklyData[todayWeekKey]) {
          const weekStart = getWeekStartDate(now);
          initWeek(todayWeekKey, weekStart);
        }
        setTimeout(() => {
          addWeeklyTask(todayWeekKey, taskText, todayDow);
        }, 50);
        setJustAdded(`"${taskText}" added to today`);
      }

      setText("");
      setInterpretation(null);
      setSchedule(null);
      setShowPreview(false);

      setTimeout(() => setJustAdded(null), 4000);
    },
    [text, weeklyData, addWeeklyTask, initWeek]
  );

  const priorityDot: Record<string, string> = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-gray-400",
  };

  const hasSchedule = schedule?.date !== null;

  if (!enabled) {
    return (
      <LockedFeature
        reason={reason === "upgrade" ? "needs_pro" : "needs_cloud"}
        featureLabel="AI task scheduling"
      />
    );
  }

  return (
    <div className="relative">
      {/* Main Input Bar */}
      <div
        className={`relative bg-white dark:bg-gray-800/80 rounded-2xl border transition-all duration-300 shadow-sm ${
          isFocused
            ? "border-indigo-400 dark:border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/20"
            : "border-gray-200/60 dark:border-gray-700/40 hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md"
        }`}
      >
        <form onSubmit={handleSubmit} className="flex items-center">
          <div className="flex items-center pl-5 pr-2 text-gray-400">
            <span className="text-xl">✨</span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            placeholder='What would you like to add? e.g. "Call garage for a check on Tuesday 17 Feb 2026 at 13:00"'
            className="flex-1 px-3 py-4 text-sm bg-transparent focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          {text.trim() && (
            <div className="flex items-center gap-2 pr-3">
              {interpretation && showPreview && (
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${priorityDot[interpretation.priority]}`} />
                  <span className="text-xs text-gray-400">{interpretation.emoji}</span>
                </div>
              )}
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/40 transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Schedule
              </button>
            </div>
          )}
        </form>
      </div>

      {/* AI Preview Card */}
      {interpretation && showPreview && text.trim().length >= 3 && (
        <div className="mt-2 p-3 rounded-xl bg-gradient-to-r from-indigo-50/90 to-purple-50/90 dark:from-indigo-900/30 dark:to-purple-900/30 border border-indigo-200/50 dark:border-indigo-800/40 animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex flex-col items-center gap-1 pt-0.5">
              <span className="text-lg">{interpretation.emoji}</span>
              <span className="text-[8px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider">AI</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                  {schedule?.cleanedText || text.trim()}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {CATEGORY_COLORS[interpretation.category] && (
                  <span
                    className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${CATEGORY_COLORS[interpretation.category].bg} ${CATEGORY_COLORS[interpretation.category].text}`}
                  >
                    {CATEGORY_LABELS[interpretation.category]}
                  </span>
                )}
                <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  ⏱ ~{formatDuration(interpretation.estimatedMinutes)}
                </span>
                <span
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase ${
                    interpretation.priority === "high"
                      ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300"
                      : interpretation.priority === "medium"
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {interpretation.priority}
                </span>
                {interpretation.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 text-[9px] rounded bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
              {hasSchedule && schedule && (
                <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-white/60 dark:bg-gray-800/40 border border-indigo-100 dark:border-indigo-800/30">
                  <span className="text-sm">📅</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">
                      {schedule.formattedDate}
                    </span>
                    {schedule.formattedTime && (
                      <>
                        <span className="text-gray-300 dark:text-gray-600">·</span>
                        <span className="text-xs font-medium text-purple-700 dark:text-purple-300 flex items-center gap-1">
                          🕐 {schedule.formattedTime}
                        </span>
                      </>
                    )}
                    {schedule.isPast && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300">
                        ⚠ Past date
                      </span>
                    )}
                    {schedule.isToday && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300">
                        Today
                      </span>
                    )}
                    {schedule.isTomorrow && (
                      <span className="px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-300">
                        Tomorrow
                      </span>
                    )}
                  </div>
                </div>
              )}
              {!hasSchedule && text.trim().length >= 5 && (
                <div className="mt-2 flex items-center gap-2 p-2 rounded-lg bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200/40 dark:border-amber-800/30">
                  <span className="text-sm">💡</span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-300">
                    No date detected — will be added to today. Try adding a date like "tomorrow", "friday", or "17 feb 2026"
                  </span>
                </div>
              )}
              {interpretation.suggestion && (
                <p className="text-[10px] text-indigo-600 dark:text-indigo-400 mt-1.5 italic">
                  💡 {interpretation.suggestion}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-[9px] text-gray-400">{interpretation.confidence}%</span>
              <div className="w-10 h-1 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-300"
                  style={{ width: `${interpretation.confidence}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Toast */}
      {justAdded && (
        <div className="mt-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-700/40 animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-2">
          <span className="text-lg">✅</span>
          <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{justAdded}</span>
        </div>
      )}

      {/* Quick suggestions */}
      {isFocused && !text.trim() && (
        <div className="mt-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-200/40 dark:border-gray-700/30 animate-in fade-in duration-200">
          <p className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
            Try saying...
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Gym workout tomorrow at 7am",
              "Call dentist on Friday",
              "Review budget next Monday at 10:00",
              "Buy groceries today",
              "Team meeting Wednesday at 14:00",
              "Read 30 pages tonight",
            ].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setText(suggestion);
                  inputRef.current?.focus();
                }}
                className="px-3 py-1.5 text-xs rounded-lg bg-white dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600/50 text-gray-600 dark:text-gray-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-indigo-700 dark:hover:text-indigo-300 transition-all duration-200 cursor-pointer"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Simple non-AI task input shown in local mode */
function SimpleTaskBar() {
  const { addWeeklyTask, initWeek, weeklyData } = useHabits();
  const [text, setText] = useState("");
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!text.trim()) return;

      const now = new Date();
      const todayDow = (now.getDay() + 6) % 7;
      const todayWeekKey = getWeekKeyForDate(now);
      if (!weeklyData[todayWeekKey]) {
        const weekStart = getWeekStartDate(now);
        initWeek(todayWeekKey, weekStart);
      }
      setTimeout(() => {
        addWeeklyTask(todayWeekKey, text.trim(), todayDow);
      }, 50);
      setJustAdded(`"${text.trim()}" added to today`);
      setText("");
      setTimeout(() => setJustAdded(null), 4000);
    },
    [text, weeklyData, addWeeklyTask, initWeek]
  );

  return (
    <div className="relative">
      <div className="relative bg-white dark:bg-gray-800/80 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 shadow-sm hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-md transition-all duration-300">
        <form onSubmit={handleSubmit} className="flex items-center">
          <div className="flex items-center pl-5 pr-2 text-gray-400">
            <span className="text-xl">➕</span>
          </div>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a task for today..."
            className="flex-1 px-3 py-4 text-sm bg-transparent focus:outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          {text.trim() && (
            <div className="pr-3">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-500 text-white hover:bg-indigo-600 shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
              >
                Add
              </button>
            </div>
          )}
        </form>
      </div>
      {justAdded && (
        <div className="mt-2 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200/60 dark:border-emerald-700/40 animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-2">
          <span className="text-lg">✅</span>
          <span className="text-sm text-emerald-700 dark:text-emerald-300 font-medium">{justAdded}</span>
        </div>
      )}
    </div>
  );
}

function getWeekKeyForDate(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayNum = d.getDay() || 7;
  d.setDate(d.getDate() + 4 - dayNum);
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}
