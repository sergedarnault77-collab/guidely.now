import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, useMemo, useEffect } from 'react'
import { useHabits } from '@/lib/context'
import {
  MONTHS,
  getDaysInMonth,
  getMonthKey,
  getWeekKey,
  getWeekStartDate,
  formatWeekRange,
  calculateMonthProgress,
  calculateWeeklyOverallProgress,
  calculateWeeklyHabitProgress,
} from '@/lib/types'
import { ProgressRing } from '@/components/ProgressRing'
import { AreaChart } from '@/components/AreaChart'
import { ActivityFeed } from '@/components/ActivityFeed'
import { AIAssistant, type AIInsight } from '@/components/AIAssistant'
import { SmartTaskInput } from '@/components/SmartTaskInput'
import { useCloudStatus } from '@/lib/cloud-status'
import { interpretTask, formatDuration } from '@/lib/smart-task-ai'
import { analyzeUserBehavior } from '@/lib/behavior-analytics'
import { AgendaCard } from '@/components/dashboard/AgendaCard'
import { PredictionsAccordion } from '@/components/dashboard/PredictionsAccordion'
import { appendEvent } from '@/lib/attention-events'
import { useTTS, getAvailableVoices, OPENAI_VOICES } from '@/lib/useTTS'
import { generateDailyBriefing } from '@/lib/daily-briefing'
import { BRIEFING_PERSONAS, getPersona } from '@/lib/briefing-personas'
import { loadBriefingSettings, saveBriefingSettings, resolvePersonaForToday } from '@/lib/briefing-settings'
import { renderBriefingShareCardPNG } from '@/lib/share-card'

export const Route = createFileRoute('/')({ component: DashboardPage })

/* ── Loading skeleton ──────────────────────────────────────── */

function DashboardSkeleton() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 animate-pulse">
      <div className="space-y-6">
        <div>
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg mb-2" />
          <div className="h-4 w-48 bg-gray-100 dark:bg-gray-800 rounded" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 rounded-2xl bg-gray-100 dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40" />
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Persona → OpenAI voice mode mapping ───────────────────── */

function personaToVoiceMode(id: string): string {
  switch (id) {
    case 'tough_coach': case 'drill': return 'demanding'
    case 'zen': case 'warm_parent': case 'best_friend': return 'casual'
    case 'chaos': return 'funny'
    case 'ceo': default: return 'serious'
  }
}

/* ── Main dashboard ────────────────────────────────────────── */

function DashboardContent() {
  const now = new Date()
  const hour = now.getHours()
  const {
    data,
    weeklyData,
    selectedYear,
    setSelectedYear,
    toggleWeeklyTask,
    removeWeeklyTask,
    addWeeklyTask,
    initWeek,
    isAuthenticated,
  } = useHabits()

  const [agendaOpen, setAgendaOpen] = useState(true)
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState<'idle' | 'rendering' | 'shared' | 'saved'>('idle')
  const [selectedVoice, setSelectedVoice] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('guidely.briefing.voice.v1') || '' : '',
  )
  const [selectedOpenAIVoice, setSelectedOpenAIVoice] = useState<string>(() =>
    typeof window !== 'undefined' ? localStorage.getItem('guidely.tts.voice.openai.v1') || '' : '',
  )
  const [voices, setVoices] = useState(() => getAvailableVoices())
  const [briefingSettings, setBriefingSettings] = useState(() => loadBriefingSettings())
  const todayISO = now.toISOString().slice(0, 10)
  const activePersonaId = resolvePersonaForToday(briefingSettings, todayISO)
  const activePersona = getPersona(activePersonaId)

  // Reset "Copied" toast after 2s
  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  // Reset share toast after 2s
  useEffect(() => {
    if (sharing !== 'shared' && sharing !== 'saved') return
    const t = setTimeout(() => setSharing('idle'), 2000)
    return () => clearTimeout(t)
  }, [sharing])

  // Refresh voice list when voices load async
  useEffect(() => {
    const handler = () => setVoices(getAvailableVoices())
    speechSynthesis?.addEventListener?.('voiceschanged', handler)
    return () => speechSynthesis?.removeEventListener?.('voiceschanged', handler)
  }, [])

  // ── Current month data ──
  const currentMonth = now.getMonth() + 1
  const monthKey = getMonthKey(selectedYear, currentMonth)
  const monthData = data[monthKey] || { habits: [], days: {} }
  const daysInMonth = getDaysInMonth(selectedYear, currentMonth)
  const monthStats = calculateMonthProgress(monthData, daysInMonth)

  // ── Current week data ──
  const weekKey = getWeekKey(now)
  const weekStart = getWeekStartDate(now)
  const weekRange = formatWeekRange(weekStart)
  const weekData = weeklyData[weekKey] || { tasks: [], habits: [], habitCompletions: {}, notes: { general: '', improvements: '', gratitude: '' } }
  const weekTasks = weekData.tasks || []
  const weekTasksDone = weekTasks.filter((t) => t.completed).length
  const weekHabitsDone = Object.values(weekData.habitCompletions || {}).reduce((s, days) => s + (days as boolean[]).filter(Boolean).length, 0)
  const weekHabitsTotal = Object.keys(weekData.habitCompletions || {}).length * 7

  // ── Today ──
  const todayEntry = monthData.days[now.getDate()]
  const todayProgress = monthData.habits.length > 0 && todayEntry
    ? Math.round((todayEntry.completedHabits.length / monthData.habits.length) * 100)
    : 0
  const todayDayIdx = now.getDay() === 0 ? 6 : now.getDay() - 1 // Mon=0

  // ── Greeting ──
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const peakWindow = hour < 12 ? 'This morning' : hour < 17 ? 'This afternoon' : 'Tomorrow morning'

  // ── Streak ──
  const streak = useMemo(() => {
    let s = 0
    const d = new Date(now)
    for (let i = 0; i < 365; i++) {
      const mk = getMonthKey(d.getFullYear(), d.getMonth() + 1)
      const md = data[mk]
      const entry = md?.days[d.getDate()]
      if (!entry) { if (i === 0) { d.setDate(d.getDate() - 1); continue } break }
      if (entry.completedHabits.length > 0) { s++ } else { if (i === 0) { d.setDate(d.getDate() - 1); continue } break }
      d.setDate(d.getDate() - 1)
    }
    return s
  }, [data])

  // ── Agenda items (today + overdue, not completed) ──
  const agendaItems = useMemo(() => {
    const TIME_HIGH = ['Morning Focus (9 AM)', 'Now', 'Morning (10 AM)']
    const TIME_MED = ['Afternoon (3 PM)', 'Afternoon Batch (2 PM)', 'After Work (5 PM)']
    const TIME_LOW = ['Evening (7 PM)', 'Evening Batch (8 PM)']
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    let hi = 0, mi = 0, li = 0
    return weekTasks
      .filter((t) => !t.completed && (t.dayIndex === todayDayIdx || t.dayIndex < todayDayIdx))
      .map((t) => {
        const interp = interpretTask(t.text)
        const isOverdue = t.dayIndex < todayDayIdx
        let slot: string
        if (isOverdue) { slot = 'Now' }
        else if (interp.priority === 'high') { slot = TIME_HIGH[hi++ % TIME_HIGH.length] }
        else if (interp.priority === 'medium') { slot = TIME_MED[mi++ % TIME_MED.length] }
        else { slot = TIME_LOW[li++ % TIME_LOW.length] }
        return {
          task: t,
          interp,
          isOverdue,
          dayLabel: isOverdue ? `⚠ Overdue from ${DAYS[t.dayIndex]}` : '📋 Scheduled for today',
          timeSlot: slot,
          completion: Math.min(99, Math.max(60, todayProgress + (interp.priority === 'high' ? 8 : 0) + Math.floor(interp.confidence * 0.15))),
        }
      })
      .sort((a, b) => {
        if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1
        const p = { high: 0, medium: 1, low: 2 }
        return p[a.interp.priority] - p[b.interp.priority]
      })
  }, [weekTasks, todayDayIdx, todayProgress])

  // ── Agenda summary ──
  const agendaCount = agendaItems.length
  const urgentCount = agendaItems.filter((i) => i.isOverdue || i.interp.priority === 'high').length
  const totalMinutes = agendaItems.reduce((s, i) => s + i.interp.estimatedMinutes, 0)
  const predictedCompletion = agendaCount > 0 ? Math.min(95, Math.max(60, Math.round(todayProgress * 0.7 + 25))) : 0

  // ── Year progress ──
  const yearProgress = useMemo(() => {
    let completed = 0, total = 0
    for (let m = 1; m <= 12; m++) {
      const mk = getMonthKey(selectedYear, m)
      const md = data[mk]
      if (!md || md.habits.length === 0) continue
      const s = calculateMonthProgress(md, getDaysInMonth(selectedYear, m))
      completed += s.completed; total += s.total
    }
    return total > 0 ? Math.round((completed / total) * 100) : 0
  }, [data, selectedYear])

  // ── Month productivity + avg mood ──
  const monthProductivity = Math.round(monthStats.percentage)
  const moodStats = useMemo(() => {
    const moods: number[] = []
    for (let d = 1; d <= now.getDate(); d++) if (monthData.days[d]?.mood) moods.push(monthData.days[d].mood)
    if (moods.length === 0) return { avg: 0, trend: 'stable' as const }
    const avg = moods.reduce((a, b) => a + b, 0) / moods.length
    const mid = Math.floor(moods.length / 2)
    let trend: 'rising' | 'declining' | 'stable' = 'stable'
    if (moods.length >= 4) {
      const first = moods.slice(0, mid).reduce((a, b) => a + b, 0) / mid
      const second = moods.slice(mid).reduce((a, b) => a + b, 0) / (moods.length - mid)
      if (second - first > 0.5) trend = 'rising'
      else if (first - second > 0.5) trend = 'declining'
    }
    return { avg: Math.round(avg * 10) / 10, trend }
  }, [monthData])

  // ── Behavior analysis (for summary card) ──
  const behaviorProfile = useMemo(
    () => analyzeUserBehavior(data, weeklyData, selectedYear),
    [data, weeklyData, selectedYear],
  )
  const patternsCount = behaviorProfile.patterns?.length || 0
  const recsCount = behaviorProfile.recommendations?.length || 0
  const atRiskCount = behaviorProfile.habitProfiles?.filter((h) => h.abandonmentRisk > 0.6).length || 0

  // ── Yearly chart data ──
  const chartData = useMemo(() => {
    const labels = MONTHS.map((m) => m.slice(0, 3))
    const progress: number[] = []
    const mood: number[] = []
    for (let m = 1; m <= 12; m++) {
      const mk = getMonthKey(selectedYear, m)
      const md = data[mk]
      const dim = getDaysInMonth(selectedYear, m)
      progress.push(md && md.habits.length > 0 ? calculateMonthProgress(md, dim).percentage : 0)
      const ms: number[] = []
      if (md) for (let d = 1; d <= dim; d++) if (md.days[d]?.mood) ms.push(md.days[d].mood)
      mood.push(ms.length > 0 ? Math.round(ms.reduce((a, b) => a + b, 0) / ms.length * 10) : 0)
    }
    return { labels, progress, mood }
  }, [data, selectedYear])

  // ── Monthly breakdown ──
  const monthlyBreakdown = useMemo(() =>
    MONTHS.map((name, i) => {
      const m = i + 1
      const mk = getMonthKey(selectedYear, m)
      const md = data[mk]
      const dim = getDaysInMonth(selectedYear, m)
      const hasData = !!md && md.habits.length > 0
      const stats = hasData ? calculateMonthProgress(md!, dim) : { completed: 0, percentage: 0 }
      return { name, pct: stats.percentage, habits: md?.habits.length || 0, done: stats.completed, isCurrent: m === (now.getFullYear() === selectedYear ? currentMonth : 0), hasData }
    }),
  [data, selectedYear])

  // ── AI insights (for AIAssistant) ──
  const aiInsights = useMemo<AIInsight[]>(() => {
    const ins: AIInsight[] = []
    const remaining = todayEntry
      ? monthData.habits.filter((h) => !todayEntry.completedHabits.includes(h.id))
      : monthData.habits
    if (remaining.length > 0 && remaining.length <= 3 && todayProgress >= 50) {
      ins.push({ id: 'almost', type: 'suggestion', title: 'Almost there!', message: `Just ${remaining.length} habit${remaining.length > 1 ? 's' : ''} left today: ${remaining.map((h) => h.name).join(', ')}. You can do it!`, emoji: '🎯' })
    }
    if (streak >= 3) {
      ins.push({ id: 'streak', type: 'observation', title: `${streak}-day streak!`, message: "You're on fire! Consistency is the key to lasting change. Keep this momentum going.", emoji: '🔥' })
    }
    if (monthData.habits.length > 0) {
      let best = '', bestPct = 0
      for (const h of monthData.habits) {
        let c = 0
        for (let d = 1; d <= now.getDate(); d++) if (monthData.days[d]?.completedHabits.includes(h.id)) c++
        const pct = now.getDate() > 0 ? Math.round((c / now.getDate()) * 100) : 0
        if (pct > bestPct) { bestPct = pct; best = h.name }
      }
      if (bestPct >= 70) ins.push({ id: 'star', type: 'observation', title: 'Star performer', message: `"${best}" is at ${bestPct}% — your strongest habit this month. This is becoming automatic!`, emoji: '⭐' })
    }
    return ins
  }, [data, monthData, todayEntry, todayProgress, streak])

  // ── AI daily plan ──
  const dailyPlan = useMemo(() => {
    const plan: string[] = []
    const remaining = todayEntry
      ? monthData.habits.filter((h) => !todayEntry.completedHabits.includes(h.id))
      : monthData.habits
    if (remaining.length > 0) plan.push(`Complete remaining habits: ${remaining.slice(0, 3).map((h) => h.name).join(', ')}${remaining.length > 3 ? ` (+${remaining.length - 3} more)` : ''}`)
    const todayTasksPending = weekTasks.filter((t) => t.dayIndex === todayDayIdx && !t.completed).length
    if (todayTasksPending > 0) plan.push(`${todayTasksPending} weekly tasks scheduled for today`)
    plan.push('Review today and plan tomorrow')
    plan.push('Take a 10-minute break to recharge')
    return plan
  }, [weekTasks, monthData, todayEntry, todayDayIdx])

  // ── Attention event log: app open ──
  useEffect(() => { appendEvent('app_open') }, [])

  // ── TTS ──
  const tts = useTTS()

  // ── Daily Briefing ──
  const remainingHabits = useMemo(() => {
    if (!monthData.habits.length) return [] as string[]
    const entry = monthData.days[now.getDate()]
    return entry
      ? monthData.habits.filter((h) => !entry.completedHabits.includes(h.id)).map((h) => h.name)
      : monthData.habits.map((h) => h.name)
  }, [monthData])

  const briefing = useMemo(
    () => generateDailyBriefing({
      greeting,
      streak,
      todayProgress,
      agendaCount,
      completedToday: todayEntry?.completedHabits.length || 0,
      totalHabits: monthData.habits.length,
      remainingHabits,
      weekTasks,
      todayDayIdx,
      personaId: activePersonaId,
      dateISO: todayISO,
    }),
    [greeting, streak, todayProgress, agendaCount, todayEntry, monthData, remainingHabits, weekTasks, todayDayIdx, activePersonaId, todayISO],
  )

  // ── Handlers ──
  const handleAddTask = (text: string) => {
    if (!weeklyData[weekKey]) initWeek(weekKey, weekStart)
    addWeeklyTask(weekKey, text, todayDayIdx)
  }

  const handleCompleteTask = (taskId: string) => {
    appendEvent('task_completed', taskId)
    toggleWeeklyTask(weekKey, taskId)
  }

  const handleSkipTask = (taskId: string) => {
    appendEvent('task_skipped', taskId)
    removeWeeklyTask(weekKey, taskId)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
      <div className="space-y-6">

        {/* ═══════ 1. GREETING ═══════ */}
        <div>
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">
            {greeting} 👋
          </h1>
          {streak > 0 && (
            <p className="text-gray-600 dark:text-gray-400 mt-1 flex items-center gap-2">
              <span className="text-orange-500">🔥</span> {streak}-day streak — keep it going!
            </p>
          )}
        </div>

        {/* ═══════ 1b. DAILY CINEMATIC BRIEFING ═══════ */}
        <div className="space-y-3">
          {/* Tagline */}
          <p className="text-[11px] font-medium tracking-widest uppercase text-gray-400 dark:text-gray-500 cinematic:text-[var(--cin-text-secondary)]">
            An AI mirror for how you actually spend your attention.
          </p>

          {/* Briefing card */}
          <div className="rounded-2xl bg-white dark:bg-gray-800/50 cinematic:bg-[var(--cin-panel)] border border-gray-200/60 dark:border-gray-700/40 cinematic:border-[var(--cin-border)] p-5">
            {/* Header: headline + vibe tag */}
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-sm font-bold text-gray-900 dark:text-white">{briefing.headline}</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-gray-100 dark:bg-gray-700/50 cinematic:bg-[var(--cin-panel-strong)] text-gray-600 dark:text-gray-300">
                {briefing.vibeTag}
              </span>
            </div>

            {/* Character persona selector */}
            <div className="flex items-center justify-between mb-3 py-2 px-3 rounded-xl bg-gray-50 dark:bg-gray-700/20 cinematic:bg-[var(--cin-panel-strong)] border border-gray-200/40 dark:border-gray-700/30 cinematic:border-[var(--cin-border)]">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-base border-2 ${activePersona.colorClass}`}
                  title={activePersona.name}
                >
                  {activePersona.emoji}
                </span>
                <div>
                  <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 cinematic:text-[var(--cin-text)] leading-tight">{activePersona.name}</p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500 cinematic:text-[var(--cin-text-secondary)]">Today's vibe</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={briefingSettings.personaMode === 'randomDaily' ? '__random__' : briefingSettings.personaId}
                  onChange={(e) => {
                    const val = e.target.value
                    const next = val === '__random__'
                      ? { ...briefingSettings, personaMode: 'randomDaily' as const }
                      : { personaMode: 'fixed' as const, personaId: val as typeof briefingSettings.personaId }
                    saveBriefingSettings(next)
                    setBriefingSettings(next)
                  }}
                  className="px-2 py-1 rounded-lg text-[11px] bg-white dark:bg-gray-700/50 cinematic:bg-[var(--cin-panel)] text-gray-700 dark:text-gray-300 cinematic:text-[var(--cin-text)] border border-gray-200/60 dark:border-gray-700/40 cinematic:border-[var(--cin-border)] outline-none cursor-pointer"
                >
                  <option value="__random__">{'\u{1F3B2}'} Random daily</option>
                  {BRIEFING_PERSONAS.map((p) => (
                    <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* One-liner (hero text) */}
            <p className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white leading-snug mb-1">
              {briefing.oneLiner}
            </p>

            {/* Signature line */}
            {briefing.signatureLine && (
              <p className="text-xs italic text-gray-400 dark:text-gray-500 cinematic:text-[var(--cin-accent)] mb-3">
                — {briefing.signatureLine}
              </p>
            )}

            {/* Narration */}
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-400 cinematic:text-[var(--cin-text-secondary)] mb-4">
              {briefing.narrationText}
            </p>

            {/* Metric chips */}
            <div className="flex items-center gap-3 mb-4">
              {briefing.cards.map((card) => (
                <div
                  key={card.label}
                  className={`flex-1 text-center p-2 rounded-xl border ${
                    card.tone === 'good'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 cinematic:bg-[var(--cin-accent-soft)] border-emerald-200/60 dark:border-emerald-800/40 cinematic:border-[var(--cin-border)]'
                      : card.tone === 'warning'
                        ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200/60 dark:border-amber-800/40 cinematic:border-[var(--cin-border)]'
                        : 'bg-gray-50 dark:bg-gray-700/30 cinematic:bg-[var(--cin-panel-strong)] border-gray-200/40 dark:border-gray-700/30 cinematic:border-[var(--cin-border)]'
                  }`}
                >
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{card.value}</p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">{card.label}</p>
                </div>
              ))}
            </div>

            {/* Actions: Play + Copy + Share + HQ toggle + Voice selector */}
            <div className="flex items-center gap-2 flex-wrap">
              {tts.supported ? (
                <button
                  onClick={() => {
                    if (tts.speaking) {
                      tts.stop()
                    } else {
                      const isCloud = tts.provider === 'openai' && tts.cloudAvailable
                      tts.speak(briefing.narrationText, {
                        voiceId: isCloud ? (selectedOpenAIVoice || undefined) : (selectedVoice || undefined),
                        mode: personaToVoiceMode(activePersonaId),
                      })
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tts.speaking
                      ? 'bg-red-100 dark:bg-red-900/30 cinematic:bg-[var(--cin-accent-soft)] text-red-600 dark:text-red-400 cinematic:text-[var(--cin-accent)]'
                      : 'bg-gray-100 dark:bg-gray-700/50 cinematic:bg-[var(--cin-panel-strong)] text-gray-700 dark:text-gray-300 cinematic:text-[var(--cin-text)] hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {tts.speaking ? '■ Stop' : '▶︎ Play'}
                </button>
              ) : (
                <span className="text-[10px] text-gray-400">TTS not available</span>
              )}
              <button
                onClick={() => {
                  const text = briefing.movedUp
                    ? `${briefing.oneLiner}\n\nI moved up: "${briefing.movedUp.title}" — 10minutes.ai`
                    : `${briefing.oneLiner}\n\n— 10minutes.ai`
                  navigator.clipboard.writeText(text).then(() => setCopied(true))
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700/50 cinematic:bg-[var(--cin-panel-strong)] text-gray-700 dark:text-gray-300 cinematic:text-[var(--cin-text)] hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
              >
                {copied ? '✓ Copied' : '⧉ Copy'}
              </button>
              <button
                disabled={sharing === 'rendering'}
                onClick={async () => {
                  setSharing('rendering')
                  try {
                    const blob = await renderBriefingShareCardPNG({
                      brand: '10minutes.ai',
                      dateISO: todayISO,
                      personaName: activePersona.name,
                      personaEmoji: activePersona.emoji,
                      vibeTag: briefing.vibeTag,
                      oneLiner: briefing.oneLiner,
                      signatureLine: briefing.signatureLine,
                      movedUpTitle: briefing.movedUp?.title,
                    })
                    const file = new File([blob], `10minutes-briefing-${todayISO}.png`, { type: 'image/png' })
                    if (navigator.canShare?.({ files: [file] })) {
                      await navigator.share({ files: [file], title: '10minutes.ai', text: briefing.oneLiner })
                      setSharing('shared')
                    } else {
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `10minutes-briefing-${todayISO}.png`
                      a.click()
                      URL.revokeObjectURL(url)
                      setSharing('saved')
                    }
                  } catch {
                    setSharing('idle')
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 dark:bg-gray-700/50 cinematic:bg-[var(--cin-panel-strong)] text-gray-700 dark:text-gray-300 cinematic:text-[var(--cin-text)] hover:bg-gray-200 dark:hover:bg-gray-700 transition-all disabled:opacity-50"
              >
                {sharing === 'rendering' ? '⏳ Rendering…' : sharing === 'shared' ? '✓ Shared' : sharing === 'saved' ? '✓ Saved image' : '↗ Share'}
              </button>
              {/* HQ voice toggle — only if cloud endpoint is configured */}
              {tts.cloudAvailable && (
                <label className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-[11px] font-medium cursor-pointer bg-gray-100 dark:bg-gray-700/50 cinematic:bg-[var(--cin-panel-strong)] text-gray-700 dark:text-gray-300 cinematic:text-[var(--cin-text)] select-none">
                  <input
                    type="checkbox"
                    checked={tts.provider === 'openai'}
                    onChange={(e) => tts.setProvider(e.target.checked ? 'openai' : 'browser')}
                    className="w-3.5 h-3.5 rounded accent-indigo-500"
                  />
                  HQ voice {'\u{1F399}'}
                </label>
              )}
              {/* Voice dropdown — OpenAI voices when HQ on, browser voices otherwise */}
              {tts.provider === 'openai' && tts.cloudAvailable ? (
                <select
                  value={selectedOpenAIVoice}
                  onChange={(e) => {
                    setSelectedOpenAIVoice(e.target.value)
                    localStorage.setItem('guidely.tts.voice.openai.v1', e.target.value)
                  }}
                  className="px-2 py-1.5 rounded-lg text-[11px] bg-gray-100 dark:bg-gray-700/50 cinematic:bg-[var(--cin-panel-strong)] text-gray-700 dark:text-gray-300 cinematic:text-[var(--cin-text)] border border-gray-200/60 dark:border-gray-700/40 cinematic:border-[var(--cin-border)] outline-none cursor-pointer"
                >
                  <option value="">Auto</option>
                  {OPENAI_VOICES.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              ) : (
                tts.supported && voices.length > 0 && (
                  <select
                    value={selectedVoice}
                    onChange={(e) => {
                      setSelectedVoice(e.target.value)
                      localStorage.setItem('guidely.briefing.voice.v1', e.target.value)
                    }}
                    className="px-2 py-1.5 rounded-lg text-[11px] bg-gray-100 dark:bg-gray-700/50 cinematic:bg-[var(--cin-panel-strong)] text-gray-700 dark:text-gray-300 cinematic:text-[var(--cin-text)] border border-gray-200/60 dark:border-gray-700/40 cinematic:border-[var(--cin-border)] outline-none cursor-pointer"
                  >
                    <option value="">Auto</option>
                    {voices.slice(0, 8).map((v) => (
                      <option key={v.id} value={v.id}>{v.name.replace(/ \(.*\)/, '')} ({v.lang})</option>
                    ))}
                  </select>
                )
              )}
              {/* Cloud error fallback toast */}
              {tts.cloudError && (
                <span className="text-[10px] text-amber-500 dark:text-amber-400">HQ voice unavailable, using browser</span>
              )}
            </div>
          </div>

          {/* Move-Up card */}
          {briefing.movedUp && (
            <div className="rounded-2xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/15 dark:to-orange-900/15 cinematic:from-[var(--cin-panel)] cinematic:to-[var(--cin-panel-strong)] border border-amber-200/60 dark:border-amber-800/30 cinematic:border-[var(--cin-border)] p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm">↑</span>
                <h3 className="text-xs font-bold uppercase tracking-wide text-amber-800 dark:text-amber-300 cinematic:text-[var(--cin-warning)]">
                  I moved something up.
                </h3>
              </div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                {briefing.movedUp.title}
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 cinematic:text-[var(--cin-text-secondary)]">
                {briefing.movedUp.reason}
              </p>
            </div>
          )}
        </div>

        {/* ═══════ 2. AI DAILY AGENDA CARD ═══════ */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-5 shadow-lg shadow-indigo-500/25">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚡</span>
              <h2 className="font-bold text-lg">AI Daily Agenda</h2>
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-white/20 uppercase tracking-wider">Predictive</span>
            </div>
          </div>
          <p className="text-sm text-white/80 mb-4">
            {agendaCount} items · ~{formatDuration(totalMinutes)} · {predictedCompletion}% predicted completion
          </p>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{agendaCount}</p>
              <p className="text-xs text-white/70">Tasks</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{urgentCount}</p>
              <p className="text-xs text-white/70">Urgent</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3 text-center">
              <p className="text-2xl font-bold">{predictedCompletion}%</p>
              <p className="text-xs text-white/70">Predicted</p>
            </div>
          </div>
          <div className="flex items-center justify-between text-sm">
            <div>
              <p className="font-medium">{peakWindow}</p>
              <p className="text-xs text-white/60">Peak Window</p>
            </div>
            <p className="text-white/80 text-xs">{agendaCount} items, ~{(totalMinutes / 60).toFixed(1)}h of work. You&apos;ve got this!</p>
          </div>
        </div>

        {/* ═══════ 3. PRIORITIZED AGENDA ═══════ */}
        <div>
          <button
            onClick={() => setAgendaOpen(!agendaOpen)}
            className="flex items-center gap-2 mb-3"
          >
            <h2 className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              Prioritized Agenda ({agendaCount})
            </h2>
            <span className={`text-xs text-gray-400 transition-transform duration-200 ${agendaOpen ? 'rotate-180' : ''}`}>▾</span>
          </button>

          {/* Quick add */}
          <SmartTaskInput
            onAddTask={handleAddTask}
            placeholder='✨ What would you like to add? e.g. "Call garage for a check on Tuesday"'
            className="mb-4"
          />

          {/* Task cards */}
          {agendaOpen && (
            <div className="space-y-3">
              {agendaItems.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400 py-4 text-center">
                  No tasks for today. Add one above or plan your week in the <Link to="/weekly" className="text-indigo-500 hover:underline">Weekly Planner</Link>.
                </p>
              ) : (
                agendaItems.map((item) => (
                  <AgendaCard
                    key={item.task.id}
                    title={item.task.text}
                    interp={item.interp}
                    isOverdue={item.isOverdue}
                    dayLabel={item.dayLabel}
                    timeSlot={item.timeSlot}
                    completion={item.completion}
                    onComplete={() => handleCompleteTask(item.task.id)}
                    onDismiss={() => handleSkipTask(item.task.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>

        {/* ═══════ 4. HOW PREDICTIONS WORK ═══════ */}
        <PredictionsAccordion />

        {/* ═══════ 5. AI ASSISTANT ═══════ */}
        <AIAssistant
          insights={aiInsights}
          dailyPlan={dailyPlan}
          greeting={`${greeting}! Time to ${hour < 12 ? 'start your day strong' : hour < 18 ? 'keep the momentum' : 'review your day'}.`}
          streak={streak}
          todayScore={todayProgress}
        />

        {/* ═══════ 6. DASHBOARD OVERVIEW ═══════ */}
        <div className="space-y-5">
          {/* Section header + year selector */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Dashboard Overview</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setSelectedYear(selectedYear - 1)} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">◀</button>
              <span className="text-sm font-bold text-gray-900 dark:text-white min-w-[3rem] text-center">{selectedYear}</span>
              <button onClick={() => setSelectedYear(selectedYear + 1)} className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">▶</button>
            </div>
          </div>

          {/* Top stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Year Progress */}
            <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Year Progress</p>
                <span>🎯</span>
              </div>
              <div className="flex items-center gap-3">
                <ProgressRing percentage={yearProgress} size={56} color="#6366f1">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{yearProgress}%</span>
                </ProgressRing>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{yearProgress}%</div>
              </div>
            </div>

            {/* Today */}
            <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Today</p>
                <span>⚡</span>
              </div>
              <div className="flex items-center gap-3">
                <ProgressRing percentage={todayProgress} size={56} color="#22c55e">
                  <span className="text-xs font-bold text-gray-900 dark:text-white">{todayProgress}%</span>
                </ProgressRing>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">{todayProgress}%</div>
              </div>
            </div>

            {/* Productivity */}
            <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Productivity</p>
                <span>📈</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{monthProductivity}%</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">this month avg</p>
            </div>

            {/* Mood */}
            <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-4 sm:p-5">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Mood</p>
                <span>{moodStats.avg >= 7 ? '😊' : moodStats.avg >= 5 ? '😐' : moodStats.avg > 0 ? '😔' : '—'}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{moodStats.avg > 0 ? `${moodStats.avg}/10` : '—'}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {moodStats.trend === 'rising' ? '↑ rising' : moodStats.trend === 'declining' ? '↓ declining' : '→ stable'}
              </p>
            </div>
          </div>

          {/* AI insight banners */}
          {aiInsights.length > 0 && (
            <div className="space-y-2">
              {aiInsights.map((ins) => (
                <div
                  key={ins.id}
                  className={`rounded-xl p-3 flex items-start gap-3 ${
                    ins.type === 'suggestion'
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/60 dark:border-emerald-800/40'
                      : 'bg-purple-50 dark:bg-purple-900/20 border border-purple-200/60 dark:border-purple-800/40'
                  }`}
                >
                  <span className="text-lg shrink-0">{ins.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-gray-900 dark:text-white">{ins.title}</span>
                      <span className={`px-1.5 py-0.5 text-[9px] font-bold rounded-full uppercase ${
                        ins.type === 'suggestion' ? 'bg-emerald-100 dark:bg-emerald-800/50 text-emerald-700 dark:text-emerald-300' : 'bg-purple-100 dark:bg-purple-800/50 text-purple-700 dark:text-purple-300'
                      }`}>{ins.type}</span>
                    </div>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">{ins.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Completed / date bar */}
          <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
            <span>{monthStats.completed} / {monthStats.total} completed</span>
            <span>{MONTHS[currentMonth - 1]} {now.getDate()}</span>
          </div>

          {/* AI Behavior Analysis */}
          {(patternsCount > 0 || recsCount > 0) && (
            <div className="rounded-xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-4">
              <div className="flex items-center gap-2">
                <span>🧠</span>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">AI Behavior Analysis</h3>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {patternsCount} patterns detected · {recsCount} recommendations{atRiskCount > 0 ? ` · ${atRiskCount} at risk` : ''}
              </p>
            </div>
          )}

          {/* Yearly Overview chart */}
          <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-5">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-1">Yearly Overview</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Habit completion &amp; emotional state trends</p>
            <div className="flex items-center gap-4 mb-2 text-xs">
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-indigo-500 inline-block" /> Progress</span>
              <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded bg-amber-500 inline-block" /> Mood</span>
            </div>
            <AreaChart
              datasets={[
                { data: chartData.progress, color: '#6366f1', fillColor: 'rgba(99,102,241,0.1)', label: 'Progress' },
                { data: chartData.mood, color: '#f59e0b', fillColor: 'rgba(245,158,11,0.08)', label: 'Mood' },
              ]}
              labels={chartData.labels}
              height={200}
            />
          </div>

          {/* Monthly Breakdown */}
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3">Monthly Breakdown</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {monthlyBreakdown.map((mb) => (
                <Link
                  key={mb.name}
                  to="/tracker"
                  search={{ month: MONTHS.indexOf(mb.name) + 1 }}
                  className={`rounded-xl border p-3 transition-colors hover:border-indigo-300 dark:hover:border-indigo-700 ${
                    mb.isCurrent
                      ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800/40'
                      : 'bg-white dark:bg-gray-800/50 border-gray-200/60 dark:border-gray-700/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-white">{mb.name}</span>
                    {mb.isCurrent && <span className="text-[9px] font-bold text-indigo-600 dark:text-indigo-400 uppercase">Now</span>}
                  </div>
                  {mb.hasData ? (
                    <>
                      <p className="text-lg font-bold text-gray-900 dark:text-white">{mb.pct.toFixed(1)}%</p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">{mb.habits} habits · {mb.done} done</p>
                    </>
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">📝 No data yet</p>
                  )}
                </Link>
              ))}
            </div>
          </div>

          {/* This Week */}
          <div className="rounded-2xl bg-white dark:bg-gray-800/50 border border-gray-200/60 dark:border-gray-700/40 p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white">This Week</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{weekRange}</p>
              </div>
              <Link to="/weekly" className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 transition-colors">
                Open Weekly Planner →
              </Link>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{weekTasks.length > 0 ? Math.round((weekTasksDone / weekTasks.length) * 100) : 0}%</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Tasks Done</p>
                <p className="text-[10px] text-gray-400">{weekTasksDone}/{weekTasks.length}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{weekHabitsTotal > 0 ? Math.round((weekHabitsDone / weekHabitsTotal) * 100) : 0}%</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Habits Done</p>
                <p className="text-[10px] text-gray-400">{weekHabitsDone}/{weekHabitsTotal}</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{weekData.habits?.length || 0}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Weekly Habits</p>
              </div>
              <div className="text-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700/30">
                <p className="text-lg font-bold text-gray-900 dark:text-white">{weekTasks.length}</p>
                <p className="text-[10px] text-gray-500 dark:text-gray-400">Total Tasks</p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════ 7. ACTIVITY FEED ═══════ */}
        <ActivityFeed isAuthenticated={isAuthenticated} data={data} weeklyData={weeklyData} selectedYear={selectedYear} />
      </div>
    </div>
  )
}

/* ── Page wrapper ──────────────────────────────────────────── */

function DashboardPage() {
  const { checking } = useCloudStatus()
  if (checking) return <DashboardSkeleton />
  return <DashboardContent />
}
