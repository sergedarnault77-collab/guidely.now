import { useState, useEffect, useCallback } from "react";
import {
  interpretTask,
  formatDuration,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type TaskInterpretation,
} from "../lib/smart-task-ai";
import { useAIAccess } from "@/hooks/useAIAccess";
import { LockedFeature } from "@/lib/subscription";

interface SmartTaskInputProps {
  onAddTask: (text: string) => void;
  placeholder?: string;
  className?: string;
}

export function SmartTaskInput({ onAddTask, placeholder = "Add a task...", className = "" }: SmartTaskInputProps) {
  const [text, setText] = useState("");
  const [interpretation, setInterpretation] = useState<TaskInterpretation | null>(null);
  const [showAI, setShowAI] = useState(false);
  const { enabled, reason } = useAIAccess();

  useEffect(() => {
    // Only run AI interpretation if feature is allowed
    if (!enabled || text.trim().length < 3) {
      setInterpretation(null);
      setShowAI(false);
      return;
    }
    const timer = setTimeout(() => {
      const result = interpretTask(text);
      setInterpretation(result);
      setShowAI(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [text, enabled]);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAddTask(text.trim());
    setText("");
    setInterpretation(null);
    setShowAI(false);
  }, [text, onAddTask]);

  const catColors = interpretation ? CATEGORY_COLORS[interpretation.category] : null;
  const priorityDot = {
    high: "bg-red-500",
    medium: "bg-amber-500",
    low: "bg-gray-400",
  };

  return (
    <div className={`relative ${className}`}>
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 dark:focus:border-indigo-500 transition-all placeholder:text-gray-400"
          />
          {enabled && interpretation && showAI && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full ${priorityDot[interpretation.priority]}`} />
              <span className="text-[9px] text-gray-400">{interpretation.emoji}</span>
            </div>
          )}
        </div>
        <button
          type="submit"
          disabled={!text.trim()}
          className="px-3 py-2 text-sm font-medium rounded-lg bg-indigo-500 text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md flex-shrink-0"
        >
          Add
        </button>
      </form>

      {/* AI Interpretation Preview — only shown when feature is allowed */}
      {enabled && interpretation && showAI && text.trim().length >= 3 && (
        <div className="mt-1.5 p-2 rounded-lg bg-gradient-to-r from-indigo-50/80 to-cyan-50/80 dark:from-indigo-900/20 dark:to-cyan-900/20 border border-indigo-200/40 dark:border-indigo-800/30 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
              🤖 AI
            </span>
            {catColors && (
              <span className={`px-1.5 py-0.5 text-[8px] font-semibold rounded-full ${catColors.bg} ${catColors.text}`}>
                {CATEGORY_LABELS[interpretation.category]}
              </span>
            )}
            <span className="text-[9px] text-gray-500 dark:text-gray-400">
              ~{formatDuration(interpretation.estimatedMinutes)}
            </span>
            <span className={`px-1.5 py-0.5 text-[8px] font-bold rounded-full uppercase ${
              interpretation.priority === "high" ? "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300" :
              interpretation.priority === "medium" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300" :
              "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
            }`}>
              {interpretation.priority}
            </span>
            {interpretation.tags.map((tag) => (
              <span key={tag} className="px-1 py-0.5 text-[8px] rounded bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
                #{tag}
              </span>
            ))}
            <span className="text-[8px] text-gray-400 ml-auto">{interpretation.confidence}% confident</span>
          </div>
          {interpretation.suggestion && (
            <p className="text-[9px] text-indigo-600 dark:text-indigo-400 mt-1 italic">
              💡 {interpretation.suggestion}
            </p>
          )}
        </div>
      )}

      {/* Locked state hint — shown when typing but AI is not available */}
      {!enabled && text.trim().length >= 3 && (
        <LockedFeature
          reason={reason === "upgrade" ? "needs_pro" : "needs_cloud"}
          featureLabel="AI task analysis"
          compact
        />
      )}
    </div>
  );
}
