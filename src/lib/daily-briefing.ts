import type { WeeklyTask } from './types'
import { countEventsForTask } from './attention-events'

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
  headline: string
  oneLiner: string
  vibeTag: string
  narrationText: string
  cards: BriefingCard[]
  movedUp?: MovedUpItem
}

interface BriefingInput {
  greeting: string
  streak: number
  todayProgress: number
  agendaCount: number
  completedToday: number
  totalHabits: number
  remainingHabits: string[]
  weekTasks: WeeklyTask[]
  todayDayIdx: number
}

function avoidanceScore(task: WeeklyTask, todayDayIdx: number): number {
  const skips = countEventsForTask(task.id, 'task_skipped', 30)
  const defers = countEventsForTask(task.id, 'task_deferred', 30)
  const ageDays = Math.max(0, todayDayIdx - task.dayIndex)
  return (skips + defers) * 2.2 + Math.min(ageDays, 14) * 0.35
}

export function generateDailyBriefing(input: BriefingInput): DailyBriefing {
  const { greeting, streak, todayProgress, agendaCount, completedToday, totalHabits, remainingHabits, weekTasks, todayDayIdx } = input
  const hour = new Date().getHours()

  // ── Cards ──
  const cards: BriefingCard[] = [
    { label: 'Today', value: `${todayProgress}%`, tone: todayProgress >= 70 ? 'good' : todayProgress >= 30 ? 'neutral' : 'warning' },
    { label: 'Agenda', value: `${agendaCount}`, tone: 'neutral' },
    { label: 'Streak', value: streak > 0 ? `${streak}d` : '0', tone: streak >= 7 ? 'good' : streak > 0 ? 'neutral' : 'warning' },
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
      reason = `Deferred ${skips + defers}x. Ten minutes. No negotiation.`
    } else if (age > 0) {
      reason = `Open ${age} day${age > 1 ? 's' : ''}. Ten minutes. No negotiation.`
    } else {
      reason = "It's sitting there. Ten minutes. No negotiation."
    }
    movedUp = { taskId: top.task.id, title: top.task.text, reason }
  }

  // ── Vibe tag ──
  const vibeTag = streak >= 7
    ? 'Momentum: \u{1F525}'
    : todayProgress >= 70
      ? 'Locked in: \u{1F3AF}'
      : agendaCount > 5
        ? 'Loaded: \u26A1'
        : todayProgress > 0
          ? 'Building: \u{1F9E0}'
          : 'Fresh start: \u2728'

  // ── Headline ──
  const headline = 'Your Attention Report \u{1F3AC}'

  // ── One-liner (shareable, 10-14 words) ──
  let oneLiner: string
  if (movedUp && streak > 0) {
    oneLiner = `${streak}-day streak, but "${movedUp.title}" is still dodging me.`
  } else if (streak >= 7) {
    oneLiner = `${streak} days straight. The system is working. Don't stop now.`
  } else if (todayProgress >= 80) {
    oneLiner = `${todayProgress}% done and the day's not over. You're dangerous today.`
  } else if (movedUp) {
    oneLiner = `"${movedUp.title}" keeps sliding. Today it moves. Ten minutes.`
  } else if (agendaCount > 0) {
    oneLiner = `${agendaCount} things on deck. Pick one. Start with ten minutes.`
  } else {
    oneLiner = "Nothing on the board yet. First move wins. Start with ten minutes."
  }

  // ── Narration (4 beats: hook, stats, coach, close) ──
  // Hook
  const hooks = hour < 12
    ? [`${greeting}. Your attention's already trying to escape.`, `${greeting}. Let's see where yesterday's focus actually went.`]
    : hour < 18
      ? [`${greeting}. Halfway through. Let's check the scoreboard.`, `${greeting}. The afternoon is wide open if you let it be.`]
      : [`${greeting}. Time to close the books.`, `${greeting}. The evening audit. No judgment, just data.`]
  const hook = hooks[todayProgress % hooks.length]

  // Stats
  let stats: string
  if (completedToday > 0 && remainingHabits.length > 0) {
    stats = `${completedToday} done, ${remainingHabits.length} remaining. ${todayProgress}% through today.`
  } else if (completedToday > 0) {
    stats = `${completedToday} of ${totalHabits} habits checked off. ${todayProgress}% today.`
  } else {
    stats = `${agendaCount} item${agendaCount !== 1 ? 's' : ''} waiting. Nothing checked yet.`
  }

  // Coach
  let coach: string
  if (movedUp) {
    coach = `I moved up "${movedUp.title}". You know why.`
  } else if (streak >= 7) {
    coach = `${streak}-day streak. Protect it.`
  } else if (remainingHabits.length === 1) {
    coach = `One habit left: ${remainingHabits[0]}. Finish it.`
  } else if (remainingHabits.length > 0) {
    coach = `${remainingHabits.length} habits to go. Pick the hardest one first.`
  } else {
    coach = "All clear. Use the space wisely."
  }

  const narrationText = `${hook} ${stats} ${coach} Start with ten minutes.`

  return { title: `${greeting}.`, headline, oneLiner, vibeTag, narrationText, cards, movedUp }
}
