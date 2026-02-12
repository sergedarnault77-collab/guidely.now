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
import { useCloudState } from '@/hooks/useCloudState'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

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


function DashboardPage() {
  const cloudState = useCloudState()
  const { syncMode, setSyncMode } = useCloudStatus()

  // Show skeleton only while checking connectivity (brief moment on mount)
  if (cloudState === "loading") {
    return <DashboardSkeleton />
  }

  // Only query auth when fully online
  const shouldQueryAuth = cloudState === "online"

  return (
    <DashboardContent
      shouldQueryAuth={shouldQueryAuth}
      syncMode={syncMode}
      setSyncMode={setSyncMode}
    />
  )
}

/* ── Main dashboard content (always renders in local/offline/online) ── */
function DashboardContent({
  shouldQueryAuth,
  syncMode,
  setSyncMode,
}: {
  shouldQueryAuth: boolean
  syncMode: "local" | "cloud"
  setSyncMode: (mode: "local" | "cloud") => void
}) {
  const [showSyncModal, setShowSyncModal] = useState(false)

  const currentUser = useQuery(api.queries.getCurrentUser, shouldQueryAuth ? {} : 'skip')

  const isAuthenticated = shouldQueryAuth && !!currentUser
  const sessionName = currentUser?.name || currentUser?.email?.split('@')[0]

  const { data, weeklyData, selectedYear, getMonthData, toggleHabit } = useHabits()

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const monthData = getMonthData(selectedYear, currentMonth)
  const daysInMonth = getDaysInMonth(selectedYear, currentMonth)
  const progressData = calculateMonthProgress(monthData, daysInMonth)

  // Calculate best day
  let bestDay = 0
  let bestDayProgress = 0
  for (let d = 1; d <= daysInMonth; d++) {
    const dayProgress = calculateDailyProgress(monthData.days[d], monthData.habits.length)
    if (dayProgress > bestDayProgress) {
      bestDayProgress = dayProgress
      bestDay = d
    }
  }

  // Calculate current streak
  let currentStreak = 0
  const today = now.getDate()
  for (let d = today; d >= 1; d--) {
    const entry = monthData.days[d]
    if (entry && entry.completedHabits.length > 0 && monthData.habits.length > 0) {
      const pct = (entry.completedHabits.length / monthData.habits.length) * 100
      if (pct >= 50) {
        currentStreak++
      } else {
        break
      }
    } else {
      break
    }
  }

  // Daily progress data for mini chart (last 14 days)
  const dailyProgressChart = useMemo(() => {
    const points: number[] = []
    for (let d = Math.max(1, today - 13); d <= today; d++) {
      points.push(calculateDailyProgress(monthData.days[d], monthData.habits.length))
    }
    return points
  }, [monthData, today])

  // Mood data for mini chart (last 14 days)
  const moodChart = useMemo(() => {
    const points: number[] = []
    for (let d = Math.max(1, today - 13); d <= today; d++) {
      const entry = monthData.days[d]
      points.push(entry ? entry.mood * 10 : 0)
    }
    return points
  }, [monthData, today])

  // Behavior profile
  const behaviorProfile = useMemo(
    () => analyzeUserBehavior(data, weeklyData, selectedYear),
    [data, weeklyData, selectedYear]
  )

  // Smart notifications
  const notifications = useMemo(
    () => generateSmartNotifications(behaviorProfile, data, weeklyData, selectedYear),
    [behaviorProfile, data, weeklyData, selectedYear]
  )

  // Weekly task progress
  const weekKey = getWeekKey(now)
  const currentWeek = weeklyData[weekKey]
  const weeklyTasksDone = currentWeek ? currentWeek.tasks.filter(t => t.completed).length : 0
  const weeklyTasksTotal = currentWeek ? currentWeek.tasks.length : 0

  // Today's scheduled activities (tasks for today's day index)
  const todayDayIndex = (now.getDay() + 6) % 7 // 0=Mon, 1=Tue, ..., 6=Sun
  const todayTasks = useMemo(() => {
    if (!currentWeek) return []
    return currentWeek.tasks.filter(t => t.dayIndex === todayDayIndex)
  }, [currentWeek, todayDayIndex])

  const todayDayName = WEEKDAY_SHORT[todayDayIndex]

  const greeting = () => {
    const hour = now.getHours()
    if (hour < 12) return "Good morning"
    if (hour < 17) return "Good afternoon"
    return "Good evening"
  }

  const displayName = sessionName || "there"

  // Today's habit data
  const todayDate = now.getDate()
  const dayData = monthData.days[todayDate]
  const todayCompletedCount = dayData?.completedHabits?.length || 0
  const todayHabitTotal = monthData.habits.length
  const todayHabitPct = todayHabitTotal > 0 ? Math.round((todayCompletedCount / todayHabitTotal) * 100) : 0

  return (
    <>
    <SyncModal
      open={showSyncModal}
      onClose={() => setShowSyncModal(false)}
      onSyncComplete={() => {
        setShowSyncModal(false)
        setSyncMode("cloud")
      }}
    />
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white mb-1">
              {greeting()}{isAuthenticated ? `, ${displayName}` : ""} 👋
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {MONTHS[currentMonth - 1]} {selectedYear} &middot; Your planning dashboard
            </p>
          </div>

        </div>

        {/* AI Banner */}
        <AIBanner />

        {/* Smart Notifications */}
        <SmartNotifications notifications={notifications} />



        {/* Smart Schedule Bar (AI Ask Bar) */}
        <SmartScheduleBar />

        {/* ===== TODAY'S ACTIVITIES + TODAY'S HABITS — directly under AI bar ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: Today's Scheduled Activities */}
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Today&apos;s Activities</h3>
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-300">
                  {todayDayName}
                </span>
              </div>
              <Link
                to="/weekly"
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Weekly View →
              </Link>
            </div>
            <div className="p-3">
              {todayTasks.length === 0 ? (
                <div className="py-8 text-center">
                  <span className="text-3xl mb-2 block">🌤️</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No activities scheduled</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    Use the bar above to schedule something for today
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {todayTasks.map((task) => (
                    <div
                      key={task.id}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-colors ${
                        task.completed
                          ? "bg-emerald-50 dark:bg-emerald-900/20"
                          : "bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-700/30"
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${
                        task.completed
                          ? "bg-emerald-500 text-white"
                          : "bg-gray-200 dark:bg-gray-700 text-gray-400 border border-gray-300 dark:border-gray-600"
                      }`}>
                        {task.completed ? "✓" : ""}
                      </span>
                      <span className={`text-sm flex-1 truncate ${
                        task.completed
                          ? "text-emerald-700 dark:text-emerald-300 line-through opacity-70"
                          : "text-gray-700 dark:text-gray-300"
                      }`}>
                        {task.text}
                      </span>
                      {task.completed && (
                        <span className="text-[10px] text-emerald-500 dark:text-emerald-400 font-medium flex-shrink-0">Done</span>
                      )}
                    </div>
                  ))}
                  {/* Summary bar */}
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/40 flex items-center justify-between px-1">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {todayTasks.filter(t => t.completed).length}/{todayTasks.length} completed
                    </span>
                    <div className="flex-1 max-w-[120px] ml-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-indigo-500 transition-all duration-500"
                        style={{ width: `${todayTasks.length > 0 ? (todayTasks.filter(t => t.completed).length / todayTasks.length) * 100 : 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Today's Habits */}
          <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-gray-200/60 dark:border-gray-700/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">✅</span>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Today&apos;s Habits</h3>
                {todayHabitTotal > 0 && (
                  <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                    todayHabitPct === 100
                      ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300"
                      : todayHabitPct >= 50
                      ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
                  }`}>
                    {todayHabitPct}%
                  </span>
                )}
              </div>
              <Link
                to="/tracker"
                search={{ month: undefined }}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
              >
                Open Tracker →
              </Link>
            </div>
            <div className="p-3">
              {monthData.habits.length === 0 ? (
                <div className="py-8 text-center">
                  <span className="text-3xl mb-2 block">🌱</span>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">No habits set up yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    <Link to="/tracker" search={{ month: undefined }} className="text-indigo-500 hover:underline">
                      Go to Tracker
                    </Link>{" "}
                    to add your first habit
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {monthData.habits.map((habit) => {
                    const isCompleted = dayData?.completedHabits?.includes(habit.id) || false
                    return (
                      <button
                        key={habit.id}
                        onClick={() => toggleHabit(selectedYear, currentMonth, todayDate, habit.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition-all duration-200 text-left ${
                          isCompleted
                            ? "bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                            : "bg-gray-50 dark:bg-gray-800/30 hover:bg-gray-100 dark:hover:bg-gray-700/30"
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 transition-all duration-200 ${
                          isCompleted
                            ? "bg-emerald-500 text-white scale-110"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-400 border border-gray-300 dark:border-gray-600"
                        }`}>
                          {isCompleted ? "✓" : ""}
                        </span>
                        <span className={`text-sm flex-1 truncate transition-all duration-200 ${
                          isCompleted
                            ? "text-emerald-700 dark:text-emerald-300 line-through opacity-70"
                            : "text-gray-700 dark:text-gray-300"
                        }`}>
                          {habit.name}
                        </span>
                      </button>
                    )
                  })}
                  {/* Summary bar */}
                  <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/40 flex items-center justify-between px-1">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      {todayCompletedCount}/{todayHabitTotal} completed
                    </span>
                    <div className="flex-1 max-w-[120px] ml-3 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                        style={{ width: `${todayHabitPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ===== EVERYTHING ELSE BELOW ===== */}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Progress Card */}
          <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 bg-white dark:bg-gray-800/50 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <ProgressRing percentage={progressData.percentage} size={48} strokeWidth={4} />
              <div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium">Progress</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{progressData.percentage.toFixed(0)}%</p>
              </div>
            </div>
            <MiniChart data={dailyProgressChart} height={40} color="#6366f1" fillColor="rgba(99,102,241,0.1)" />
          </div>

          {/* Habits Card */}
          <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 bg-white dark:bg-gray-800/50 shadow-sm">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-1">Habits</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{monthData.habits.length}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{progressData.completed} completed today</p>
            <div className="flex items-center gap-1.5">
              <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                  style={{ width: `${monthData.habits.length > 0 ? (progressData.completed / monthData.habits.length) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-gray-400">{monthData.habits.length > 0 ? Math.round((progressData.completed / monthData.habits.length) * 100) : 0}%</span>
            </div>
          </div>

          {/* Best Day Card */}
          <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 bg-white dark:bg-gray-800/50 shadow-sm">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-1">Best Day</p>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {bestDay ? `${bestDayProgress}%` : "\u2014"}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              {bestDay ? `Day ${bestDay}` : "No data yet"}
            </p>
            <MiniChart data={moodChart} height={40} color="#22c55e" fillColor="rgba(34,197,94,0.1)" />
          </div>

          {/* Streak & Weekly Tasks Card */}
          <div className="p-4 sm:p-5 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 bg-white dark:bg-gray-800/50 shadow-sm">
            <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-1">Streak</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{currentStreak}</p>
              <span className="text-xs text-gray-500 dark:text-gray-400">days</span>
              {currentStreak >= 3 && <span className="text-sm">🔥</span>}
            </div>
            <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/40">
              <p className="text-[11px] text-gray-500 dark:text-gray-400 uppercase tracking-wider font-medium mb-0.5">Weekly Tasks</p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-gray-900 dark:text-white">{weeklyTasksDone}/{weeklyTasksTotal}</span>
                <div className="flex-1 h-1.5 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-blue-500 transition-all duration-500"
                    style={{ width: `${weeklyTasksTotal > 0 ? (weeklyTasksDone / weeklyTasksTotal) * 100 : 0}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Grid: Left (Activity + Insights) / Right (Quick Nav + Productivity) */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left Column - Activity Feed & Behavior Insights */}
          <div className="lg:col-span-2 space-y-6">
            {/* Activity Feed */}
            <ActivityFeed
              isAuthenticated={isAuthenticated}
              data={data}
              weeklyData={weeklyData}
              selectedYear={selectedYear}
            />

            {/* Behavior Insights */}
            <BehaviorInsights profile={behaviorProfile} />
          </div>

          {/* Right Column - Quick Nav + Productivity Score */}
          <div className="space-y-5">
            {/* Quick Navigation */}
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Quick Access</h3>
              <Link
                to="/tracker"
                search={{ month: undefined }}
                className="group flex items-center gap-3 p-4 rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-white dark:bg-gray-800/50 hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-base">📊</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Habit Tracker</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Track daily habits, mood &amp; motivation</p>
                </div>
                <span className="text-gray-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all">→</span>
              </Link>

              <Link
                to="/weekly"
                className="group flex items-center gap-3 p-4 rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-white dark:bg-gray-800/50 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-base">📅</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Weekly Review</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Plan your week with tasks &amp; reflections</p>
                </div>
                <span className="text-gray-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all">→</span>
              </Link>

              <Link
                to="/analytics"
                className="group flex items-center gap-3 p-4 rounded-xl border border-gray-200/60 dark:border-gray-700/40 bg-white dark:bg-gray-800/50 hover:border-purple-300 dark:hover:border-purple-700 hover:shadow-md transition-all duration-200"
              >
                <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <span className="text-base">📈</span>
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white">Analytics</h4>
                  <p className="text-xs text-gray-500 dark:text-gray-400 truncate">Deep insights into your performance</p>
                </div>
                <span className="text-gray-400 group-hover:text-purple-500 group-hover:translate-x-0.5 transition-all">→</span>
              </Link>
            </div>

            {/* Productivity Score */}
            <div className="bg-white dark:bg-gray-800/50 rounded-2xl border border-gray-200/60 dark:border-gray-700/40 p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-base">⚡</span>
                <h3 className="font-semibold text-sm text-gray-900 dark:text-white">Productivity Score</h3>
              </div>
              <div className="flex items-center gap-4">
                <ProgressRing
                  percentage={behaviorProfile.productivityScore}
                  size={72}
                  strokeWidth={6}
                  color={behaviorProfile.productivityScore >= 70 ? "#22c55e" : behaviorProfile.productivityScore >= 40 ? "#f59e0b" : "#ef4444"}
                >
                  <span className="text-lg font-bold text-gray-900 dark:text-white">{behaviorProfile.productivityScore}</span>
                </ProgressRing>
                <div className="flex-1 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Mood</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{behaviorProfile.avgMood.toFixed(1)}/10</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Weekly Tasks</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{behaviorProfile.weeklyTaskRate}%</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 dark:text-gray-400">Perfect Days</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">{behaviorProfile.perfectDaysThisMonth}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
