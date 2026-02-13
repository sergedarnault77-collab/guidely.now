import { useState } from 'react'

export function PredictionsAccordion() {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors rounded-xl"
      >
        HOW PREDICTIONS WORK
        <span className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>▾</span>
      </button>
      {open && (
        <div className="px-4 pb-4 text-xs text-gray-500 dark:text-gray-400 space-y-2">
          <p>Our AI analyzes your completion patterns, time-of-day preferences, and task categories to predict how likely you are to complete each item.</p>
          <p>Predictions improve over time as we learn your habits. The &quot;Peak Window&quot; suggests your most productive time based on historical data.</p>
          <p>Priority is auto-assigned based on deadlines, category urgency, and overdue status.</p>
        </div>
      )}
    </div>
  )
}
