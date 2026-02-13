import {
  formatDuration,
  CATEGORY_LABELS,
  CATEGORY_COLORS,
  type TaskInterpretation,
} from '@/lib/smart-task-ai'

interface AgendaCardProps {
  title: string
  interp: TaskInterpretation
  isOverdue: boolean
  dayLabel: string
  timeSlot: string
  completion: number
  onComplete: () => void
  onDismiss: () => void
}

const PRIO_COLORS = {
  high: 'bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300',
  medium: 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300',
  low: 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
}

export function AgendaCard({ title, interp, isOverdue, dayLabel, timeSlot, completion, onComplete, onDismiss }: AgendaCardProps) {
  const cat = CATEGORY_COLORS[interp.category]

  return (
    <div className="rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-4 space-y-2">
      {/* Title + priority */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span>{interp.emoji}</span>
          <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{title}</span>
        </div>
        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full uppercase shrink-0 ${PRIO_COLORS[interp.priority]}`}>
          {interp.priority}
        </span>
      </div>

      {/* Category + duration + schedule */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${cat.bg} ${cat.text}`}>
          {CATEGORY_LABELS[interp.category]}
        </span>
        <span className="text-gray-500 dark:text-gray-400">~{formatDuration(interp.estimatedMinutes)}</span>
        <span className={isOverdue ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-500 dark:text-gray-400'}>
          {dayLabel}
        </span>
      </div>

      {/* Time slot */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        ⏰ {timeSlot} · <span className="italic">motivational</span> ▾
      </div>

      {/* Tags + completion + actions */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {interp.tags.map((tag) => (
            <span key={tag} className="px-1.5 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-700/50 text-gray-500 dark:text-gray-400">
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{completion}%</span>
          <span className="text-xs text-gray-400">📊</span>
          <button onClick={onComplete} className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-sm hover:bg-emerald-200 transition-colors">✓</button>
          <button onClick={onDismiss} className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center justify-center text-sm hover:bg-red-200 transition-colors">✕</button>
        </div>
      </div>
    </div>
  )
}
