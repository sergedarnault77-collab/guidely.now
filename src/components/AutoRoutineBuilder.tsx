import { useState } from "react";
import type { SuggestedRoutine } from "../lib/behavior-analytics";

interface AutoRoutineBuilderProps {
  routines: SuggestedRoutine[];
}

const categoryColors: Record<string, { bg: string; text: string; border: string }> = {
  planning: { bg: "bg-indigo-100 dark:bg-indigo-900/30", text: "text-indigo-700 dark:text-indigo-300", border: "border-indigo-200 dark:border-indigo-800" },
  review: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300", border: "border-purple-200 dark:border-purple-800" },
  wellness: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", border: "border-emerald-200 dark:border-emerald-800" },
  focus: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", border: "border-amber-200 dark:border-amber-800" },
  social: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300", border: "border-pink-200 dark:border-pink-800" },
};

const frequencyLabels: Record<string, string> = {
  daily: "Every day",
  weekly: "Once a week",
  biweekly: "Every 2 weeks",
};

export function AutoRoutineBuilder({ routines }: AutoRoutineBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [adoptedIds, setAdoptedIds] = useState<Set<string>>(new Set());

  if (routines.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800/50 rounded-2xl p-6 border border-gray-200/60 dark:border-gray-700/40 text-center">
        <span className="text-3xl block mb-2">🔄</span>
        <p className="text-sm text-gray-500 dark:text-gray-400">Keep tracking for a few more days and I'll suggest personalized routines based on your patterns.</p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-cyan-50 via-white to-teal-50 dark:from-gray-800/80 dark:via-gray-800/60 dark:to-cyan-900/20 rounded-2xl border border-cyan-200/50 dark:border-cyan-700/30 overflow-hidden shadow-sm">
      <div className="p-4 border-b border-cyan-200/30 dark:border-cyan-700/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-teal-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <span className="text-white text-lg">🔄</span>
          </div>
          <div>
            <h3 className="font-semibold text-sm flex items-center gap-2">
              Auto-Routine Builder
              <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-cyan-100 dark:bg-cyan-900/50 text-cyan-600 dark:text-cyan-300 uppercase tracking-wider">
                AI
              </span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {routines.length} routine{routines.length !== 1 ? "s" : ""} suggested based on your behavior patterns
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {routines.map((routine) => {
          const isExpanded = expandedId === routine.id;
          const isAdopted = adoptedIds.has(routine.id);
          const colors = categoryColors[routine.category] || categoryColors.planning;

          return (
            <div
              key={routine.id}
              className={`rounded-xl border transition-all duration-300 ${
                isAdopted
                  ? "border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-900/10"
                  : "border-gray-200 dark:border-gray-700/40 bg-white/60 dark:bg-gray-800/40"
              }`}
            >
              <button
                onClick={() => setExpandedId(isExpanded ? null : routine.id)}
                className="w-full p-3 flex items-start gap-3 text-left"
              >
                <span className="text-xl flex-shrink-0 mt-0.5">{routine.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-sm font-semibold ${isAdopted ? "text-emerald-600 dark:text-emerald-400" : "text-gray-800 dark:text-gray-200"}`}>
                      {routine.name}
                    </span>
                    <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-full uppercase tracking-wider ${colors.bg} ${colors.text}`}>
                      {routine.category}
                    </span>
                    <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      {routine.frequency}
                    </span>
                    {isAdopted && (
                      <span className="px-1.5 py-0.5 text-[8px] font-bold rounded-full bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-300 uppercase tracking-wider">
                        ✓ Adopted
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{routine.description}</p>
                  {routine.suggestedDay && (
                    <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5">
                      📅 {routine.suggestedDay}{routine.suggestedTime ? ` at ${routine.suggestedTime}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-center">
                    <p className="text-[9px] text-gray-400 dark:text-gray-500">Confidence</p>
                    <p className={`text-xs font-bold ${routine.confidence >= 80 ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                      {routine.confidence}%
                    </p>
                  </div>
                  <span className={`text-xs transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>▾</span>
                </div>
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="ml-9 space-y-3">
                    {/* Tasks */}
                    <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/60 border border-gray-200/40 dark:border-gray-700/30">
                      <p className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-bold mb-2">Routine Steps</p>
                      <div className="space-y-1.5">
                        {routine.tasks.map((task, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <span className="w-5 h-5 rounded-full bg-cyan-100 dark:bg-cyan-900/40 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-[10px] font-bold flex-shrink-0 mt-0.5">
                              {i + 1}
                            </span>
                            <span className="text-xs text-gray-700 dark:text-gray-300">{task}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Schedule */}
                    <div className="flex items-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
                      <span>📅 {frequencyLabels[routine.frequency]}</span>
                      {routine.suggestedDay && <span>📌 {routine.suggestedDay}</span>}
                      {routine.suggestedTime && <span>⏰ {routine.suggestedTime}</span>}
                    </div>

                    {/* Rationale */}
                    <div className="p-2.5 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200/30 dark:border-cyan-800/30">
                      <p className="text-[10px] text-cyan-700 dark:text-cyan-300 italic">
                        💡 {routine.rationale}
                      </p>
                    </div>

                    {/* Adopt button */}
                    {!isAdopted ? (
                      <button
                        onClick={() => setAdoptedIds(prev => new Set([...prev, routine.id]))}
                        className="w-full py-2 rounded-lg bg-cyan-500 text-white text-xs font-semibold hover:bg-cyan-600 shadow-md shadow-cyan-500/20 hover:shadow-cyan-500/40 transition-all duration-200 hover:scale-[1.02]"
                      >
                        ✨ Adopt This Routine
                      </button>
                    ) : (
                      <div className="flex items-center justify-center gap-2 py-2 text-emerald-600 dark:text-emerald-400">
                        <span>✅</span>
                        <span className="text-xs font-semibold">Routine adopted! Add these tasks to your weekly planner.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
