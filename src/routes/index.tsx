import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useHabits } from '@/lib/context'
import { MONTHS, getDaysInMonth, calculateMonthProgress, calculateDailyProgress, getWeekKey, WEEKDAY_SHORT } from '@/lib/types'
import { ProgressRing } from '@/components/ProgressRing'
import { MiniChart } from '@/components/MiniChart'
import { ActivityFeed } from '@/components/ActivityFeed'
import { SmartNotifications } from '@/components/SmartNotifications'
import { BehaviorInsights } from '@/components/BehaviorInsights'
import { AIBanner } from '@/components/AIBanner'
import { SmartScheduleBar } from '@/components/SmartScheduleBar'
import { SyncModal } from '@/components/SyncModal'
import { analyzeUserBehavior } from '@/lib/behavior-analytics'
import { generateSmartNotifications } from '@/lib/smart-notifications'
import { useCloudStatus } from '@/lib/cloud-status'

export const Route = createFileRoute('/')(
  {
    component: DashboardPage,
  }
)

/* ── Loading skeleton shown while checking cloud connectivity ── */
function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
      <div className="space-y-6">
        {/* Header skeleton */}
        <div>
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
          <div className="h-4 w-48 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
        {/* Cards skeleton */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40" />
          ))}
        </div>
        {/* Content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40" />
          <div className="h-64 rounded-2xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40" />
        </div>
      </div>
    </div>
  )
}

function DashboardContent() {
  const now = new Date()
  const {
    data,
    weeklyData,
    selectedYear,
    toggleHabit,
    setMood,
    setMotivation,
    isAuthenticated,
  } = useHabits()

  const [activeMonth, setActiveMonth] = useState(now.getMonth() + 1)
  const [showSyncModal, setShowSyncModal] = useState(false)

  const monthKey = `${selectedYear}-${String(activeMonth).padStart(2, '0')}`
  const monthData = data[monthKey] || { habits: [], days: {} }
  const daysInMonth = getDaysInMonth(selectedYear, activeMonth)
  const stats = calculateMonthProgress(monthData, daysInMonth)
  const monthName = MONTHS[activeMonth - 1]

  // Analyze behavior for insights
  const insights = useMemo(() => {
    return analyzeUserBehavior(data, weeklyData, selectedYear)
  }, [data, weeklyData, selectedYear])

  // Generate smart notifications
  const notifications = useMemo(() => {
    return generateSmartNotifications(insights, data, weeklyData, selectedYear)
  }, [insights, data, weeklyData, selectedYear])

  // Get this week's data
  const weekKey = getWeekKey(now)
  const weekData = weeklyData[weekKey] || { tasks: [], habits: [], notes: '' }

  const handleToggleHabit = (day: number, habitId: string) => {
    toggleHabit(selectedYear, activeMonth, day, habitId)
  }

  const handleSetMood = (day: number, mood: number) => {
    setMood(selectedYear, activeMonth, day, mood)
  }

  const handleSetMotivation = (day: number, motivation: number) => {
    setMotivation(selectedYear, activeMonth, day, motivation)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            {monthName} {selectedYear} • {stats.completed} of {daysInMonth} days tracked
          </p>
        </div>

        {/* Smart Notifications */}
        {notifications.length > 0 && <SmartNotifications notifications={notifications} />}

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                  Completion
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
                  {Math.round(stats.percentage)}%
                </p>
              </div>
              <ProgressRing percentage={stats.percentage} size={60} />
            </div>
          </div>

          <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-4 sm:p-6">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Habits Tracked
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {monthData.habits.length}
            </p>
          </div>

          <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-4 sm:p-6">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              Avg Mood
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {(() => {
                const moods = Object.values(monthData.days).map(d => d.mood);
                return moods.length > 0 ? (moods.reduce((a, b) => a + b, 0) / moods.length).toFixed(1) : '—';
              })()}
            </p>
          </div>

          <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-4 sm:p-6">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
              This Week
            </p>
            <p className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mt-2">
              {weekData.tasks.length}
            </p>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Habit Tracker */}
          <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              {monthName} Habits
            </h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {monthData.habits.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No habits tracked yet. Add one from the Tracker page.
                </p>
              ) : (
                monthData.habits.map((habit) => {
                  const completedDays = Object.values(monthData.days).filter(
                    (day) => day.completedHabits && day.completedHabits.includes(habit.id)
                  ).length
                  const percentage = (completedDays / daysInMonth) * 100

                  return (
                    <div key={habit.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {habit.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {completedDays} of {daysInMonth} days
                        </p>
                      </div>
                      <ProgressRing percentage={percentage} size={40} />
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Weekly Overview */}
          <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
              This Week
            </h2>
            <div className="space-y-3">
              {weekData.tasks && weekData.tasks.length > 0 ? (
                <SmartScheduleBar />
              ) : (
                <p className="text-sm text-gray-500 dark:text-gray-400">No tasks this week</p>
              )}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  to="/weekly"
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors"
                >
                  View full week →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Behavior Insights */}
        {Array.isArray(insights) && insights.length > 0 && (
          <BehaviorInsights profile={insights[0]} />
        )}

        {/* AI Banner */}
        <AIBanner />

        {/* Activity Feed */}
        <ActivityFeed isAuthenticated={isAuthenticated} data={data} weeklyData={weeklyData} selectedYear={selectedYear} />

        {/* Sync Modal */}
        {showSyncModal && (
          <SyncModal
            open={showSyncModal}
            onClose={() => setShowSyncModal(false)}
            onSyncComplete={() => setShowSyncModal(false)}
          />
        )}
      </div>
    </div>
  )
}

function DashboardPage() {
  const { syncMode, checking } = useCloudStatus()
  const convexUrl = import.meta.env.VITE_CONVEX_URL

  // Show skeleton while checking connectivity
  if (checking) {
    return <DashboardSkeleton />
  }

  // Always render content (safe in local or cloud mode)
  return <DashboardContent />
}
