import type { WeeklyTask } from './types'
import { countEventsForTask, loadEvents } from './attention-events'

export interface BriefingCard {
  label: string
  value: string
  tone?: 'neutral' | 'good' | 'warning'
}

export interface MovedUpItem {
  taskId: string
  title: string
  reason: string
}

export interface DailyBriefing {
  title: string
  narrationText: string
  cards: BriefingCard[]
  movedUp?: MovedUpItem
}

interface BriefingInput {
  greeting: string // "Good morning" etc
  streak: number
  todayProgress: number // 0–100
  agendaCount: number
  completedToday: number
  totalHabits: number
  remainingHabits: string[] // names
  weekTasks: WeeklyTask[]
  todayDayIdx: number
}

/** Score how "avoided" an incomplete task is. Higher = more avoided. */
function avoidanceScore(task: WeeklyTask, todayDayIdx: number): number {
  const skips = countEventsForTask(task.id, 'task_skipped', 30)
  const defers = countEventsForTask(task.id, 'task_deferred', 30)
  const ageDays = Math.max(0, todayDayIdx - task.dayIndex)
  return (skips + defers) * 2.2 + Math.min(ageDays, 14) * 0.35
}

export function generateDailyBriefing(input: BriefingInput): DailyBriefing {
  const { greeting, streak, todayProgress, agendaCount, completedToday, totalHabits, remainingHabits, weekTasks, todayDayIdx } = input

  // ── Cards ──
  const cards: BriefingCard[] = [
    { label: 'Today', value: `${todayProgress}%`, tone: todayProgress >= 70 ? 'good' : todayProgress >= 30 ? 'neutral' : 'warning' },
    { label: 'Agenda', value: `${agendaCount} items`, tone: 'neutral' },
    { label: 'Streak', value: streak > 0 ? `${streak}d` : '—', tone: streak >= 7 ? 'good' : streak > 0 ? 'neutral' : 'warning' },
  ]

  // ── Move-up target ──
  const incomplete = weekTasks.filter((t) => !t.completed && t.dayIndex <= todayDayIdx)
  let movedUp: MovedUpItem | undefined

  if (incomplete.length > 0) {
    const scored = incomplete.map((t) => ({ task: t, score: avoidanceScore(t, todayDayIdx) })).sort((a, b) => b.score - a.score)
    const top = scored[0]
    const skips = countEventsForTask(top.task.id, 'task_skipped', 30)
    const defers = countEventsForTask(top.task.id, 'task_deferred', 30)
    const age = Math.max(0, todayDayIdx - top.task.dayIndex)
    let reason: string
    if (skips + defers > 0) {
      reason = `You've deferred this ${skips + defers} time${skips + defers > 1 ? 's' : ''}. Start with 10 minutes.`
    } else if (age > 0) {
      reason = `Open for ${age} day${age > 1 ? 's' : ''} now. Start with 10 minutes.`
    } else {
      reason = "It's been sitting here. Start with 10 minutes."
    }
    movedUp = { taskId: top.task.id, title: top.task.text, reason }
  }

  // ── Narration ──
  const parts: string[] = [`${greeting}.`, "Here's your Guidely briefing."]
  if (todayProgress >= 80) parts.push(`You're at ${todayProgress}% today. Strong.`)
  else if (todayProgress >= 40) parts.push(`${todayProgress}% done today. Momentum is building.`)
  else if (todayProgress > 0) parts.push(`${todayProgress}% so far. Room to move.`)
  else parts.push("Nothing tracked yet today. Let's change that.")

  if (agendaCount > 0) parts.push(`${agendaCount} item${agendaCount > 1 ? 's' : ''} on your agenda.`)
  if (streak >= 7) parts.push(`${streak}-day streak. Don\u0027t break the chain.`)
  else if (streak >= 3) parts.push(`${streak} days running. Building consistency.`)

  if (movedUp) {
    parts.push(`I moved up "${movedUp.title}".`)
    parts.push('You know why.')
    parts.push('Start with ten minutes.')
  } else if (remainingHabits.length > 0) {
    parts.push(`${remainingHabits.length} habit${remainingHabits.length > 1 ? 's' : ''} remaining.`)
  }

  parts.push("That's your briefing.")

  return {
    title: `${greeting}.`,
    narrationText: parts.join(' '),
    cards,
    movedUp,
  }
}
